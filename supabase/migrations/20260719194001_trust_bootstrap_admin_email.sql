create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'trish@zoda.sg'
  or exists (
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

insert into public.admin_emails (email)
values ('trish@zoda.sg')
on conflict (email) do nothing;

update public.profiles
set role = 'admin'
where email = 'trish@zoda.sg';
