import { createClient } from "npm:@supabase/supabase-js@2";

type InviteAdminRequest = {
  email?: unknown;
  name?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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

  if (!allowedAdmin && !adminProfile) {
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

  const { error: insertError } = await supabase
    .from("admin_emails")
    .upsert({ email }, { onConflict: "email" });

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name, role: "admin" })
    .eq("email", email);

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  });

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400);
  }

  return jsonResponse({
    email,
    invited: true,
    name,
    userId: data.user?.id ?? null,
  });
});
