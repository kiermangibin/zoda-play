create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Mission Player',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;

grant select on public.admin_emails to authenticated;

revoke insert on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, email, name, last_seen_at) on public.profiles to authenticated;
grant update (name, last_seen_at) on public.profiles to authenticated;

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
  );
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "Admins can read admin emails" on public.admin_emails;

create policy "Admins can read admin emails"
  on public.admin_emails
  for select
  to authenticated
  using (
    email = (select auth.jwt() ->> 'email')
    or public.current_user_is_admin()
  );

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1
      from public.admin_emails admin
      where admin.email = (select auth.jwt() ->> 'email')
    )
  );

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

insert into public.admin_emails (email)
values
  ('trish@zoda.sg')
on conflict (email) do nothing;

delete from public.admin_emails
where email = 'themediamorphosys@gmail.com';

update public.profiles
set role = 'admin'
where email = 'trish@zoda.sg';

update public.profiles
set role = 'user'
where email = 'themediamorphosys@gmail.com';

create or replace function public.apply_profile_role_from_admin_list()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.admin_emails admin
    where admin.email = lower(new.email)
  ) then
    new.role := 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profile_role_from_admin_list on public.profiles;

create trigger set_profile_role_from_admin_list
before insert or update of email on public.profiles
for each row
execute function public.apply_profile_role_from_admin_list();

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

  if not exists (
    select 1
    from public.admin_emails admin
    where admin.email = lower((select auth.jwt() ->> 'email'))
  ) then
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

  if not exists (
    select 1
    from public.admin_emails admin
    where admin.email = current_email
  ) then
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
