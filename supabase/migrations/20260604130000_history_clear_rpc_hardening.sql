drop policy if exists "game_rounds_update_for_team_owner_history_clear" on public.game_rounds;

create or replace function public.clear_team_history(team_uuid uuid)
returns table(cleared_count integer, cleared_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_uuid uuid := public.current_profile_id();
  clear_timestamp timestamptz := now();
begin
  if current_profile_uuid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = team_uuid
      and created_by = current_profile_uuid
  ) then
    raise exception 'Only the team owner can clear team history';
  end if;

  if not public.is_team_member(team_uuid, current_profile_uuid) then
    raise exception 'You do not have access to this team';
  end if;

  update public.game_rounds as rounds
  set history_cleared_at = clear_timestamp
  from public.game_templates as templates
  where templates.id = rounds.game_template_id
    and rounds.team_id = team_uuid
    and rounds.status = 'revealed'
    and templates.is_history_enabled = true
    and rounds.history_visible_until is not null
    and rounds.history_visible_until >= clear_timestamp
    and rounds.history_cleared_at is null;

  get diagnostics cleared_count = row_count;
  cleared_at := clear_timestamp;
  return next;
end;
$$;

create or replace function public.clear_team_history_entry(team_uuid uuid, round_uuid uuid)
returns table(cleared_count integer, cleared_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_uuid uuid := public.current_profile_id();
  clear_timestamp timestamptz := now();
begin
  if current_profile_uuid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = team_uuid
      and created_by = current_profile_uuid
  ) then
    raise exception 'Only the team owner can clear team history';
  end if;

  if not public.is_team_member(team_uuid, current_profile_uuid) then
    raise exception 'You do not have access to this team';
  end if;

  update public.game_rounds as rounds
  set history_cleared_at = clear_timestamp
  from public.game_templates as templates
  where templates.id = rounds.game_template_id
    and rounds.id = round_uuid
    and rounds.team_id = team_uuid
    and rounds.status = 'revealed'
    and templates.is_history_enabled = true
    and rounds.history_visible_until is not null
    and rounds.history_visible_until >= clear_timestamp
    and rounds.history_cleared_at is null;

  get diagnostics cleared_count = row_count;
  cleared_at := clear_timestamp;
  return next;
end;
$$;

revoke execute on function public.clear_team_history(uuid) from public;
revoke execute on function public.clear_team_history_entry(uuid, uuid) from public;
revoke execute on function public.clear_team_history(uuid) from anon;
revoke execute on function public.clear_team_history_entry(uuid, uuid) from anon;
revoke execute on function public.clear_team_history(uuid) from service_role;
revoke execute on function public.clear_team_history_entry(uuid, uuid) from service_role;

grant execute on function public.clear_team_history(uuid) to authenticated;
grant execute on function public.clear_team_history_entry(uuid, uuid) to authenticated;
