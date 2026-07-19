-- Server-only Edge Functions use the service role client to manage admin invites.
grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.admin_emails
  to service_role;

grant select, update
  on table public.profiles
  to service_role;
