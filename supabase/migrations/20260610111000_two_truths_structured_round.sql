create table public.two_truths_rounds (
  game_round_id uuid primary key references public.game_rounds (id) on delete cascade,
  phase text not null default 'collecting',
  collection_closed_at timestamptz,
  voting_started_at timestamptz,
  voting_closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint two_truths_rounds_phase_valid check (phase in ('collecting', 'voting', 'revealed'))
);

create trigger two_truths_rounds_set_updated_at
before update on public.two_truths_rounds
for each row
execute function public.set_updated_at();

create table public.two_truths_entries (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null references public.two_truths_rounds (game_round_id) on delete cascade,
  author_membership_id uuid not null references public.team_memberships (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  statement_one text not null,
  statement_two text not null,
  statement_three text not null,
  lie_statement_index smallint not null,
  included_in_voting boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint two_truths_entries_statement_one_not_blank check (btrim(statement_one) <> ''),
  constraint two_truths_entries_statement_two_not_blank check (btrim(statement_two) <> ''),
  constraint two_truths_entries_statement_three_not_blank check (btrim(statement_three) <> ''),
  constraint two_truths_entries_lie_statement_index_valid check (lie_statement_index in (1, 2, 3)),
  constraint two_truths_entries_round_membership_unique unique (game_round_id, author_membership_id),
  constraint two_truths_entries_id_round_unique unique (id, game_round_id)
);

create trigger two_truths_entries_set_updated_at
before update on public.two_truths_entries
for each row
execute function public.set_updated_at();

create table public.two_truths_guesses (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null references public.two_truths_rounds (game_round_id) on delete cascade,
  voter_membership_id uuid not null references public.team_memberships (id) on delete cascade,
  voter_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_entry_id uuid not null,
  guessed_lie_index smallint not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint two_truths_guesses_guessed_lie_index_valid check (guessed_lie_index in (1, 2, 3)),
  constraint two_truths_guesses_target_entry_fk
    foreign key (target_entry_id, game_round_id)
    references public.two_truths_entries (id, game_round_id)
    on delete cascade,
  constraint two_truths_guesses_round_voter_target_unique unique (game_round_id, voter_membership_id, target_entry_id)
);

create index two_truths_entries_round_created_at_idx
  on public.two_truths_entries (game_round_id, created_at);

create index two_truths_entries_round_included_idx
  on public.two_truths_entries (game_round_id, included_in_voting, created_at);

create index two_truths_guesses_round_voter_idx
  on public.two_truths_guesses (game_round_id, voter_membership_id, created_at);

create index two_truths_guesses_round_target_idx
  on public.two_truths_guesses (game_round_id, target_entry_id, created_at);

alter table public.two_truths_rounds enable row level security;
alter table public.two_truths_entries enable row level security;
alter table public.two_truths_guesses enable row level security;

create policy "two_truths_rounds_select_for_team_members"
  on public.two_truths_rounds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_rounds.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

create policy "two_truths_rounds_insert_for_team_members"
  on public.two_truths_rounds
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_rounds.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

create policy "two_truths_rounds_update_for_team_members"
  on public.two_truths_rounds
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_rounds.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  )
  with check (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_rounds.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

create policy "two_truths_entries_select_for_team_members"
  on public.two_truths_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_entries.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

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
        and rounds.id = two_truths_entries.game_round_id
        and rounds.status = 'open'
        and structured_round.phase = 'collecting'
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

create policy "two_truths_guesses_select_for_team_members"
  on public.two_truths_guesses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      where rounds.id = two_truths_guesses.game_round_id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );

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
        and rounds.id = two_truths_guesses.game_round_id
        and rounds.status = 'open'
        and structured_round.phase = 'voting'
        and target_entry.included_in_voting = true
        and target_entry.author_membership_id <> memberships.id
        and public.is_team_member(rounds.team_id, public.current_profile_id())
    )
  );
