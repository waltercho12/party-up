-- Party-up MVP schema — round 6 (Playo-style manner evaluation refactor)
--
-- Evaluations no longer judge "the person" via a flat tag list — they judge
-- "the experience of having played together", anchored on a single required
-- question (would I play with them again?) plus optional supporting detail.
-- Repeated evaluations from the same reviewer are never discarded (repeat
-- play is meaningful signal on this platform) but their influence decays.
-- Promotion looks at all-time decayed trust; demotion looks only at the
-- most recent 20 evaluations, moves at most one tier at a time, and is
-- fully recoverable through renewed good behavior.

-- ============================================================
-- 1. manner_evaluations: replace the flat `tags` column with a required
--    replay-intent answer + separated positive/negative tag lists + a
--    reviewer-only private comment.
-- ============================================================

alter table public.manner_evaluations
  add column replay_intent text,
  add column positive_tags text[] not null default '{}',
  add column negative_tags text[] not null default '{}',
  add column comment text;

update public.manner_evaluations set replay_intent = 'neutral' where replay_intent is null;

alter table public.manner_evaluations
  alter column replay_intent set not null,
  add constraint manner_evaluations_replay_intent_check
    check (replay_intent in ('yes', 'neutral', 'no'));

alter table public.manner_evaluations drop column tags;

-- The comment is explicitly private to the reviewer who wrote it — nobody
-- else (including the reviewee) may read raw evaluation rows at all.
-- Reviewees only ever see aggregated, non-attributable stats via the RPCs
-- below, so column-level hiding isn't needed on top of this.
drop policy "manner_eval_select_own" on public.manner_evaluations;
create policy "manner_eval_select_reviewer_only" on public.manner_evaluations
  for select to authenticated using (reviewer_id = auth.uid());

