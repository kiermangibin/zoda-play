# Resend SMTP Setup for Supabase Auth

Status:
- Resend account is connected as `themediamorphosys@gmail.com`.
- Resend has a `zoda-play` API key.
- The final sender domain is still pending confirmation.
- Resend cannot send production auth email from a custom domain until that domain is verified with DNS records.

Sender target:
- Sender name: `ZODA Mission`
- Sender email: `no-reply@<confirmed-domain>`
- SMTP host: `smtp.resend.com`
- SMTP port: `587`
- SMTP username: `resend`
- SMTP password: Resend API key for `zoda-play`

When domain/DNS access is available:
1. Open Resend > Domains.
2. Add the confirmed sender domain.
3. Copy the DNS records from Resend.
4. Add those records with the domain's DNS provider.
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
- Keep `trish@zoda.sg` as the app's bootstrap admin unless the admin access policy itself needs to change.
