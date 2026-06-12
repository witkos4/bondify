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

  select created_by
  into team_owner_uuid
  from public.teams
  where id = team_uuid;

  if team_owner_uuid is null then
    raise exception 'Team not found';
  end if;

  if team_owner_uuid <> current_profile_uuid then
    raise exception 'Only the team owner can manage this team';
  end if;

  if not public.is_team_member(team_uuid, current_profile_uuid) then
    raise exception 'You do not have access to this team';
  end if;

  select *
  into membership_row
  from public.team_memberships
  where id = membership_uuid
    and team_id = team_uuid
    and removed_at is null
  for update;

  if membership_row.id is null then
    return;
  end if;

  if membership_row.profile_id = team_owner_uuid then
    raise exception 'Team owner membership cannot be removed';
  end if;

  update public.team_memberships
  set removed_at = removed_timestamp
  where id = membership_uuid;

  return query
  select
    membership_row.team_id,
    membership_row.id,
    membership_row.profile_id,
    profiles.email,
    removed_timestamp
  from public.profiles
  where profiles.id = membership_row.profile_id;
end;
$$;

create or replace function public.delete_owned_team(team_uuid uuid)
returns table(
  deleted_team_id uuid,
  deleted_team_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_uuid uuid := public.current_profile_id();
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
    raise exception 'Only the team owner can delete this team';
  end if;

  if not public.is_team_member(team_uuid, current_profile_uuid) then
    raise exception 'You do not have access to this team';
  end if;

  return query
  delete from public.teams
  where id = team_uuid
    and created_by = current_profile_uuid
  returning id, name;
end;
$$;

revoke execute on function public.remove_team_member(uuid, uuid) from public;
revoke execute on function public.remove_team_member(uuid, uuid) from anon;
revoke execute on function public.remove_team_member(uuid, uuid) from service_role;
revoke execute on function public.delete_owned_team(uuid) from public;
revoke execute on function public.delete_owned_team(uuid) from anon;
revoke execute on function public.delete_owned_team(uuid) from service_role;

grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.delete_owned_team(uuid) to authenticated;
