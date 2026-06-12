\set ON_ERROR_STOP on

begin;

with seeded_days as (
  select generate_series(current_date - interval '14 day', current_date - interval '1 day', interval '1 day')::date as session_date
),
upserted_sessions as (
  insert into public.emoji_check_in_sessions (
    team_id,
    session_date,
    status,
    revealed_at,
    created_at,
    updated_at
  )
  select
    '9f6e1cd1-838e-4068-9f5b-4d463b817689'::uuid,
    seeded_days.session_date,
    'revealed',
    timezone('utc', seeded_days.session_date::timestamp + interval '18 hour'),
    timezone('utc', seeded_days.session_date::timestamp + interval '9 hour'),
    timezone('utc', seeded_days.session_date::timestamp + interval '18 hour')
  from seeded_days
  on conflict (team_id, session_date) do update
  set
    status = excluded.status,
    revealed_at = excluded.revealed_at,
    updated_at = excluded.updated_at
  returning id, session_date
),
selected_sessions as (
  select sessions.id, sessions.session_date
  from public.emoji_check_in_sessions sessions
  join seeded_days
    on seeded_days.session_date = sessions.session_date
  where sessions.team_id = '9f6e1cd1-838e-4068-9f5b-4d463b817689'::uuid
),
target_memberships as (
  select *
  from (
    values
      ('719e3be6-d448-40e8-96bc-e15ee10cf794'::uuid, '8b620fd8-d63e-47e6-bf29-a4988c0d539d'::uuid, 0),
      ('5bea0a15-f5e6-4089-950c-6ff766d0b0b7'::uuid, 'db9fe5e3-40c3-46e6-a2fd-a7ec61520b57'::uuid, 1)
  ) as memberships(membership_id, profile_id, emoji_offset)
)
delete from public.emoji_check_in_submissions submissions
using selected_sessions, target_memberships
where submissions.session_id = selected_sessions.id
  and submissions.membership_id = target_memberships.membership_id;

with seeded_days as (
  select generate_series(current_date - interval '14 day', current_date - interval '1 day', interval '1 day')::date as session_date
),
selected_sessions as (
  select sessions.id, sessions.session_date
  from public.emoji_check_in_sessions sessions
  join seeded_days
    on seeded_days.session_date = sessions.session_date
  where sessions.team_id = '9f6e1cd1-838e-4068-9f5b-4d463b817689'::uuid
),
target_memberships as (
  select *
  from (
    values
      ('719e3be6-d448-40e8-96bc-e15ee10cf794'::uuid, '8b620fd8-d63e-47e6-bf29-a4988c0d539d'::uuid, 0),
      ('5bea0a15-f5e6-4089-950c-6ff766d0b0b7'::uuid, 'db9fe5e3-40c3-46e6-a2fd-a7ec61520b57'::uuid, 1)
  ) as memberships(membership_id, profile_id, emoji_offset)
)
insert into public.emoji_check_in_submissions (
  session_id,
  membership_id,
  profile_id,
  emojis,
  created_at
)
select
  selected_sessions.id,
  target_memberships.membership_id,
  target_memberships.profile_id,
  case mod(extract(day from selected_sessions.session_date)::int + target_memberships.emoji_offset, 8)
    when 0 then array['😄', '🤝']
    when 1 then array['🧠', '🎯']
    when 2 then array['🌱', '😌']
    when 3 then array['🥳', '❤️']
    when 4 then array['😅', '🤔']
    when 5 then array['😬', '🔥']
    when 6 then array['💡', '🚀']
    else array['🫶', '🌊']
  end,
  timezone('utc', selected_sessions.session_date::timestamp + make_interval(hours => 9 + target_memberships.emoji_offset))
from selected_sessions
cross join target_memberships;

commit;
