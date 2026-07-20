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

type EmailTemplate = {
  ctaLabel: string;
  heading: string;
  intro: string;
  preview: string;
  subject: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const bootstrapAdminEmails = new Set(["trish@zoda.sg"]);
const zodaSans = '"Commuters Sans", "Geist", Arial, Helvetica, sans-serif';
const zodaDisplay = '"Euphora", "Commuters Sans", Arial, Helvetica, sans-serif';
const pageStyle = `margin:0;background-color:#050806;color:#f8fff4;font-family:${zodaSans};`;
const textStyle = `margin:0;color:#d9eadf;font-family:${zodaSans};font-size:15px;line-height:1.7;`;
const mutedTextStyle = `margin:28px 0 0;color:#9cb5aa;font-family:${zodaSans};font-size:12px;line-height:1.7;`;
const buttonStyle = `background-color:#55cda1;border:1px solid #55cda1;border-radius:8px;color:#06100b;display:inline-block;font-family:${zodaSans};font-size:14px;font-weight:900;line-height:1;padding:15px 22px;text-align:center;text-decoration:none;`;
const adminInviteTemplate: EmailTemplate = {
  ctaLabel: "Accept invitation",
  heading: "You are invited to ZODA Mission",
  intro: "An admin invited you to ZODA Mission. Accept the invite to set your password and access your workspace.",
  preview: "Accept your ZODA Mission invitation.",
  subject: "You are invited to ZODA Mission",
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInviteEmail({
  actionUrl,
  name,
  template,
}: {
  actionUrl: string;
  name: string;
  template: EmailTemplate;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(template.subject)}</title>
  </head>
  <body bgcolor="#050806" style="${pageStyle}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(template.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#050806" style="background-color:#050806;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#0b110e" style="max-width:560px;border:1px solid #1e332a;border-radius:12px;overflow:hidden;background-color:#0b110e;">
            <tr>
              <td bgcolor="#0b110e" style="padding:22px 24px;border-bottom:1px solid #1e332a;background-color:#0b110e;">
                <div style="color:#55cda1;font-family:${zodaSans};font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;">ZODA Mission</div>
                <div style="color:#b7cfc4;font-family:${zodaSans};font-size:12px;margin-top:6px;">Mission access email</div>
              </td>
            </tr>
            <tr>
              <td bgcolor="#0b110e" style="padding:30px 24px 28px;background-color:#0b110e;">
                <h1 style="margin:0 0 14px;color:#ffffff;font-family:${zodaDisplay};font-size:30px;font-weight:900;line-height:1.05;">${escapeHtml(template.heading)}</h1>
                <p style="${textStyle}">Hi ${escapeHtml(name)},</p>
                <p style="margin:12px 0 0;color:#d9eadf;font-family:${zodaSans};font-size:15px;line-height:1.7;">${escapeHtml(template.intro)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                  <tr>
                    <td bgcolor="#55cda1" style="border-radius:8px;background-color:#55cda1;">
                      <a href="${escapeHtml(actionUrl)}" style="${buttonStyle}">${escapeHtml(template.ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="${mutedTextStyle}">If you did not expect this invite, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendResendEmail({
  actionUrl,
  name,
  to,
}: {
  actionUrl: string;
  name: string;
  to: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("AUTH_EMAIL_FROM") ?? "ZODA Mission <no-reply@zoda.life>";
  const templateId = Deno.env.get("ZODA_AUTH_TEMPLATE_ID") ?? "";

  if (!resendApiKey) {
    throw new Error("Resend is not configured.");
  }

  const templatePayload = templateId
    ? {
        subject: adminInviteTemplate.subject,
        template: {
          id: templateId,
          variables: {
            ACTION_URL: actionUrl,
            CTA_LABEL: adminInviteTemplate.ctaLabel,
            HEADING: adminInviteTemplate.heading,
            INTRO: adminInviteTemplate.intro,
            NAME: name,
            PREVIEW: adminInviteTemplate.preview,
            SUBJECT: adminInviteTemplate.subject,
          },
        },
      }
    : {
        html: renderInviteEmail({ actionUrl, name, template: adminInviteTemplate }),
        subject: adminInviteTemplate.subject,
      };

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: fromEmail,
      ...templatePayload,
      to,
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

    const { error: insertError } = await supabase
      .from("admin_emails")
      .upsert({ email }, { onConflict: "email" });

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
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

    const { error: insertError } = await supabase
      .from("admin_emails")
      .upsert({ email }, { onConflict: "email" });

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
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

  const { data, error: inviteError } = await supabase.auth.admin.generateLink({
    email,
    options: {
      data: { name },
      redirectTo,
    },
    type: "invite",
  });

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400);
  }

  try {
    await sendResendEmail({
      actionUrl: data.properties.action_link,
      name,
      to: email,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to send invite email." },
      500,
    );
  }

  const { error: insertError } = await supabase
    .from("admin_emails")
    .upsert({ email }, { onConflict: "email" });

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({
    action: "invited",
    email,
    invited: true,
    message: `Invite sent to ${email}. They can set their password from the email link.`,
    name,
    userId: data.user.id,
  });
});
