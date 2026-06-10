insert into public.game_templates (slug, name, prompt, is_history_enabled)
values
  (
    'emoji-check-in',
    'Emoji Check-In',
    'Pick 1 to 3 emojis that capture how today feels for your team.',
    true
  ),
  (
    'rose-thorn-bud',
    'Rose, Thorn, Bud',
    'Share one highlight, one challenge, and one thing you are looking forward to.',
    true
  ),
  (
    'two-truths-and-a-lie',
    'Two Truths and a Lie',
    'Share three statements, mark which one is the lie, then guess the lie in each teammate''s set.',
    true
  ),
  (
    'how-i-work',
    'How I Work Best',
    'Describe one condition that helps you do your best work with a team.',
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  prompt = excluded.prompt,
  is_history_enabled = excluded.is_history_enabled;
