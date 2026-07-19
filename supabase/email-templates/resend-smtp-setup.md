# Resend SMTP Setup for Supabase Auth

Status:
- Resend account is connected as `themediamorphosys@gmail.com`.
- Resend has a `zoda-play` API key.
- `zoda.sg` DNS is hosted at GoDaddy (`ns63.domaincontrol.com`, `ns64.domaincontrol.com`).
- Resend cannot send from `zoda.sg` until DNS records are added in GoDaddy.

Sender target:
- Sender name: `ZODA Mission`
- Sender email: `no-reply@zoda.sg`
- SMTP host: `smtp.resend.com`
- SMTP port: `587`
- SMTP username: `resend`
- SMTP password: Resend API key for `zoda-play`

When GoDaddy access is available:
1. Open Resend > Domains.
2. Add `zoda.sg`.
3. Copy the DNS records from Resend.
4. Add those records in GoDaddy DNS.
5. Return to Resend and verify DNS records.
6. Open Supabase > `zoda-play` > Authentication > Emails > SMTP Settings.
7. Enable custom SMTP and fill the Resend SMTP settings above.
8. Save changes.
9. Test:
   - Admin invite email from `/admin/users`.
   - Forgot password email from `/forgot-password`.

Notes:
- Do not use `mission-play.vercel.app` as the sender domain. Resend requires a domain with DNS records we control.
- Supabase built-in auth email is limited; Resend SMTP removes the current hourly development email limit.
