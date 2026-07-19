create table if not exists public.mission_challenge_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  user_name text not null,
  challenge_id text not null,
  challenge_name text not null,
  week_label text not null,
  result text not null check (result in ('hit', 'fail', 'final')),
  points numeric not null default 0,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index if not exists mission_challenge_results_completed_at_idx
  on public.mission_challenge_results (completed_at desc);

create index if not exists mission_challenge_results_week_idx
  on public.mission_challenge_results (week_label, result);

alter table public.mission_challenge_results enable row level security;

grant select, insert, update on public.mission_challenge_results to authenticated;

create policy "Users can read their own mission results"
  on public.mission_challenge_results
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.current_user_is_admin()
  );

create policy "Users can create their own mission results"
  on public.mission_challenge_results
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own mission results"
  on public.mission_challenge_results
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
