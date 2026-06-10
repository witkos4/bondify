create policy "two_truths_entries_update_for_team_members"
  on public.two_truths_entries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_entries.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  )
  with check (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_entries.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );
