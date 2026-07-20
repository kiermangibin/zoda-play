import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "email_change"
  | "invite"
  | "magiclink"
  | "reauthentication"
  | "recovery"
  | "signup";

type HookUser = {
  email?: string;
  new_email?: string;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  };
};

type EmailData = {
  email_action_type: EmailActionType;
  factor_type?: string;
  old_email?: string;
  provider?: string;
  redirect_to: string;
  site_url: string;
  token: string;
  token_hash: string;
  token_hash_new?: string;
  token_new?: string;
};

type HookPayload = {
  email_data: EmailData;
  user: HookUser;
};

type EmailTemplate = {
  ctaLabel?: string;
  heading: string;
  intro: string;
  preview: string;
  subject: string;
};

const fromEmail = Deno.env.get("AUTH_EMAIL_FROM") ?? "ZODA Mission <no-reply@zoda.life>";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const rawHookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const hookSecret = rawHookSecret.replace(/^v1,whsec_/, "");
const authTemplateId = Deno.env.get("ZODA_AUTH_TEMPLATE_ID") ?? "";
const zodaSans = '"Commuters Sans", "Geist", Arial, Helvetica, sans-serif';
const zodaDisplay = '"Euphora", "Commuters Sans", Arial, Helvetica, sans-serif';
const pageStyle = `margin:0;background-color:#050806;color:#f8fff4;font-family:${zodaSans};`;
const textStyle = `margin:0;color:#d9eadf;font-family:${zodaSans};font-size:15px;line-height:1.7;`;
const mutedTextStyle = `margin:28px 0 0;color:#9cb5aa;font-family:${zodaSans};font-size:12px;line-height:1.7;`;
const buttonStyle = `background-color:#55cda1;border:1px solid #55cda1;border-radius:8px;color:#06100b;display:inline-block;font-family:${zodaSans};font-size:14px;font-weight:900;line-height:1;padding:15px 22px;text-align:center;text-decoration:none;`;

const templates: Record<EmailActionType, EmailTemplate> = {
  signup: {
    ctaLabel: "Confirm email address",
    heading: "Confirm your ZODA Mission email",
    intro: "You are one step away from joining the mission. Confirm this email address to activate your account.",
    preview: "Confirm your ZODA Mission email.",
    subject: "Confirm your ZODA Mission email",
  },
  invite: {
    ctaLabel: "Accept invitation",
    heading: "You are invited to ZODA Mission",
    intro: "An admin invited you to ZODA Mission. Accept the invite to set your password and access your workspace.",
    preview: "Accept your ZODA Mission invitation.",
    subject: "You are invited to ZODA Mission",
  },
  recovery: {
    ctaLabel: "Reset password",
    heading: "Reset your ZODA Mission password",
    intro: "We received a password reset request for your account. Use the secure link below to choose a new password.",
    preview: "Reset your ZODA Mission password.",
    subject: "Reset your ZODA Mission password",
  },
  magiclink: {
    ctaLabel: "Sign in",
    heading: "Your ZODA Mission sign-in link",
    intro: "Use this secure link to sign in to your mission workspace.",
    preview: "Sign in to ZODA Mission.",
    subject: "Your ZODA Mission sign-in link",
  },
  email_change: {
    ctaLabel: "Confirm email change",
    heading: "Confirm your ZODA Mission email change",
    intro: "Confirm this change to keep your ZODA Mission account details up to date.",
    preview: "Confirm your ZODA Mission email change.",
    subject: "Confirm your ZODA Mission email change",
  },
  reauthentication: {
    heading: "Verify your ZODA Mission session",
    intro: "Use the verification code below to continue your secure session.",
    preview: "Verify your ZODA Mission session.",
    subject: "Your ZODA Mission verification code",
  },
};

function getDisplayName(user: HookUser) {
  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  return name.trim() || user.email?.split("@")[0] || "Mission player";
}

function getVerifyType(actionType: EmailActionType) {
  if (actionType === "magiclink") return "magiclink";
  return actionType;
}

