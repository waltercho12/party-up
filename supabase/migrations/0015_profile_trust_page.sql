-- Party-up MVP schema — round 8 (profile redesign: trust page, not a bio page)
--
-- Adds the data surface a "should I play with this person?" profile needs:
--   * bio length cap (100 chars, enforced at the DB too, not just the form)
--   * parties.completed_at, so "recent activity" and "last 30 days" are
--     answerable without guessing from created_at
--   * three new SECURITY DEFINER RPCs, all following the existing privacy
--     pattern (aggregates only, never raw manner_evaluations rows, never
--     the internal score/formula):
--       - get_trust_badges: booleans only, no percentages or counts
--       - get_play_record: completed/last-30-day counts + avg party size
--       - get_recent_activity: recent completed party titles only

-- ============================================================
-- 1. Bio length cap
-- ============================================================

alter table public.profiles
  add constraint profiles_bio_length check (char_length(bio) <= 100);

-- ============================================================
-- 2. parties.completed_at
-- ============================================================

alter table public.parties add column completed_at timestamptz;

-- Best-effort backfill for parties that were already completed before this
-- column existed — created_at is the closest thing we have on hand.
update public.parties set completed_at = created_at
where status = 'completed' and completed_at is null;

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
    if new.status = 'completed' then
      new.completed_at = now();
    end if;
    return new;
  end if;

  raise exception 'Invalid party status transition from % to %', old.status, new.status;
end;
$$;

-- ============================================================
-- 3. Trust badges — presence only, no numbers, same 10-evaluation privacy
--    gate as get_reputation_summary (self always sees; others need 10+).
-- ============================================================

create or replace function public.get_trust_badges(target_user_id uuid)
returns table (
  replay_recommended boolean,
  punctual boolean,
  easy_communication boolean,
  stayed_full boolean,
  beginner_friendly boolean,
  visible boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with evals as (
    select replay_intent, positive_tags
    from public.manner_evaluations
    where reviewee_id = target_user_id
  ), total as (
    select count(*) as n from evals
  )
  select
    coalesce((select avg((replay_intent = 'yes')::int) from evals), 0) >= 0.5,
    coalesce((select avg(('시간 약속을 잘 지켜요' = any(positive_tags))::int) from evals), 0) >= 0.5,
    coalesce((select avg(('소통이 편해요' = any(positive_tags))::int) from evals), 0) >= 0.5,
    coalesce((select avg(('끝까지 함께 플레이했어요' = any(positive_tags))::int) from evals), 0) >= 0.5,
    coalesce((select avg(('초보를 배려해요' = any(positive_tags))::int) from evals), 0) >= 0.5,
    (auth.uid() = target_user_id or (select n from total) >= 10)
  from total;
$$;

grant execute on function public.get_trust_badges(uuid) to authenticated;

-- ============================================================
-- 4. Play record — counts and an average, no evaluation content at all.
-- ============================================================

create or replace function public.get_play_record(target_user_id uuid)
returns table (completed_total int, completed_last_30d int, avg_party_size numeric)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::int,
    count(*) filter (where p.completed_at >= now() - interval '30 days')::int,
    coalesce(round(avg(p.current_members), 1), 0)
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  where pm.user_id = target_user_id
    and pm.status = 'accepted'
    and p.status = 'completed';
$$;

grant execute on function public.get_play_record(uuid) to authenticated;

-- ============================================================
-- 5. Recent activity — titles only, no evaluation detail, no reviewer info.
-- ============================================================

create or replace function public.get_recent_activity(target_user_id uuid, limit_count int default 5)
returns table (party_id uuid, title text, game_name text, completed_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.title, g.name, p.completed_at
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  join public.games g on g.id = p.game_id
  where pm.user_id = target_user_id
    and pm.status = 'accepted'
    and p.status = 'completed'
  order by p.completed_at desc nulls last
  limit limit_count;
$$;

grant execute on function public.get_recent_activity(uuid, int) to authenticated;
