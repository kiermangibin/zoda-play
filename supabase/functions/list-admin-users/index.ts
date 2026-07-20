import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AuthUser = {
  email?: string;
  id: string;
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  };
};

type AdminEmail = {
  created_at: string;
  email: string;
};

type Profile = {
  email: string;
  id: string;
  last_seen_at: string | null;
  name: string | null;
  role: "user" | "admin";
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const bootstrapAdminEmails = new Set(["trish@zoda.sg"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getUserName(user: AuthUser | null, fallbackEmail: string) {
  const metadataName =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return metadataName || fallbackEmail.split("@")[0] || "Mission Player";
}

async function findAdminUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<AuthUser | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const users = data.users as AuthUser[];
    const user = users.find((candidate) => normalizeEmail(candidate.email ?? "") === email);
    if (user) return user;
    if (users.length < 1000) return null;
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase admin environment is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  const jwt = authorization?.replace(/^Bearer\s+/i, "");

  if (!jwt) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await supabase.auth.getUser(jwt);

  if (callerError || !caller?.email) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const callerEmail = normalizeEmail(caller.email);
  const isBootstrapAdmin = bootstrapAdminEmails.has(callerEmail);
  const { data: allowedAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", callerEmail)
    .maybeSingle();

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!isBootstrapAdmin && !allowedAdmin && !adminProfile) {
    return jsonResponse({ error: "Admin access required." }, 403);
  }

  const { data: adminRows, error: adminError } = await supabase
    .from("admin_emails")
    .select("email,created_at")
    .order("created_at");

  if (adminError) {
    return jsonResponse({ error: adminError.message }, 500);
  }

  const adminEmails = ((adminRows ?? []) as AdminEmail[]).map((admin) =>
    normalizeEmail(admin.email),
  );

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,name,role,last_seen_at")
    .in("email", adminEmails.length ? adminEmails : ["__none__"]);

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  const profileByEmail = new Map(
    ((profileRows ?? []) as Profile[]).map((profile) => [
      normalizeEmail(profile.email),
      profile,
    ]),
  );

  const admins = [];

  for (const admin of (adminRows ?? []) as AdminEmail[]) {
    const email = normalizeEmail(admin.email);
    let profile = profileByEmail.get(email);
    let authUser: AuthUser | null = null;

    try {
      authUser = await findAdminUserByEmail(supabase, email);
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Unable to load auth users." },
        500,
      );
    }

    if ((!profile || profile.role !== "admin") && authUser?.last_sign_in_at) {
      const { data: syncedProfile, error: syncError } = await supabase
        .from("profiles")
        .upsert(
          {
            email,
            id: authUser.id,
            last_seen_at: authUser.last_sign_in_at,
            name: getUserName(authUser, email),
            role: "admin",
          },
          { onConflict: "id" },
        )
        .select("id,email,name,role,last_seen_at")
        .single();

      if (syncError) {
        return jsonResponse({ error: syncError.message }, 500);
      }

      profile = syncedProfile as Profile;
    }

    admins.push({
      created_at: admin.created_at,
      email,
      last_seen_at: profile?.last_seen_at ?? authUser?.last_sign_in_at ?? null,
      name: profile?.name ?? (authUser ? getUserName(authUser, email) : null),
      profile_id: profile?.id ?? authUser?.id ?? null,
      status: authUser?.last_sign_in_at || profile ? "active" : "pending",
    });
  }

  return jsonResponse({ admins });
});
