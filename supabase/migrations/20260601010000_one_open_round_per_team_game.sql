create unique index if not exists game_rounds_unique_open_team_template
  on public.game_rounds (team_id, game_template_id)
  where status = 'open';
