import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PasswordResetRequest = {
  email?: unknown;
  redirectTo?: unknown;
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
const zodaSans = '"Commuters Sans", "Geist", Arial, Helvetica, sans-serif';
const zodaDisplay = '"Euphora", "Commuters Sans", Arial, Helvetica, sans-serif';
const pageStyle = `margin:0;background-color:#050505;color:#151913;font-family:${zodaSans};`;
const textStyle = `margin:0;color:#343a31;font-family:${zodaSans};font-size:15px;line-height:1.7;`;
const mutedTextStyle = `margin:0;color:#2d4b3f;font-family:${zodaSans};font-size:12px;line-height:1.7;`;
const buttonStyle = `background-color:#55cda1;border:1px solid #55cda1;border-radius:8px;color:#06100b;display:inline-block;font-family:${zodaSans};font-size:14px;font-weight:900;line-height:1;padding:15px 22px;text-align:center;text-decoration:none;`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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
  <body bgcolor="#050505" style="${pageStyle}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Reset your ZODA Mission password.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#050505" style="background-color:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:560px;border:1px solid #1e332a;border-radius:12px;overflow:hidden;background-color:#ffffff;">
            <tr>
              <td bgcolor="#050505" style="padding:22px 24px;background-color:#050505;border-bottom:1px solid #55cda1;">
                <div style="color:#55cda1;font-family:${zodaSans};font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;">ZODA Mission</div>
                <div style="color:#cfe0d6;font-family:${zodaSans};font-size:12px;font-weight:800;margin-top:6px;">Mission access email</div>
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="padding:30px 24px 28px;background-color:#ffffff;">
                <h1 style="margin:0 0 14px;color:#151913;font-family:${zodaDisplay};font-size:32px;font-weight:900;line-height:1.05;">Reset your ZODA Mission password</h1>
                <p style="${textStyle}">Hi ${escapeHtml(name)},</p>
                <p style="margin:12px 0 0;color:#343a31;font-family:${zodaSans};font-size:15px;line-height:1.7;">Use the secure link below to choose a new password for your account.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                  <tr>
                    <td bgcolor="#55cda1" style="border-radius:8px;background-color:#55cda1;">
                      <a href="${escapeHtml(actionUrl)}" style="${buttonStyle}">Reset password</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;">
                  <tr>
                    <td bgcolor="#eefbf5" style="background-color:#eefbf5;border:1px solid #b7ead6;border-radius:8px;padding:14px 16px;">
                      <p style="${mutedTextStyle}">If you did not request this, you can safely ignore this email.</p>
                    </td>
                  </tr>
                </table>
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
  const templateId = Deno.env.get("ZODA_AUTH_TEMPLATE_ID") ?? "";

  if (!resendApiKey) {
    throw new Error("Resend is not configured.");
  }

  const templatePayload = templateId
    ? {
        subject: "Reset your ZODA Mission password",
        template: {
          id: templateId,
          variables: {
            ACTION_URL: actionUrl,
            CTA_LABEL: "Reset password",
            HEADING: "Reset your ZODA Mission password",
            INTRO: "Use the secure link below to choose a new password for your account.",
            NAME: name,
            PREVIEW: "Reset your ZODA Mission password.",
            SUBJECT: "Reset your ZODA Mission password",
          },
        },
      }
    : {
        html: renderResetEmail({ actionUrl, name }),
        subject: "Reset your ZODA Mission password",
      };

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: fromEmail,
      ...templatePayload,
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

  const { data: deletedUser, error: deletedError } = await supabase
    .from("deleted_user_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (deletedError) {
    return jsonResponse({ error: deletedError.message }, 500);
  }

  if (deletedUser) {
    return jsonResponse(
      { error: "No active account found for this email. Ask an admin to send a new invite." },
      404,
    );
  }

  try {
    const existingUser = await findUserByEmail(supabase, email);
    if (!existingUser) {
      return jsonResponse({ error: "No account found for this email." }, 404);
    }
  } catch (lookupError) {
    return jsonResponse(
      { error: lookupError instanceof Error ? lookupError.message : "Unable to find account." },
      500,
    );
  }

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
