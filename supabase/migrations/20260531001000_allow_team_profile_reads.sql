create policy "profiles_select_teammates"
  on public.profiles
  for select
  to authenticated
  using (
    id = public.current_profile_id()
    or exists (
      select 1
      from public.team_memberships current_member
      join public.team_memberships teammate_member
        on teammate_member.team_id = current_member.team_id
      where current_member.profile_id = public.current_profile_id()
        and teammate_member.profile_id = profiles.id
    )
  );
