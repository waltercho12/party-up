-- Admin-only aggregate stats for the Support dashboard. Guarded explicitly
-- (not just by grant) since it's SECURITY DEFINER and would otherwise leak
-- ticket volume to any authenticated caller.
create or replace function public.get_support_dashboard_stats()
returns table (
  today_created int,
  unresolved int,
  in_progress int,
  today_resolved int,
  avg_resolution_hours numeric,
  week_satisfaction_pct numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    (select count(*)::int from public.support_tickets where created_at >= date_trunc('day', now())),
    (select count(*)::int from public.support_tickets where status in ('open', 'in_review', 'in_progress')),
    (select count(*)::int from public.support_tickets where status = 'in_progress'),
    (select count(*)::int
       from public.support_history h
       where h.event_type = 'status_changed'
         and h.metadata->>'to' = 'resolved'
         and h.created_at >= date_trunc('day', now())),
    (select round(avg(extract(epoch from (h.created_at - t.created_at)) / 3600), 1)
       from public.support_tickets t
       join public.support_history h
         on h.ticket_id = t.id and h.event_type = 'status_changed' and h.metadata->>'to' = 'resolved'
       where t.created_at >= now() - interval '30 days'),
    (select round(100.0 * avg((f.helpful)::int), 0)
       from public.support_feedback f
       where f.created_at >= now() - interval '7 days');
end;
$$;

grant execute on function public.get_support_dashboard_stats() to authenticated;
