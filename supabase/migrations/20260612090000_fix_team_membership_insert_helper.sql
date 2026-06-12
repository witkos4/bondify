create or replace function public.can_insert_team_membership(team_uuid uuid, profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    profile_uuid = auth.uid()
    and (
      exists (
        select 1
        from public.teams
        where id = team_uuid
          and created_by = profile_uuid
      )
      or exists (
        select 1
        from public.team_invites invites
        join public.profiles invitee
          on invitee.id = profile_uuid
        where invites.team_id = team_uuid
          and (
            (
              invites.status = 'pending'
              and invites.normalized_email = invitee.normalized_email
            )
            or (
              invites.status = 'accepted'
              and invites.accepted_profile_id = profile_uuid
            )
          )
      )
    );
$$;

grant execute on function public.can_insert_team_membership(uuid, uuid) to authenticated;

drop policy if exists "team_memberships_insert_for_team_creator_or_invitee" on public.team_memberships;
create policy "team_memberships_insert_for_team_creator_or_invitee"
  on public.team_memberships
  for insert
  to authenticated
  with check (
    profile_id = public.current_profile_id()
    and removed_at is null
    and public.can_insert_team_membership(team_id, profile_id)
  );