drop policy "manner_eval_insert" on public.manner_evaluations;
create policy "manner_eval_insert" on public.manner_evaluations
  for insert to authenticated with check (
    reviewer_id = auth.uid()
    and reviewer_id <> reviewee_id
    and positive_tags <@ array[
      '시간 약속을 잘 지켜요', '분위기를 좋게 만들어요', '소통이 편해요',
      '끝까지 함께 플레이했어요', '초보를 배려해요'
    ]::text[]
    and negative_tags <@ array[
      '소통이 어려웠어요', '약속 시간에 늦었어요',
      '약속 없이 중간에 나갔어요', '욕설 또는 비매너가 있었어요', '신고가 필요해요'
    ]::text[]
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

-- ============================================================
-- 2. reputation_tiers: cache the handful of fields we're allowed to show
--    publicly, so the profile page doesn't need to recompute them.
-- ============================================================

alter table public.reputation_tiers
  add column completed_parties int not null default 0,
  add column replay_ratio numeric not null default 0,
  add column punctual_pct numeric not null default 0,
  add column atmosphere_pct numeric not null default 0,
  add column stayed_full_pct numeric not null default 0;

-- ============================================================
-- 3. Tier ranking helper (traveler < mate < friend < guide < companion)
-- ============================================================

create or replace function public.reputation_tier_rank(t text)
returns int
language sql immutable
as $$
  select case t
    when 'traveler' then 0
    when 'mate' then 1
    when 'friend' then 2
    when 'guide' then 3
    when 'companion' then 4
    else 0
  end;
$$;

-- ============================================================
-- 4. Recompute: decayed all-time trust drives promotion, recent-20 raw
--    behavior drives demotion (at most one tier per recompute).
-- ============================================================

create or replace function public.recompute_reputation_tier(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tier text;
  current_rank int;
  completed_parties_ct int;
  distinct_reviewers_ct int;
  total_weight numeric;
  weighted_yes numeric;
  weighted_neutral numeric;
  weighted_no numeric;
  replay_ratio_alltime numeric;
  weighted_positive numeric;
  weighted_negative numeric;
  replay_score numeric;
  score numeric;
  eligible_tier text;
  eligible_rank int;
  recent_total int;
  recent_yes int;
  recent_replay_ratio numeric;
  recent_critical_ct int;
  demote_to text;
  new_tier text;
  punctual_pct numeric;
  atmosphere_pct numeric;
  stayed_full_pct numeric;
  positive_tags_all text[] := array[
    '시간 약속을 잘 지켜요', '분위기를 좋게 만들어요', '소통이 편해요',
    '끝까지 함께 플레이했어요', '초보를 배려해요'
  ];
  minor_tags text[] := array['소통이 어려웠어요'];
  major_tags text[] := array['약속 시간에 늦었어요'];
  critical_tags text[] := array[
    '약속 없이 중간에 나갔어요', '욕설 또는 비매너가 있었어요', '신고가 필요해요'
  ];
begin
  select coalesce(tier, 'traveler') into current_tier
  from public.reputation_tiers where user_id = target;
  if current_tier is null then
    current_tier := 'traveler';
  end if;
  current_rank := public.reputation_tier_rank(current_tier);

  select count(distinct party_id) into completed_parties_ct
  from public.manner_evaluations where reviewee_id = target;

  select count(distinct reviewer_id) into distinct_reviewers_ct
  from public.manner_evaluations where reviewee_id = target;

  -- All-time trust, decayed per reviewer so a single relationship can't
  -- dominate the score the way a broad base of distinct reviewers can.
  with decayed as (
    select
      replay_intent, positive_tags, negative_tags,
      case row_number() over (partition by reviewer_id order by created_at)
        when 1 then 1.0
        when 2 then 0.8
        when 3 then 0.65
        when 4 then 0.55
        when 5 then 0.45
        else 0.4
      end as decay
    from public.manner_evaluations
    where reviewee_id = target
  )
  select
    coalesce(sum(decay), 0),
    coalesce(sum(decay) filter (where replay_intent = 'yes'), 0),
    coalesce(sum(decay) filter (where replay_intent = 'neutral'), 0),
    coalesce(sum(decay) filter (where replay_intent = 'no'), 0),
    coalesce(sum(decay * cardinality(array(
      select unnest(positive_tags) intersect select unnest(positive_tags_all)
    ))), 0),
    coalesce(sum(decay * (
      cardinality(array(select unnest(negative_tags) intersect select unnest(minor_tags))) * 1
      + cardinality(array(select unnest(negative_tags) intersect select unnest(major_tags))) * 2
      + cardinality(array(select unnest(negative_tags) intersect select unnest(critical_tags))) * 5
    )), 0)
  into total_weight, weighted_yes, weighted_neutral, weighted_no, weighted_positive, weighted_negative
  from decayed;

  replay_ratio_alltime := case when total_weight = 0 then 0 else weighted_yes / total_weight end;
  replay_score := (weighted_yes * 10) + (weighted_neutral * 3) - (weighted_no * 10);
  score := (distinct_reviewers_ct * 2) + completed_parties_ct + replay_score + weighted_positive - weighted_negative;

  eligible_tier := case
    when completed_parties_ct >= 15 and distinct_reviewers_ct >= 9 and replay_ratio_alltime >= 0.90 then 'companion'
    when completed_parties_ct >= 10 and distinct_reviewers_ct >= 6 and replay_ratio_alltime >= 0.80 then 'guide'
    when completed_parties_ct >= 6  and distinct_reviewers_ct >= 4 and replay_ratio_alltime >= 0.70 then 'friend'
    when completed_parties_ct >= 3  and distinct_reviewers_ct >= 2 and replay_ratio_alltime >= 0.60 then 'mate'
    else 'traveler'
  end;
  eligible_rank := public.reputation_tier_rank(eligible_tier);

  -- Recent behavior, raw (undecayed) — demotion looks at what's happening
  -- lately, not the full history that got someone to their current tier.
  with recent as (
    select replay_intent, negative_tags
    from public.manner_evaluations
    where reviewee_id = target
    order by created_at desc
    limit 20
  )
  select
    count(*),
    count(*) filter (where replay_intent = 'yes'),
    coalesce(sum(cardinality(array(select unnest(negative_tags) intersect select unnest(critical_tags)))), 0)
  into recent_total, recent_yes, recent_critical_ct
  from recent;

  recent_replay_ratio := case when recent_total = 0 then null else recent_yes::numeric / recent_total end;

  demote_to := null;
  if recent_total > 0 then
    if current_tier = 'companion' and (recent_replay_ratio < 0.80 or recent_critical_ct >= 3) then
      demote_to := 'guide';
    elsif current_tier = 'guide' and (recent_replay_ratio < 0.70 or recent_critical_ct >= 4) then
      demote_to := 'friend';
    elsif current_tier = 'friend' and (recent_replay_ratio < 0.60 or recent_critical_ct >= 5) then
      demote_to := 'mate';
    elsif current_tier = 'mate' and (recent_replay_ratio < 0.50 or recent_critical_ct >= 6) then
      demote_to := 'traveler';
    end if;
  end if;

  if demote_to is not null then
    new_tier := demote_to;
  elsif eligible_rank > current_rank then
    new_tier := eligible_tier;
  else
    new_tier := current_tier;
  end if;

  -- Public transparency stats: plain, undecayed shares of all evaluations
  -- received. These (plus tier + completed_parties + replay ratio) are the
  -- only reputation-derived numbers ever shown to users.
  select
    coalesce(avg(('시간 약속을 잘 지켜요' = any(positive_tags))::int), 0) * 100,
    coalesce(avg(('분위기를 좋게 만들어요' = any(positive_tags))::int), 0) * 100,
    coalesce(avg(('끝까지 함께 플레이했어요' = any(positive_tags))::int), 0) * 100
  into punctual_pct, atmosphere_pct, stayed_full_pct
  from public.manner_evaluations
  where reviewee_id = target;

  insert into public.reputation_tiers (
    user_id, tier, internal_score, completed_parties, replay_ratio,
    punctual_pct, atmosphere_pct, stayed_full_pct, updated_at
  )
  values (
    target, new_tier, score, completed_parties_ct, replay_ratio_alltime,
    punctual_pct, atmosphere_pct, stayed_full_pct, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    internal_score = excluded.internal_score,
    completed_parties = excluded.completed_parties,
    replay_ratio = excluded.replay_ratio,
    punctual_pct = excluded.punctual_pct,
    atmosphere_pct = excluded.atmosphere_pct,
    stayed_full_pct = excluded.stayed_full_pct,
    updated_at = now();
end;
$$;

-- ============================================================
-- 5. Public read surface: tier label only (unchanged signature) and a new
--    richer summary RPC for the profile page. Both SECURITY DEFINER, both
--    return derived numbers only — never the internal score or raw rows.
-- ============================================================

create or replace function public.get_reputation_tier(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select tier from public.reputation_tiers where user_id = target_user_id),
    'traveler'
  );
$$;

create or replace function public.get_reputation_summary(target_user_id uuid)
returns table (
  tier text,
  completed_parties int,
  replay_ratio_pct numeric,
  punctual_pct numeric,
  atmosphere_pct numeric,
  stayed_full_pct numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(rt.tier, 'traveler'),
    coalesce(rt.completed_parties, 0),
    coalesce(round(rt.replay_ratio * 100), 0),
    coalesce(round(rt.punctual_pct), 0),
    coalesce(round(rt.atmosphere_pct), 0),
    coalesce(round(rt.stayed_full_pct), 0)
  from (select target_user_id as id) t
  left join public.reputation_tiers rt on rt.user_id = t.id;
$$;

grant execute on function public.get_reputation_summary(uuid) to authenticated;

-- Backfill: recompute everyone under the new algorithm so cached public
-- stats (completed_parties, replay_ratio, ...) aren't stuck at defaults.
select public.recompute_reputation_tier(user_id) from public.reputation_tiers;
