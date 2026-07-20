import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AuthUser = {
  created_at?: string;
  email?: string;
  id: string;
  last_sign_in_at?: string | null;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  };
};

type Profile = {
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string;
  name: string;
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

function getUserName(user: AuthUser) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  const email = user.email ?? "";

  return metadataName || email.split("@")[0] || "Mission Player";
}

async function callerIsAdmin({
  callerEmail,
  callerId,
  supabase,
}: {
  callerEmail: string;
  callerId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  if (bootstrapAdminEmails.has(callerEmail)) return true;

  const { data: allowedAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", callerEmail)
    .maybeSingle();

  if (allowedAdmin) return true;

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  return Boolean(adminProfile);
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
  if (
    !(await callerIsAdmin({
      callerEmail,
      callerId: caller.id,
      supabase,
    }))
  ) {
    return jsonResponse({ error: "Admin access required." }, 403);
  }

  const { data: adminRows, error: adminError } = await supabase
    .from("admin_emails")
    .select("email");

  if (adminError) {
    return jsonResponse({ error: adminError.message }, 500);
  }

  const adminEmails = new Set(
    ((adminRows ?? []) as { email: string }[]).map((admin) => normalizeEmail(admin.email)),
  );
  const authUsers: AuthUser[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    authUsers.push(...(data.users as AuthUser[]));
    if (data.users.length < 1000) break;
  }

  for (const user of authUsers) {
    const email = normalizeEmail(user.email ?? "");
    if (!email) continue;

    const { data: deletedUser, error: deletedError } = await supabase
      .from("deleted_user_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (deletedError) {
      return jsonResponse({ error: deletedError.message }, 500);
    }

    if (deletedUser) continue;

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        email,
        id: user.id,
        last_seen_at: user.last_sign_in_at ?? user.created_at ?? new Date().toISOString(),
        name: getUserName(user),
        role: adminEmails.has(email) ? "admin" : "user",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,name,role,created_at,last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  return jsonResponse({ users: (profileRows ?? []) as Profile[] });
});
