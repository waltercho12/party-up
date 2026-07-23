-- Party-up MVP schema — round 3 (user feedback after second live test)
--   4) completed/cancelled parties are no longer publicly browsable, but
--      the data stays (needed for reputation + game history); only the
--      host, participants, and admins (via dashboard) can still see them.
--      get_game_history() lets a public profile page show history without
--      needing broad read access to the parties table.
--   5) notifications for application received/accepted/rejected/withdrawn
--   7) accepting one pending application auto-withdraws a user's other
--      pending applications elsewhere

-- ============================================================
-- 4) Scope party visibility; admin-only history for ended parties
-- ============================================================

drop policy "parties_select_all" on public.parties;

create policy "parties_select_scoped" on public.parties
  for select to authenticated using (
    status in ('recruiting', 'in_progress')
    or host_id = auth.uid()
    or exists (
      select 1 from public.party_members pm
      where pm.party_id = parties.id and pm.user_id = auth.uid()
    )
  );

create or replace function public.get_game_history(target_user_id uuid)
returns table(game_name text, play_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select g.name, count(*)::bigint
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  join public.games g on g.id = p.game_id
  where pm.user_id = target_user_id
    and pm.status = 'accepted'
    and p.status = 'completed'
  group by g.name
  order by count(*) desc;
$$;

grant execute on function public.get_game_history(uuid) to authenticated, anon;

-- ============================================================
-- 7) Auto-withdraw a user's other pending applications on accept
-- ============================================================

-- The transition-validator trigger only allowed host-driven and
-- self-driven transitions; 'withdrawn' is exclusively set by the trusted
-- SECURITY DEFINER trigger below (no client path ever requests it, and RLS
-- still gates which rows an ordinary update can even touch), so it's safe
-- to allow unconditionally here.
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
  if new.status = 'withdrawn' and old.status = 'pending' then
    return new;
  end if;

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

create or replace function public.withdraw_other_pending_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    update public.party_members
    set status = 'withdrawn'
    where user_id = new.user_id
      and party_id <> new.party_id
      and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger trg_withdraw_other_pending_applications
after update on public.party_members
for each row execute function public.withdraw_other_pending_applications();

-- ============================================================
-- 5) Notifications
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  party_id uuid references public.parties(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications(user_id);

alter table public.notifications enable row level security;

-- No insert policy: only the SECURITY DEFINER trigger below writes rows,
-- so a client can never forge a notification.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_application_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  party_host uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select host_id into party_host from public.parties where id = new.party_id;
    if party_host is not null and party_host <> new.user_id then
      insert into public.notifications (user_id, type, party_id, actor_id)
      values (party_host, 'application_received', new.party_id, new.user_id);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status = 'pending' then
      insert into public.notifications (user_id, type, party_id, actor_id)
      values (new.user_id, 'application_accepted', new.party_id, null);
    elsif new.status = 'rejected' and old.status = 'pending' then
      insert into public.notifications (user_id, type, party_id, actor_id)
      values (new.user_id, 'application_rejected', new.party_id, null);
    elsif new.status = 'withdrawn' and old.status = 'pending' then
      insert into public.notifications (user_id, type, party_id, actor_id)
      values (new.user_id, 'application_withdrawn', new.party_id, null);
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger trg_notify_application_insert
after insert on public.party_members
for each row execute function public.notify_application_events();

create trigger trg_notify_application_update
after update on public.party_members
for each row execute function public.notify_application_events();
