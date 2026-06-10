create table public.emoji_check_in_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  session_date date not null,
  status text not null default 'open',
  revealed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint emoji_check_in_sessions_status_valid check (status in ('open', 'revealed')),
  unique (team_id, session_date)
);

create trigger emoji_check_in_sessions_set_updated_at
before update on public.emoji_check_in_sessions
for each row
execute function public.set_updated_at();

create table public.emoji_check_in_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.emoji_check_in_sessions (id) on delete cascade,
  membership_id uuid not null references public.team_memberships (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emojis text[] not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint emoji_check_in_submissions_emojis_bounds check (
    cardinality(emojis) between 1 and 3
  ),
  constraint emoji_check_in_submissions_emojis_not_blank check (
    array_position(emojis, '') is null
  ),
  unique (session_id, membership_id)
);

create index emoji_check_in_sessions_team_date_idx
  on public.emoji_check_in_sessions (team_id, session_date desc);

create index emoji_check_in_submissions_session_created_idx
  on public.emoji_check_in_submissions (session_id, created_at);

alter table public.emoji_check_in_sessions enable row level security;
alter table public.emoji_check_in_submissions enable row level security;

create policy "emoji_check_in_sessions_select_for_team_members"
  on public.emoji_check_in_sessions
  for select
  to authenticated
  using (public.is_team_member(team_id, public.current_profile_id()));

create policy "emoji_check_in_sessions_insert_for_team_members"
  on public.emoji_check_in_sessions
  for insert
  to authenticated
  with check (public.is_team_member(team_id, public.current_profile_id()));

create policy "emoji_check_in_sessions_update_for_team_members"
  on public.emoji_check_in_sessions
  for update
  to authenticated
  using (public.is_team_member(team_id, public.current_profile_id()))
  with check (public.is_team_member(team_id, public.current_profile_id()));

create policy "emoji_check_in_submissions_select_for_team_members"
  on public.emoji_check_in_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.emoji_check_in_sessions sessions
      where sessions.id = emoji_check_in_submissions.session_id
        and public.is_team_member(sessions.team_id, public.current_profile_id())
    )
  );

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
    )
  );
