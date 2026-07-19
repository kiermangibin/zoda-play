create or replace function public.add_admin_user(admin_email text)
returns table(email text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(admin_email));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;

  insert into public.admin_emails (email)
  values (normalized_email)
  on conflict on constraint admin_emails_pkey do nothing;

  update public.profiles profile
  set role = 'admin'
  where profile.email = normalized_email;

  return query
  select normalized_email, 'admin'::text;
end;
$$;

revoke all on function public.add_admin_user(text) from public;
revoke all on function public.add_admin_user(text) from anon;
grant execute on function public.add_admin_user(text) to authenticated;
