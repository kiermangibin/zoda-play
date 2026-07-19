create table if not exists public.deleted_user_emails (
  email text primary key,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null
);

alter table public.deleted_user_emails enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.deleted_user_emails to service_role;
grant select, delete on table public.profiles to service_role;

create or replace function public.current_user_is_deleted()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.deleted_user_emails deleted_user
    where deleted_user.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

revoke all on function public.current_user_is_deleted() from public;
revoke all on function public.current_user_is_deleted() from anon;
grant execute on function public.current_user_is_deleted() to authenticated;