function buildActionUrl(emailData: EmailData, tokenHash: string) {
  if (!supabaseUrl || !tokenHash) return "";

  const params = new URLSearchParams({
    redirect_to: emailData.redirect_to || emailData.site_url || "https://zoda.life",
    token: tokenHash,
    type: getVerifyType(emailData.email_action_type),
  });

  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderEmail({
  actionUrl,
  code,
  template,
  user,
}: {
  actionUrl: string;
  code: string;
  template: EmailTemplate;
  user: HookUser;
}) {
  const name = escapeHtml(getDisplayName(user));
  const safeIntro = escapeHtml(template.intro);
  const shouldShowCode = !actionUrl || !template.ctaLabel;
  const codeBlock = shouldShowCode && code
    ? `<p style="margin:24px 0 8px;color:#8fa99d;font-family:${zodaSans};font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Verification code</p>
       <div style="border:1px solid #20372d;background:#101914;border-radius:8px;padding:16px 18px;color:#f8fff4;font-family:${zodaSans};font-size:28px;font-weight:900;letter-spacing:.2em;text-align:center;">${escapeHtml(code)}</div>`
    : "";
  const cta = actionUrl && template.ctaLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
         <tr>
           <td bgcolor="#55cda1" style="border-radius:8px;background-color:#55cda1;">
             <a href="${escapeHtml(actionUrl)}" style="${buttonStyle}">${escapeHtml(template.ctaLabel)}</a>
           </td>
         </tr>
       </table>`
    : "";

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
                <p style="${textStyle}">Hi ${name},</p>
                <p style="margin:12px 0 0;color:#d9eadf;font-family:${zodaSans};font-size:15px;line-height:1.7;">${safeIntro}</p>
                ${cta}
                ${codeBlock}
                <p style="${mutedTextStyle}">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail({
  actionUrl,
  code,
  template,
  to,
  user,
}: {
  actionUrl: string;
  code: string;
  template: EmailTemplate;
  to: string;
  user: HookUser;
}) {
  const templatePayload = authTemplateId
    ? {
        subject: template.subject,
        template: {
          id: authTemplateId,
          variables: {
            ACTION_URL: actionUrl || "https://zoda.life",
            CTA_LABEL: template.ctaLabel ?? "Continue",
            HEADING: template.heading,
            INTRO: template.intro,
            NAME: getDisplayName(user),
            PREVIEW: template.preview,
            SUBJECT: template.subject,
          },
        },
      }
    : {
        html: renderEmail({ actionUrl, code, template, user }),
        subject: template.subject,
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  if (!resendApiKey || !hookSecret || !supabaseUrl) {
    return Response.json({ error: "Email hook environment is not configured." }, { status: 500 });
  }

  try {
    const body = await request.text();
    const payload = new Webhook(hookSecret).verify(
      body,
      Object.fromEntries(request.headers),
    ) as HookPayload;
    const { email_data: emailData, user } = payload;
    const template = templates[emailData.email_action_type] ?? templates.magiclink;

    if (emailData.email_action_type === "email_change" && user.new_email) {
      const currentEmailUrl = buildActionUrl(emailData, emailData.token_hash_new ?? "");
      const newEmailUrl = buildActionUrl(emailData, emailData.token_hash);

      if (user.email && currentEmailUrl) {
        await sendEmail({
          actionUrl: currentEmailUrl,
          code: emailData.token,
          template,
          to: user.email,
          user,
        });
      }

      await sendEmail({
        actionUrl: newEmailUrl,
        code: emailData.token_new || emailData.token,
        template,
        to: user.new_email,
        user,
      });
    } else {
      if (!user.email) throw new Error("Missing recipient email.");

      await sendEmail({
        actionUrl: buildActionUrl(emailData, emailData.token_hash),
        code: emailData.token,
        template,
        to: user.email,
        user,
      });
    }

    return Response.json({});
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to send auth email." },
      { status: 401 },
    );
  }
});
