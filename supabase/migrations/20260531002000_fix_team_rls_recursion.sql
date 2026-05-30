create or replace function public.is_team_member(team_uuid uuid, profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships
    where team_id = team_uuid
      and profile_id = profile_uuid
  );
$$;

create or replace function public.shares_team_with_profile(current_profile_uuid uuid, target_profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships current_member
    join public.team_memberships teammate_member
      on teammate_member.team_id = current_member.team_id
    where current_member.profile_id = current_profile_uuid
      and teammate_member.profile_id = target_profile_uuid
  );
$$;

grant execute on function public.is_team_member(uuid, uuid) to authenticated;
grant execute on function public.shares_team_with_profile(uuid, uuid) to authenticated;

drop policy if exists "profiles_select_teammates" on public.profiles;
create policy "profiles_select_teammates"
  on public.profiles
  for select
  to authenticated
  using (
    id = public.current_profile_id()
    or public.shares_team_with_profile(public.current_profile_id(), id)
  );

drop policy if exists "teams_select_for_active_members" on public.teams;
create policy "teams_select_for_active_members"
  on public.teams
  for select
  to authenticated
  using (public.is_team_member(id, public.current_profile_id()));

drop policy if exists "team_memberships_select_for_team_members" on public.team_memberships;
create policy "team_memberships_select_for_team_members"
  on public.team_memberships
  for select
  to authenticated
  using (public.is_team_member(team_id, public.current_profile_id()));

drop policy if exists "team_invites_select_for_team_members_and_invitees" on public.team_invites;
create policy "team_invites_select_for_team_members_and_invitees"
  on public.team_invites
  for select
  to authenticated
  using (
    public.is_team_member(team_id, public.current_profile_id())
    or normalized_email = public.current_profile_normalized_email()
  );

drop policy if exists "team_invites_insert_for_active_members" on public.team_invites;
create policy "team_invites_insert_for_active_members"
  on public.team_invites
  for insert
  to authenticated
  with check (
    inviter_profile_id = public.current_profile_id()
    and status = 'pending'
    and accepted_profile_id is null
    and accepted_at is null
    and public.is_team_member(team_id, public.current_profile_id())
  );

drop policy if exists "team_invites_update_for_accepting_invitee" on public.team_invites;
create policy "team_invites_update_for_accepting_invitee"
  on public.team_invites
  for update
  to authenticated
  using (
    normalized_email = public.current_profile_normalized_email()
    or public.is_team_member(team_id, public.current_profile_id())
  )
  with check (
    (
      normalized_email = public.current_profile_normalized_email()
      and accepted_profile_id = public.current_profile_id()
      and status = 'accepted'
    )
    or (
      inviter_profile_id = public.current_profile_id()
      and status in ('revoked', 'expired')
    )
  );

drop policy if exists "game_rounds_select_for_team_members" on public.game_rounds;
create policy "game_rounds_select_for_team_members"
  on public.game_rounds
  for select
  to authenticated
  using (public.is_team_member(team_id, public.current_profile_id()));

drop policy if exists "game_rounds_insert_for_team_members" on public.game_rounds;
create policy "game_rounds_insert_for_team_members"
  on public.game_rounds
  for insert
  to authenticated
  with check (
    opened_by_profile_id = public.current_profile_id()
    and public.is_team_member(team_id, public.current_profile_id())
  );

drop policy if exists "game_rounds_update_for_team_members" on public.game_rounds;
create policy "game_rounds_update_for_team_members"
  on public.game_rounds
  for update
  to authenticated
  using (public.is_team_member(team_id, public.current_profile_id()))
  with check (public.is_team_member(team_id, public.current_profile_id()));

drop policy if exists "game_responses_select_for_team_members" on public.game_responses;
create policy "game_responses_select_for_team_members"
  on public.game_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = game_responses.round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

drop policy if exists "game_responses_insert_for_active_member_once" on public.game_responses;
create policy "game_responses_insert_for_active_member_once"
  on public.game_responses
  for insert
  to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.team_memberships memberships
      join public.game_rounds rounds
        on rounds.team_id = memberships.team_id
      where memberships.id = game_responses.membership_id
        and memberships.profile_id = public.current_profile_id()
        and rounds.id = game_responses.round_id
        and rounds.status = 'open'
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );
