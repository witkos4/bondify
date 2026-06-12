create or replace function public.remove_team_member(team_uuid uuid, membership_uuid uuid)
returns table(
  team_id uuid,
  membership_id uuid,
  removed_profile_id uuid,
  removed_email text,
  removed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_uuid uuid := public.current_profile_id();
  team_owner_uuid uuid;
  membership_row public.team_memberships%rowtype;
  removed_timestamp timestamptz := now();
begin
  if current_profile_uuid is null then
    raise exception 'Not authenticated';
  end if;

  select teams.created_by
  into team_owner_uuid
  from public.teams as teams
  where teams.id = team_uuid;

  if team_owner_uuid is null then
    raise exception 'Team not found';
  end if;

  if team_owner_uuid <> current_profile_uuid then
    raise exception 'Only the team owner can manage this team';
  end if;

  if not public.is_team_member(team_uuid, current_profile_uuid) then
    raise exception 'You do not have access to this team';
  end if;

  select memberships.*
  into membership_row
  from public.team_memberships as memberships
  where memberships.id = membership_uuid
    and memberships.team_id = team_uuid
    and memberships.removed_at is null
  for update;

  if membership_row.id is null then
    return;
  end if;

  if membership_row.profile_id = team_owner_uuid then
    raise exception 'Team owner membership cannot be removed';
  end if;

  update public.team_memberships as memberships
  set removed_at = removed_timestamp
  where memberships.id = membership_uuid;

  return query
  select
    membership_row.team_id,
    membership_row.id,
    membership_row.profile_id,
    profiles.email,
    removed_timestamp
  from public.profiles as profiles
  where profiles.id = membership_row.profile_id;
end;
$$;
