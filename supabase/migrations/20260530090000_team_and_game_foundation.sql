create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  normalized_email text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_not_blank check (btrim(email) <> ''),
  constraint profiles_normalized_email_not_blank check (btrim(normalized_email) <> ''),
  constraint profiles_normalized_email_lowercase check (normalized_email = lower(normalized_email))
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized = lower(btrim(coalesce(new.email, '')));

  if normalized = '' then
    raise exception 'Bondify profiles require an email address';
  end if;

  insert into public.profiles (id, email, normalized_email)
  values (new.id, new.email, normalized)
  on conflict (id) do update
  set
    email = excluded.email,
    normalized_email = excluded.normalized_email,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger sync_profile_from_auth_user
after insert or update of email on auth.users
for each row
execute function public.sync_profile_from_auth_user();

insert into public.profiles (id, email, normalized_email)
select
  users.id,
  users.email,
  lower(btrim(users.email))
from auth.users as users
where users.email is not null
on conflict (id) do update
set
  email = excluded.email,
  normalized_email = excluded.normalized_email,
  updated_at = timezone('utc', now());

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint teams_name_not_blank check (btrim(name) <> '')
);

create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id, profile_id)
);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  inviter_profile_id uuid not null references public.profiles (id) on delete restrict,
  email text not null,
  normalized_email text not null,
  status text not null default 'pending',
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_invites_email_not_blank check (btrim(email) <> ''),
  constraint team_invites_normalized_email_not_blank check (btrim(normalized_email) <> ''),
  constraint team_invites_normalized_email_lowercase check (normalized_email = lower(normalized_email)),
  constraint team_invites_status_valid check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create unique index team_invites_unique_pending_email_per_team
  on public.team_invites (team_id, normalized_email)
  where status = 'pending';

create trigger team_invites_set_updated_at
before update on public.team_invites
for each row
execute function public.set_updated_at();

create table public.game_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  prompt text not null,
  is_history_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint game_templates_slug_not_blank check (btrim(slug) <> ''),
  constraint game_templates_name_not_blank check (btrim(name) <> ''),
  constraint game_templates_prompt_not_blank check (btrim(prompt) <> '')
);

create trigger game_templates_set_updated_at
before update on public.game_templates
for each row
execute function public.set_updated_at();

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  game_template_id uuid not null references public.game_templates (id) on delete restrict,
  opened_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'open',
  revealed_at timestamptz,
  history_visible_until timestamptz,
  history_cleared_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint game_rounds_status_valid check (status in ('open', 'revealed', 'closed'))
);

create trigger game_rounds_set_updated_at
before update on public.game_rounds
for each row
execute function public.set_updated_at();

create table public.game_responses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  membership_id uuid not null references public.team_memberships (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  response_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint game_responses_response_text_not_blank check (btrim(response_text) <> ''),
  unique (round_id, membership_id)
);

create index team_memberships_profile_id_idx on public.team_memberships (profile_id);
create index team_invites_team_id_status_idx on public.team_invites (team_id, status);
create index team_invites_normalized_email_status_idx on public.team_invites (normalized_email, status);
create index game_rounds_team_id_status_created_at_idx on public.game_rounds (team_id, status, created_at desc);
create index game_responses_round_id_created_at_idx on public.game_responses (round_id, created_at);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.current_profile_normalized_email()
returns text
language sql
stable
as $$
  select profiles.normalized_email
  from public.profiles
  where profiles.id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invites enable row level security;
alter table public.game_templates enable row level security;
alter table public.game_rounds enable row level security;
alter table public.game_responses enable row level security;

create policy "profiles_select_self"
  on public.profiles
  for select
  to authenticated
  using (id = public.current_profile_id());

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = public.current_profile_id())
  with check (id = public.current_profile_id());

create policy "teams_select_for_active_members"
  on public.teams
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = teams.id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "teams_insert_for_creator"
  on public.teams
  for insert
  to authenticated
  with check (created_by = public.current_profile_id());

create policy "teams_update_for_creator"
  on public.teams
  for update
  to authenticated
  using (created_by = public.current_profile_id())
  with check (created_by = public.current_profile_id());

create policy "team_memberships_select_for_team_members"
  on public.team_memberships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = team_memberships.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "team_memberships_insert_for_team_creator_or_invitee"
  on public.team_memberships
  for insert
  to authenticated
  with check (
    profile_id = public.current_profile_id()
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

create policy "team_invites_select_for_team_members_and_invitees"
  on public.team_invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = team_invites.team_id
        and memberships.profile_id = public.current_profile_id()
    )
    or normalized_email = public.current_profile_normalized_email()
  );

create policy "team_invites_insert_for_active_members"
  on public.team_invites
  for insert
  to authenticated
  with check (
    inviter_profile_id = public.current_profile_id()
    and status = 'pending'
    and accepted_profile_id is null
    and accepted_at is null
    and exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = team_invites.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "team_invites_update_for_accepting_invitee"
  on public.team_invites
  for update
  to authenticated
  using (
    normalized_email = public.current_profile_normalized_email()
    or exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = team_invites.team_id
        and memberships.profile_id = public.current_profile_id()
    )
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

create policy "game_templates_select_for_authenticated_users"
  on public.game_templates
  for select
  to authenticated
  using (true);

create policy "game_rounds_select_for_team_members"
  on public.game_rounds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = game_rounds.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "game_rounds_insert_for_team_members"
  on public.game_rounds
  for insert
  to authenticated
  with check (
    opened_by_profile_id = public.current_profile_id()
    and exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = game_rounds.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "game_rounds_update_for_team_members"
  on public.game_rounds
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = game_rounds.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  )
  with check (
    exists (
      select 1
      from public.team_memberships memberships
      where memberships.team_id = game_rounds.team_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

create policy "game_responses_select_for_team_members"
  on public.game_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.game_rounds rounds
      join public.team_memberships memberships
        on memberships.team_id = rounds.team_id
      where rounds.id = game_responses.round_id
        and memberships.profile_id = public.current_profile_id()
    )
  );

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
    )
  );
