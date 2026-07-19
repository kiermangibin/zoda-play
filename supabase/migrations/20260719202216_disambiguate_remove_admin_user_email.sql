create or replace function public.remove_admin_user(admin_email text)
returns table(email text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_email text := lower((select auth.jwt() ->> 'email'));
  normalized_email text := lower(trim(admin_email));
  remaining_admins integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if normalized_email = current_email then
    raise exception 'You cannot remove your own admin access' using errcode = '42501';
  end if;

  select count(*) into remaining_admins
  from public.admin_emails admin
  where admin.email <> normalized_email;

  if remaining_admins < 1 then
    raise exception 'At least one admin is required' using errcode = '42501';
  end if;

  delete from public.admin_emails admin
  where admin.email = normalized_email;

  update public.profiles profile
  set role = 'user'
  where profile.email = normalized_email;

  return query
  select normalized_email, 'user'::text;
end;
$$;

revoke all on function public.remove_admin_user(text) from public;
revoke all on function public.remove_admin_user(text) from anon;
grant execute on function public.remove_admin_user(text) to authenticated;
