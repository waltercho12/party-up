create policy "games_insert_admin" on public.games
  for insert to authenticated with check (public.is_admin());
