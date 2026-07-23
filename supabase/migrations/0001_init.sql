-- Party-up MVP schema
-- Design principles enforced here:
--   * no gender column anywhere (privacy by omission, not by hiding a field)
--   * reputation_tiers has no client-facing RLS policies at all; the only
--     way to read a tier is the get_reputation_tier() RPC, which returns
--     just the tier label, never the internal score or the formula
--   * manner tags are a fixed vocabulary (checked via app layer + trigger
--     logic), never free text

create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_official boolean not null default false,
  icon_url text,
  created_at timestamptz not null default now()
);

create type party_status as enum ('recruiting', 'in_progress', 'completed', 'cancelled');

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id),
  title text not null,
  description text,
  max_members int not null check (max_members between 1 and 50),
  current_members int not null default 0,
  status party_status not null default 'recruiting',
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create type member_status as enum ('pending', 'accepted', 'rejected', 'left');

create table public.party_members (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status member_status not null default 'pending',
  joined_at timestamptz not null default now(),
  unique (party_id, user_id)
);

create table public.manner_evaluations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (party_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);

-- Deliberately has no RLS policies (see below): nobody can SELECT/INSERT/
-- UPDATE this table directly from the client. Reads only via the
-- get_reputation_tier() RPC; writes only via the trigger-driven
-- recompute_reputation_tier() function (SECURITY DEFINER, owned by the
-- migration role, which bypasses RLS as the table owner).
create table public.reputation_tiers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'seedling',
  internal_score numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create type report_status as enum ('pending', 'reviewed', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  party_id uuid references public.parties(id) on delete set null,
  reason_code text not null,
  evidence_text text,
  status report_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_parties_game_id on public.parties(game_id);
create index idx_parties_status on public.parties(status);
create index idx_party_members_party_id on public.party_members(party_id);
create index idx_party_members_user_id on public.party_members(user_id);
create index idx_manner_evaluations_reviewee_id on public.manner_evaluations(reviewee_id);
create index idx_blocks_blocker_id on public.blocks(blocker_id);

-- ============================================================
-- Functions & triggers
-- ============================================================

-- Host is automatically an accepted member of their own party.
create or replace function public.handle_new_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.party_members (party_id, user_id, status)
  values (new.id, new.host_id, 'accepted');
  return new;
end;
$$;

create trigger trg_new_party_host_member
after insert on public.parties
for each row execute function public.handle_new_party();

-- Prevent accepting more members than max_members allows.
create or replace function public.enforce_max_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_accepted int;
  cap int;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select max_members into cap from public.parties where id = new.party_id;
    select count(*) into current_accepted
      from public.party_members
      where party_id = new.party_id and status = 'accepted';
    if current_accepted >= cap then
      raise exception 'Party is already full';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_max_members
before update on public.party_members
for each row execute function public.enforce_max_members();

-- RLS's "update" policy only checks row ownership, not which status
-- transitions are legal, so a member could otherwise self-accept. This
-- trigger enforces who is allowed to move a membership from one status to
-- another: only the host can accept/reject a pending application, only the
-- member themselves can cancel/leave.
create or replace function public.enforce_member_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_host boolean;
  is_self boolean;
begin
  select (p.host_id = auth.uid()) into is_host from public.parties p where p.id = new.party_id;
  is_self := (old.user_id = auth.uid());

  if is_host and old.status = 'pending' and new.status in ('accepted', 'rejected') then
    return new;
  end if;

  if is_self and old.status in ('pending', 'accepted') and new.status = 'left' then
    return new;
  end if;

  raise exception 'Invalid party member status transition';
end;
$$;

create trigger trg_enforce_member_status_transition
before update on public.party_members
for each row execute function public.enforce_member_status_transition();

-- Keep parties.current_members in sync so the explore list can show party
-- fullness without needing RLS access to other members' membership rows.
create or replace function public.sync_party_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_party_id uuid;
begin
  target_party_id := coalesce(new.party_id, old.party_id);
  update public.parties
    set current_members = (
      select count(*) from public.party_members
      where party_id = target_party_id and status = 'accepted'
    )
    where id = target_party_id;
  return null;
end;
$$;

create trigger trg_sync_party_member_count
after insert or update or delete on public.party_members
for each row execute function public.sync_party_member_count();

-- Only forward transitions through the party lifecycle are legal.
create or replace function public.enforce_party_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status = 'recruiting' and new.status in ('in_progress', 'cancelled'))
     or (old.status = 'in_progress' and new.status in ('completed', 'cancelled')) then
    return new;
  end if;

  raise exception 'Invalid party status transition from % to %', old.status, new.status;
end;
$$;

create trigger trg_enforce_party_status_transition
before update on public.parties
for each row execute function public.enforce_party_status_transition();

