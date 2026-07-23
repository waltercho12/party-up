-- Party-up MVP schema — round 7 (follow-up fixes)
--
-- 1) Admins can read any party regardless of status (fixes 404s when
--    reviewing old custom-game-suggestion links to cancelled/completed
--    parties they weren't part of).
-- 2) Promotion now moves one tier at a time, symmetric with demotion.
-- 3) Public percentage stats are withheld until a user has at least 10
--    evaluations, to protect newcomers from a single early bad review
--    following them around publicly; the user themselves can always see
--    their own numbers.

-- ============================================================
-- 1. Admin read access to parties
-- ============================================================

create policy "parties_select_admin" on public.parties
  for select to authenticated using (public.is_admin());

-- ============================================================
-- 2 & 3. Reputation recompute: step-wise promotion + total_evaluations
-- ============================================================

alter table public.reputation_tiers
  add column total_evaluations int not null default 0;

create or replace function public.reputation_tier_from_rank(r int)
returns text
language sql immutable
as $$
  select case r
    when 0 then 'traveler'
    when 1 then 'mate'
    when 2 then 'friend'
    when 3 then 'guide'
    when 4 then 'companion'
    else 'companion'
  end;
$$;

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
  total_evaluations_ct int;
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

  select count(*), count(distinct party_id) into total_evaluations_ct, completed_parties_ct
  from public.manner_evaluations where reviewee_id = target;

  select count(distinct reviewer_id) into distinct_reviewers_ct
  from public.manner_evaluations where reviewee_id = target;

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

  -- Promotion moves one tier at a time too, same as demotion — a big batch
  -- of history (or a backfill) climbs gradually across recomputes instead
  -- of jumping straight to the top.
  if demote_to is not null then
    new_tier := demote_to;
  elsif eligible_rank > current_rank then
    new_tier := public.reputation_tier_from_rank(current_rank + 1);
  else
    new_tier := current_tier;
  end if;

  select
    coalesce(avg(('시간 약속을 잘 지켜요' = any(positive_tags))::int), 0) * 100,
    coalesce(avg(('분위기를 좋게 만들어요' = any(positive_tags))::int), 0) * 100,
    coalesce(avg(('끝까지 함께 플레이했어요' = any(positive_tags))::int), 0) * 100
  into punctual_pct, atmosphere_pct, stayed_full_pct
  from public.manner_evaluations
  where reviewee_id = target;

  insert into public.reputation_tiers (
    user_id, tier, internal_score, completed_parties, replay_ratio,
    punctual_pct, atmosphere_pct, stayed_full_pct, total_evaluations, updated_at
  )
  values (
    target, new_tier, score, completed_parties_ct, replay_ratio_alltime,
    punctual_pct, atmosphere_pct, stayed_full_pct, total_evaluations_ct, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    internal_score = excluded.internal_score,
    completed_parties = excluded.completed_parties,
    replay_ratio = excluded.replay_ratio,
    punctual_pct = excluded.punctual_pct,
    atmosphere_pct = excluded.atmosphere_pct,
    stayed_full_pct = excluded.stayed_full_pct,
    total_evaluations = excluded.total_evaluations,
    updated_at = now();
end;
$$;

-- Public summary: percentages are withheld until 10+ evaluations, except
-- to the user themselves (auth.uid() = target_user_id), so nobody gets
-- publicly stuck at "0%" off a single early review.
drop function if exists public.get_reputation_summary(uuid);

create function public.get_reputation_summary(target_user_id uuid)
returns table (
  tier text,
  completed_parties int,
  replay_ratio_pct numeric,
  punctual_pct numeric,
  atmosphere_pct numeric,
  stayed_full_pct numeric,
  stats_visible boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(rt.tier, 'traveler'),
    coalesce(rt.completed_parties, 0),
    case when auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10
      then coalesce(round(rt.replay_ratio * 100), 0) end,
    case when auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10
      then coalesce(round(rt.punctual_pct), 0) end,
    case when auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10
      then coalesce(round(rt.atmosphere_pct), 0) end,
    case when auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10
      then coalesce(round(rt.stayed_full_pct), 0) end,
    (auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10)
  from (select target_user_id as id) t
  left join public.reputation_tiers rt on rt.user_id = t.id;
$$;

grant execute on function public.get_reputation_summary(uuid) to authenticated;

-- Backfill under the new step-wise + total_evaluations logic.
select public.recompute_reputation_tier(user_id) from public.reputation_tiers;
