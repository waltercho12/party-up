-- Party-up MVP schema — round 2 (user feedback after first live test)
--   1) per-game party size caps instead of a flat 1~50 range
--   2) one active (recruiting/in_progress) party per host at a time
--   3) avatar upload via Supabase Storage
--   4) (no schema change — see chat: completed parties feed reputation/
--      history so they're kept; explore already hides non-active parties)
--   5) free-text "기타" game names never become public/searchable rows —
--      they're captured in an admin-only suggestions table, and every such
--      party is publicly labeled just "기타"
--   6) scheduled_at can't be in the past
--   7) (client-side only — 15 minute step on the datetime input)

-- ============================================================
-- 1) Per-game party size cap
-- ============================================================

alter table public.games add column max_party_size int;

update public.games set max_party_size = 5 where name in ('리그 오브 레전드', '발로란트', '오버워치2');
update public.games set max_party_size = 4 where name in ('배틀그라운드', '스타크래프트', '던전앤파이터', '피파온라인4');
update public.games set max_party_size = 10 where name = '마인크래프트';
update public.games set max_party_size = 8 where name = '로스트아크';
update public.games set max_party_size = 3 where name = '에이펙스 레전드';

-- Shared placeholder game every "기타" (custom) party points to, so the
-- public game name is always just "기타" — see (5) below.
insert into public.games (name, is_official, max_party_size) values ('기타', true, 20)
on conflict (name) do nothing;

create or replace function public.enforce_game_party_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
begin
  select coalesce(max_party_size, 20) into cap from public.games where id = new.game_id;
  if new.max_members > cap then
    raise exception 'max_members exceeds this game''s party size cap of %', cap;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_game_party_cap
before insert on public.parties
for each row execute function public.enforce_game_party_cap();

-- ============================================================
-- 2) One active party per host
-- ============================================================

create or replace function public.enforce_single_active_party_per_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.parties
    where host_id = new.host_id
      and status in ('recruiting', 'in_progress')
  ) then
    raise exception 'You already have an active party';
  end if;
  return new;
end;
$$;

create trigger trg_single_active_party_per_host
before insert on public.parties
for each row execute function public.enforce_single_active_party_per_host();

-- ============================================================
-- 3) Avatar uploads (Supabase Storage)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatar_upload_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 5) Custom game names: admin-review-only, never public
-- ============================================================

create table public.custom_game_suggestions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references public.parties(id) on delete set null,
  submitted_name text not null,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.custom_game_suggestions enable row level security;

-- Insert-only: submitters can record a suggestion but can't read anyone's
-- (including their own) — review happens by an admin via the Supabase
-- dashboard table editor, which bypasses RLS.
create policy "custom_game_suggestions_insert_own" on public.custom_game_suggestions
  for insert to authenticated with check (submitted_by = auth.uid());

-- Client no longer inserts directly into games; custom names go through
-- custom_game_suggestions instead.
drop policy if exists "games_insert_custom" on public.games;

-- ============================================================
-- 6) No scheduling into the past
-- ============================================================

create or replace function public.enforce_scheduled_at_not_past()
returns trigger
language plpgsql
as $$
begin
  if new.scheduled_at is not null and new.scheduled_at < now() then
    raise exception 'scheduled_at cannot be in the past';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_scheduled_at_not_past
before insert on public.parties
for each row execute function public.enforce_scheduled_at_not_past();
