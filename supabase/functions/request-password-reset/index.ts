import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PasswordResetRequest = {
  email?: unknown;
  redirectTo?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};
const zodaSans = '"Commuters Sans", "Geist", Arial, Helvetica, sans-serif';
const zodaDisplay = '"Euphora", "Commuters Sans", Arial, Helvetica, sans-serif';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderResetEmail({ actionUrl, name }: { actionUrl: string; name: string }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Reset your ZODA Mission password</title>
  </head>
  <body style="margin:0;background:#050806;color:#f8fff4;font-family:${zodaSans};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Reset your ZODA Mission password.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050806;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #1e332a;border-radius:12px;overflow:hidden;background:#0b110e;">
            <tr>
              <td style="padding:22px 24px;border-bottom:1px solid #1e332a;">
                <div style="color:#55cda1;font-family:${zodaSans};font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;">ZODA Mission</div>
                <div style="color:#8fa99d;font-family:${zodaSans};font-size:12px;margin-top:6px;">Mission access email</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 24px 28px;">
                <h1 style="margin:0 0 14px;color:#f8fff4;font-family:${zodaDisplay};font-size:30px;font-weight:900;line-height:1.05;">Reset your ZODA Mission password</h1>
                <p style="margin:0;color:#cfe0d6;font-family:${zodaSans};font-size:15px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
                <p style="margin:12px 0 0;color:#cfe0d6;font-family:${zodaSans};font-size:15px;line-height:1.7;">Use the secure link below to choose a new password for your account.</p>
                <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:24px;background:#55cda1;color:#06100b;text-decoration:none;font-family:${zodaSans};font-size:14px;font-weight:900;border-radius:8px;padding:14px 20px;">Reset password</a>
                <p style="margin:28px 0 0;color:#8fa99d;font-family:${zodaSans};font-size:12px;line-height:1.7;">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendResetEmail({
  actionUrl,
  email,
  name,
}: {
  actionUrl: string;
  email: string;
  name: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("AUTH_EMAIL_FROM") ?? "ZODA Mission <no-reply@zoda.life>";

  if (!resendApiKey) {
    throw new Error("Resend is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: fromEmail,
      html: renderResetEmail({ actionUrl, name }),
      subject: "Reset your ZODA Mission password",
      to: email,
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
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

  let payload: PasswordResetRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Send a valid JSON body." }, 400);
  }

  const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const redirectTo =
    typeof payload.redirectTo === "string" && payload.redirectTo
      ? payload.redirectTo
      : "https://zoda.life/reset-password";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    email,
    options: { redirectTo },
    type: "recovery",
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const metadataName =
    typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name
      : typeof data.user.user_metadata?.full_name === "string"
        ? data.user.user_metadata.full_name
        : "";
  const name = metadataName || email.split("@")[0] || "Mission player";

  try {
    await sendResetEmail({
      actionUrl: data.properties.action_link,
      email,
      name,
    });
  } catch (sendError) {
    return jsonResponse(
      { error: sendError instanceof Error ? sendError.message : "Unable to send reset email." },
      500,
    );
  }

  return jsonResponse({ message: "Password reset email sent." });
});