-- Recompute a user's reputation tier. Diversity of reviewers and repeated
-- evaluation from the same person are deliberately weighted so one person
-- spamming reviews can't move the needle much; only positive/negative tier
-- labels are ever exposed, never the score or the weights.
create or replace function public.recompute_reputation_tier(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_parties int;
  distinct_reviewers int;
  positive_count int;
  negative_count int;
  positive_ratio numeric;
  score numeric;
  new_tier text;
  positive_tags text[] := array['시간 약속을 잘 지켜요','친절해요','또 함께하고 싶어요','소통이 편해요'];
  negative_tags text[] := array['연락이 잘 안돼요','매너가 아쉬웠어요','무단 이탈했어요'];
begin
  select count(distinct party_id) into completed_parties
  from public.manner_evaluations
  where reviewee_id = target;

  with capped as (
    select reviewer_id, party_id, tags,
      row_number() over (partition by reviewer_id order by created_at) as rn
    from public.manner_evaluations
    where reviewee_id = target
  ), limited as (
    select * from capped where rn <= 3
  )
  select
    count(distinct reviewer_id),
    coalesce(sum(cardinality(array(select unnest(tags) intersect select unnest(positive_tags)))), 0),
    coalesce(sum(cardinality(array(select unnest(tags) intersect select unnest(negative_tags)))), 0)
  into distinct_reviewers, positive_count, negative_count
  from limited;

  positive_ratio := case
    when (positive_count + negative_count) = 0 then 0.5
    else positive_count::numeric / (positive_count + negative_count)
  end;

  score := (distinct_reviewers * 2) + completed_parties + (positive_ratio * 10) - (negative_count * 1.5);

  new_tier := case
    when completed_parties >= 10 and distinct_reviewers >= 6 and positive_ratio >= 0.8 then 'regular'
    when completed_parties >= 3 and distinct_reviewers >= 3 and positive_ratio >= 0.7 then 'trusted'
    else 'seedling'
  end;

  insert into public.reputation_tiers (user_id, tier, internal_score, updated_at)
  values (target, new_tier, score, now())
  on conflict (user_id) do update
    set tier = excluded.tier, internal_score = excluded.internal_score, updated_at = now();
end;
$$;

create or replace function public.handle_new_manner_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_reputation_tier(new.reviewee_id);
  return new;
end;
$$;

create trigger trg_manner_evaluation_recompute
after insert on public.manner_evaluations
for each row execute function public.handle_new_manner_evaluation();

-- The only client-facing way to read a reputation tier: label only.
create or replace function public.get_reputation_tier(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select tier from public.reputation_tiers where user_id = target_user_id),
    'seedling'
  );
$$;

grant execute on function public.get_reputation_tier(uuid) to authenticated, anon;

-- RLS on public.blocks only lets a user see blocks *they* created, so a
-- plain subquery inside another table's policy can't see "the other person
-- blocked me". This SECURITY DEFINER function checks both directions
-- without ever exposing the underlying rows to the client.
create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.blocked_between(uuid, uuid) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.manner_evaluations enable row level security;
alter table public.reputation_tiers enable row level security; -- no policies: locked down, RPC-only
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "games_select_all" on public.games
  for select to authenticated using (true);

create policy "games_insert_custom" on public.games
  for insert to authenticated with check (is_official = false);

create policy "parties_select_all" on public.parties
  for select to authenticated using (true);

create policy "parties_insert_own" on public.parties
  for insert to authenticated with check (host_id = auth.uid());

create policy "parties_update_host" on public.parties
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

-- Accepted members are a public roster (their profiles are already public
-- and joining is a visible commitment). Pending/rejected/left rows stay
-- private to the applicant and the host, so applicants aren't exposed to
-- each other or publicly shamed for a rejection.
create policy "party_members_select" on public.party_members
  for select to authenticated using (
    status = 'accepted'
    or user_id = auth.uid()
    or exists (select 1 from public.parties p where p.id = party_id and p.host_id = auth.uid())
  );

create policy "party_members_insert_self" on public.party_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pending'
    and not exists (
      select 1 from public.parties p
      where p.id = party_id and public.blocked_between(p.host_id, auth.uid())
    )
  );

create policy "party_members_update" on public.party_members
  for update to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.parties p where p.id = party_id and p.host_id = auth.uid())
  ) with check (
    user_id = auth.uid()
    or exists (select 1 from public.parties p where p.id = party_id and p.host_id = auth.uid())
  );

create policy "manner_eval_select_own" on public.manner_evaluations
  for select to authenticated using (reviewer_id = auth.uid() or reviewee_id = auth.uid());

create policy "manner_eval_insert" on public.manner_evaluations
  for insert to authenticated with check (
    reviewer_id = auth.uid()
    and reviewer_id <> reviewee_id
    and exists (
      select 1 from public.parties p
      where p.id = party_id and p.status = 'completed'
    )
    and exists (
      select 1 from public.party_members pm
      where pm.party_id = manner_evaluations.party_id
        and pm.user_id = manner_evaluations.reviewer_id
        and pm.status = 'accepted'
    )
    and exists (
      select 1 from public.party_members pm
      where pm.party_id = manner_evaluations.party_id
        and pm.user_id = manner_evaluations.reviewee_id
        and pm.status = 'accepted'
    )
  );

create policy "blocks_select_own" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

create policy "blocks_insert_own" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());

create policy "blocks_delete_own" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ============================================================
-- Seed data: official game list
-- ============================================================

insert into public.games (name, is_official) values
  ('리그 오브 레전드', true),
  ('발로란트', true),
  ('오버워치2', true),
  ('배틀그라운드', true),
  ('마인크래프트', true),
  ('로스트아크', true),
  ('스타크래프트', true),
  ('던전앤파이터', true),
  ('에이펙스 레전드', true),
  ('피파온라인4', true)
on conflict (name) do nothing;
