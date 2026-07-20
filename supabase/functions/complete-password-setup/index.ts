import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type CompletePasswordSetupRequest = {
  password?: unknown;
  tokenHash?: unknown;
  type?: unknown;
};

type VerifiedUser = {
  email?: string;
  id: string;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  };
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

function getVerifyType(value: string) {
  if (value === "invite" || value === "recovery" || value === "signup" || value === "magiclink") {
    return value;
  }

  return "invite";
}

function getUserName(user: VerifiedUser) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  const email = user.email ?? "";

  return metadataName || email.split("@")[0] || "Mission Player";
}

async function verifyTokenHash({
  serviceRoleKey,
  supabaseUrl,
  tokenHash,
  type,
}: {
  serviceRoleKey: string;
  supabaseUrl: string;
  tokenHash: string;
  type: string;
}) {
  const attempts = type === "email" ? ["email"] : [type, "email"];
  let lastError = "Unable to verify this invite link.";

  for (const attempt of attempts) {
    const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      body: JSON.stringify({
        token_hash: tokenHash,
        type: attempt,
      }),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const body = await response.json().catch(() => null);

    if (response.ok && body?.user?.id) {
      return body.user as VerifiedUser;
    }

    lastError =
      typeof body?.msg === "string"
        ? body.msg
        : typeof body?.error_description === "string"
          ? body.error_description
          : typeof body?.error === "string"
            ? body.error
            : lastError;
  }

  throw new Error(lastError);
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

  let payload: CompletePasswordSetupRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Send a valid JSON body." }, 400);
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  const tokenHash = typeof payload.tokenHash === "string" ? payload.tokenHash : "";
  const type = getVerifyType(typeof payload.type === "string" ? payload.type : "");

  if (password.length < 8) {
    return jsonResponse({ error: "Use at least 8 characters for your password." }, 400);
  }

  if (!tokenHash) {
    return jsonResponse({ error: "Open the latest invite or password reset email link." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let verifiedUser: VerifiedUser;
  try {
    verifiedUser = await verifyTokenHash({
      serviceRoleKey,
      supabaseUrl,
      tokenHash,
      type,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to verify this invite link." },
      400,
    );
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(verifiedUser.id, {
    password,
  });

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  const email = normalizeEmail(verifiedUser.email ?? "");
  if (email) {
    const { data: adminEmail } = await supabase
      .from("admin_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        email,
        id: verifiedUser.id,
        last_seen_at: new Date().toISOString(),
        name: getUserName(verifiedUser),
        role: adminEmail ? "admin" : "user",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }
  }

  return jsonResponse({ message: "Password saved." });
});
