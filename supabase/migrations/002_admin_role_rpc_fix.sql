create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_emails admin
    where admin.email = lower((select auth.jwt() ->> 'email'))
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated;

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
  on conflict (email) do nothing;

  update public.profiles
  set role = 'admin'
  where public.profiles.email = normalized_email;

  return query
  select normalized_email, 'admin'::text;
end;
$$;

revoke all on function public.add_admin_user(text) from public;
revoke all on function public.add_admin_user(text) from anon;
grant execute on function public.add_admin_user(text) to authenticated;

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
  from public.admin_emails
  where email <> normalized_email;

  if remaining_admins < 1 then
    raise exception 'At least one admin is required' using errcode = '42501';
  end if;

  delete from public.admin_emails
  where public.admin_emails.email = normalized_email;

  update public.profiles
  set role = 'user'
  where public.profiles.email = normalized_email;

  return query
  select normalized_email, 'user'::text;
end;
$$;

revoke all on function public.remove_admin_user(text) from public;
revoke all on function public.remove_admin_user(text) from anon;
grant execute on function public.remove_admin_user(text) to authenticated;
