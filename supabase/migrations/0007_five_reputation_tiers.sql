-- Party-up MVP schema — round 5
-- Expand reputation from 3 tiers to 5: 여행자 < 동료 < 친구 < 길잡이 < 동반자.
-- `tier` is plain text (not an enum), so this is just new values + new
-- thresholds — no ALTER TYPE needed. Existing rows are backfilled at the
-- end so nobody is stuck on the old 'seedling'/'trusted'/'regular' labels.

alter table public.reputation_tiers alter column tier set default 'traveler';

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
    when completed_parties >= 15 and distinct_reviewers >= 9 and positive_ratio >= 0.85 then 'companion'
    when completed_parties >= 10 and distinct_reviewers >= 6 and positive_ratio >= 0.75 then 'guide'
    when completed_parties >= 6 and distinct_reviewers >= 4 and positive_ratio >= 0.70 then 'friend'
    when completed_parties >= 3 and distinct_reviewers >= 2 and positive_ratio >= 0.60 then 'mate'
    else 'traveler'
  end;

  insert into public.reputation_tiers (user_id, tier, internal_score, updated_at)
  values (target, new_tier, score, now())
  on conflict (user_id) do update
    set tier = excluded.tier, internal_score = excluded.internal_score, updated_at = now();
end;
$$;

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

-- Backfill: recompute everyone who already has a row so nobody is left on
-- the old 3-tier labels.
select public.recompute_reputation_tier(user_id) from public.reputation_tiers;
