alter table public.team_memberships
  add column if not exists removed_at timestamptz;

alter table public.team_memberships
  drop constraint if exists team_memberships_team_id_profile_id_key;

drop index if exists public.team_memberships_profile_id_idx;

create unique index if not exists team_memberships_active_team_profile_unique
  on public.team_memberships (team_id, profile_id)
  where removed_at is null;

create index if not exists team_memberships_profile_id_idx
  on public.team_memberships (profile_id)
  where removed_at is null;

create index if not exists team_memberships_team_active_created_idx
  on public.team_memberships (team_id, created_at)
  where removed_at is null;

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
      and removed_at is null
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
      and current_member.removed_at is null
      and teammate_member.profile_id = target_profile_uuid
  );
$$;

grant execute on function public.is_team_member(uuid, uuid) to authenticated;
grant execute on function public.shares_team_with_profile(uuid, uuid) to authenticated;

drop policy if exists "team_memberships_select_for_team_members" on public.team_memberships;
create policy "team_memberships_select_for_team_members"
  on public.team_memberships
  for select
  to authenticated
  using (
    public.is_team_member(team_id, public.current_profile_id())
    and removed_at is null
  );

drop policy if exists "team_memberships_insert_for_team_creator_or_invitee" on public.team_memberships;
create policy "team_memberships_insert_for_team_creator_or_invitee"
  on public.team_memberships
  for insert
  to authenticated
  with check (
    profile_id = public.current_profile_id()
    and removed_at is null
    and (
      exists (
        select 1
        from public.teams
        where teams.id = team_memberships.team_id
          and teams.created_by = public.current_profile_id()
      )
      or exists (
        select 1
        from public.team_invites invites
        where invites.team_id = team_memberships.team_id
          and invites.status = 'pending'
          and invites.normalized_email = public.current_profile_normalized_email()
      )
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
        and memberships.removed_at is null
        and rounds.id = game_responses.round_id
        and rounds.status = 'open'
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

drop policy if exists "emoji_check_in_submissions_insert_for_current_member_once" on public.emoji_check_in_submissions;
create policy "emoji_check_in_submissions_insert_for_current_member_once"
  on public.emoji_check_in_submissions
  for insert
  to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.emoji_check_in_sessions sessions
      join public.team_memberships memberships
        on memberships.team_id = sessions.team_id
      where sessions.id = emoji_check_in_submissions.session_id
        and sessions.status = 'open'
        and memberships.id = emoji_check_in_submissions.membership_id
        and memberships.profile_id = public.current_profile_id()
        and memberships.removed_at is null
    )
  );

drop policy if exists "two_truths_entries_insert_for_collecting_member_once" on public.two_truths_entries;
create policy "two_truths_entries_insert_for_collecting_member_once"
  on public.two_truths_entries
  for insert
  to authenticated
  with check (
    author_profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.team_memberships memberships
      join public.game_rounds rounds
        on rounds.team_id = memberships.team_id
      join public.two_truths_rounds structured_round
        on structured_round.game_round_id = rounds.id
      where memberships.id = two_truths_entries.author_membership_id
        and memberships.profile_id = public.current_profile_id()
        and memberships.removed_at is null
        and rounds.id = two_truths_entries.game_round_id
        and rounds.status = 'open'
        and structured_round.phase = 'collecting'
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

drop policy if exists "two_truths_guesses_insert_for_voting_member_once" on public.two_truths_guesses;
create policy "two_truths_guesses_insert_for_voting_member_once"
  on public.two_truths_guesses
  for insert
  to authenticated
  with check (
    voter_profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.team_memberships memberships
      join public.game_rounds rounds
        on rounds.team_id = memberships.team_id
      join public.two_truths_rounds structured_round
        on structured_round.game_round_id = rounds.id
      join public.two_truths_entries target_entry
        on target_entry.id = two_truths_guesses.target_entry_id
       and target_entry.game_round_id = rounds.id
      where memberships.id = two_truths_guesses.voter_membership_id
        and memberships.profile_id = public.current_profile_id()
        and memberships.removed_at is null
        and rounds.id = two_truths_guesses.game_round_id
        and rounds.status = 'open'
        and structured_round.phase = 'voting'
        and target_entry.included_in_voting = true
        and target_entry.author_membership_id <> memberships.id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );
