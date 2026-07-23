-- Follow-up to 0013: expose total_evaluations (a plain count, not a
-- quality signal) from get_reputation_summary so the profile owner can see
-- "N more until this is public" before the 10-evaluation visibility cutoff.

drop function if exists public.get_reputation_summary(uuid);

create function public.get_reputation_summary(target_user_id uuid)
returns table (
  tier text,
  completed_parties int,
  replay_ratio_pct numeric,
  punctual_pct numeric,
  atmosphere_pct numeric,
  stayed_full_pct numeric,
  stats_visible boolean,
  total_evaluations int
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
    (auth.uid() = target_user_id or coalesce(rt.total_evaluations, 0) >= 10),
    coalesce(rt.total_evaluations, 0)
  from (select target_user_id as id) t
  left join public.reputation_tiers rt on rt.user_id = t.id;
$$;

grant execute on function public.get_reputation_summary(uuid) to authenticated;
