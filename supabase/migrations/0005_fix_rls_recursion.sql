-- 0004's parties_select_scoped policy queries party_members, whose own
-- select/update policies query parties back — Postgres detects that as
-- infinite recursion. Fix: route both directions through SECURITY DEFINER
-- helper functions, which bypass RLS internally (table owner exemption)
-- instead of re-entering the other table's policy evaluation.

create or replace function public.is_party_host(target_party_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.parties
    where id = target_party_id and host_id = auth.uid()
  );
$$;

grant execute on function public.is_party_host(uuid) to authenticated;

create or replace function public.is_party_participant(target_party_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.party_members
    where party_id = target_party_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_party_participant(uuid) to authenticated;

drop policy "parties_select_scoped" on public.parties;
create policy "parties_select_scoped" on public.parties
  for select to authenticated using (
    status in ('recruiting', 'in_progress')
    or host_id = auth.uid()
    or public.is_party_participant(id)
  );

drop policy "party_members_select" on public.party_members;
create policy "party_members_select" on public.party_members
  for select to authenticated using (
    status = 'accepted'
    or user_id = auth.uid()
    or public.is_party_host(party_id)
  );

drop policy "party_members_update" on public.party_members;
create policy "party_members_update" on public.party_members
  for update to authenticated using (
    user_id = auth.uid() or public.is_party_host(party_id)
  ) with check (
    user_id = auth.uid() or public.is_party_host(party_id)
  );
