-- Backfill: the "신비한 보드게임" suggestion was approved before the
-- approval action actually created a row in public.games.
insert into public.games (name, is_official)
select submitted_name, true
from public.custom_game_suggestions
where status = 'approved'
on conflict (name) do nothing;
