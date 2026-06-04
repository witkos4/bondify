drop policy if exists "game_rounds_update_for_team_members" on public.game_rounds;
drop policy if exists "game_rounds_update_for_member_lifecycle" on public.game_rounds;
drop policy if exists "game_rounds_update_for_team_owner_history_clear" on public.game_rounds;

create policy "game_rounds_update_for_member_lifecycle"
  on public.game_rounds
  for update
  to authenticated
  using (
    history_cleared_at is null
    and public.is_team_member(team_id, public.current_profile_id())
  )
  with check (
    history_cleared_at is null
    and public.is_team_member(team_id, public.current_profile_id())
  );

create policy "game_rounds_update_for_team_owner_history_clear"
  on public.game_rounds
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.teams
      where teams.id = game_rounds.team_id
        and teams.created_by = public.current_profile_id()
    )
  )
  with check (
    exists (
      select 1
      from public.teams
      where teams.id = game_rounds.team_id
        and teams.created_by = public.current_profile_id()
    )
  );

with first_responses as (
  select
    round_id,
    min(created_at) as first_response_at
  from public.game_responses
  group by round_id
)
update public.game_rounds as rounds
set history_visible_until = first_responses.first_response_at + interval '30 days'
from first_responses
cross join public.game_templates templates
where rounds.id = first_responses.round_id
  and templates.id = rounds.game_template_id
  and templates.is_history_enabled = true
  and rounds.history_visible_until is null;
