-- Party-up MVP schema — round 4
-- Recruiting posts that never get any host action would otherwise sit
-- forever. Auto-cancel them after a TTL (default 60 minutes), reusing the
-- 'cancelled' status since it's already hidden from public browsing and
-- kept for host/participant/admin visibility only. The TTL lives in a
-- tiny admin-only settings table so it can be changed later without a new
-- migration — just update the row.

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- No RLS policies at all: admin-only via the dashboard / direct DB access,
-- same posture as reputation_tiers.
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values ('party_recruiting_ttl_minutes', '60')
on conflict (key) do nothing;

create or replace function public.expire_stale_parties()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ttl_minutes int;
begin
  select value::int into ttl_minutes from public.app_settings where key = 'party_recruiting_ttl_minutes';
  if ttl_minutes is null then
    ttl_minutes := 60;
  end if;

  with expired as (
    update public.parties
      set status = 'cancelled'
      where status = 'recruiting'
        and created_at < now() - (ttl_minutes || ' minutes')::interval
      returning id, host_id
  )
  insert into public.notifications (user_id, type, party_id, actor_id)
  select host_id, 'party_expired', id, null from expired;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'expire-stale-parties',
  '*/5 * * * *',
  $$ select public.expire_stale_parties(); $$
);
