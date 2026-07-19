import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type InviteAdminRequest = {
  email?: unknown;
  name?: unknown;
};

type AuthUser = {
  email?: string;
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  id: string;
  user_metadata?: {
    name?: unknown;
    full_name?: unknown;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function getUserName(user: AuthUser | null, fallbackName: string, fallbackEmail: string) {
  const metadataName =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return metadataName || fallbackName || fallbackEmail.split("@")[0] || "Mission Player";
}

function isUnfinishedInvite(user: AuthUser | null) {
  return Boolean(user?.invited_at && !user.last_sign_in_at);
}

async function findUserByEmail(
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

  if (request.method !== "POST") {
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

  let payload: InviteAdminRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Send a valid JSON body." }, 400);
  }

  const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  if (name.length < 2) {
    return jsonResponse({ error: "Enter the admin's name." }, 400);
  }

  const origin = request.headers.get("Origin") ?? "https://mission-play.vercel.app";
  const redirectTo = `${origin}/reset-password`;

  const { data: existingAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id,email,name,role,last_seen_at")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return jsonResponse({ error: existingProfileError.message }, 500);
  }

  let existingUser: AuthUser | null = null;
  try {
    existingUser = await findUserByEmail(supabase, email);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to check existing users." },
      500,
    );
  }

  if (existingAdmin && existingProfile?.role === "admin") {
    return jsonResponse({
      action: "already_admin",
      email,
      invited: false,
      message: `${email} is already an admin.`,
      name: existingProfile?.name ?? getUserName(existingUser, name, email),
      userId: existingProfile?.id ?? existingUser?.id ?? null,
    });
  }

  if (existingAdmin && existingUser && !existingProfile && isUnfinishedInvite(existingUser)) {
    return jsonResponse({
      action: "already_invited",
      email,
      invited: false,
      message: `${email} already has an admin invite pending. No duplicate invite email was sent.`,
      name: getUserName(existingUser, name, email),
      userId: existingUser.id,
    });
  }

  const { error: insertError } = await supabase
    .from("admin_emails")
    .upsert({ email }, { onConflict: "email" });

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  if (existingUser) {
    const profileName = getUserName(existingUser, name, email);
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        email,
        id: existingUser.id,
        last_seen_at: new Date().toISOString(),
        name: profileName,
        role: "admin",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    return jsonResponse({
      action: "promoted",
      email,
      invited: false,
      message: `${email} is now an admin. No invite email was sent because they already have an account.`,
      name: profileName,
      userId: existingUser.id,
    });
  }

  if (existingProfile) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name, role: "admin" })
      .eq("email", email);

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    return jsonResponse({
      action: "promoted",
      email,
      invited: false,
      message: `${email} is now an admin. No invite email was sent because they already have a user profile.`,
      name,
      userId: existingProfile.id,
    });
  }

  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  });

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400);
  }

  return jsonResponse({
    action: "invited",
    email,
    invited: true,
    message: `Invite sent to ${email}. They can set their password from the email link.`,
    name,
    userId: data.user?.id ?? null,
  });
});
