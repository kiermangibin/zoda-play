import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeleteUserRequest = {
  email?: unknown;
  userId?: unknown;
};

type AuthUser = {
  email?: string;
  id: string;
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  let payload: DeleteUserRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Send a valid JSON body." }, 400);
  }

  const requestedEmail =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const requestedUserId = typeof payload.userId === "string" ? payload.userId.trim() : "";

  if (!requestedUserId && !isValidEmail(requestedEmail)) {
    return jsonResponse({ error: "Send a valid user id or email address." }, 400);
  }

  if (requestedEmail && requestedEmail === callerEmail) {
    return jsonResponse({ error: "You cannot delete your own account." }, 403);
  }

  if (bootstrapAdminEmails.has(requestedEmail)) {
    return jsonResponse({ error: "The bootstrap admin cannot be deleted." }, 403);
  }

  let targetUser: AuthUser | null = null;
  if (requestedUserId) {
    const { data, error } = await supabase.auth.admin.getUserById(requestedUserId);
    if (error && !requestedEmail) return jsonResponse({ error: error.message }, 404);
    targetUser = (data?.user as AuthUser | null) ?? null;
  }

  if (!targetUser && requestedEmail) {
    try {
      targetUser = await findUserByEmail(supabase, requestedEmail);
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Unable to find user." },
        500,
      );
    }
  }

  const targetEmail = normalizeEmail(targetUser?.email ?? requestedEmail);

  if (!targetEmail || !isValidEmail(targetEmail)) {
    return jsonResponse({ error: "Unable to resolve the user's email address." }, 404);
  }

  if (targetEmail === callerEmail) {
    return jsonResponse({ error: "You cannot delete your own account." }, 403);
  }

  if (bootstrapAdminEmails.has(targetEmail)) {
    return jsonResponse({ error: "The bootstrap admin cannot be deleted." }, 403);
  }

  const { count: remainingAdmins, error: adminCountError } = await supabase
    .from("admin_emails")
    .select("email", { count: "exact", head: true })
    .neq("email", targetEmail);

  if (adminCountError) {
    return jsonResponse({ error: adminCountError.message }, 500);
  }

  const { data: targetAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", targetEmail)
    .maybeSingle();

  if (targetAdmin && (remainingAdmins ?? 0) < 1) {
    return jsonResponse({ error: "At least one admin is required." }, 403);
  }

  const { error: blockError } = await supabase.from("deleted_user_emails").upsert(
    {
      deleted_by: caller.id,
      email: targetEmail,
    },
    { onConflict: "email" },
  );

  if (blockError) {
    return jsonResponse({ error: blockError.message }, 500);
  }

  const { error: adminDeleteError } = await supabase
    .from("admin_emails")
    .delete()
    .eq("email", targetEmail);

  if (adminDeleteError) {
    return jsonResponse({ error: adminDeleteError.message }, 500);
  }

  const { error: profileDeleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("email", targetEmail);

  if (profileDeleteError) {
    return jsonResponse({ error: profileDeleteError.message }, 500);
  }

  if (targetUser?.id) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUser.id, false);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }
  }

  return jsonResponse({
    deleted: true,
    email: targetEmail,
    userId: targetUser?.id ?? null,
  });
});
