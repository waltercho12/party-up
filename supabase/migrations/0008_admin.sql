-- Party-up MVP schema — round 6
-- Admin role: granted only via direct DB access (never through the app —
-- no insert/update/delete policy exists on this table at all, so nobody
-- can self-promote). Used to let admins triage reports and review
-- custom game name suggestions that are otherwise locked from everyone.

create table public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- No policies: fully locked from the client, same posture as
-- reputation_tiers / app_settings. Only readable via is_admin() below.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- Reports: admins can see and triage everything, not just their own.
create policy "reports_select_admin" on public.reports
  for select to authenticated using (public.is_admin());

create policy "reports_update_admin" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Custom game suggestions: admin-only read/triage. Submitters still can't
-- read their own (unchanged) — nobody but an admin sees this table.
create policy "custom_game_suggestions_select_admin" on public.custom_game_suggestions
  for select to authenticated using (public.is_admin());

create policy "custom_game_suggestions_update_admin" on public.custom_game_suggestions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
