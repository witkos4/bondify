insert into public.game_templates (slug, name, prompt, is_history_enabled)
values
  (
    'rose-thorn-bud',
    'Rose, Thorn, Bud',
    'Share one highlight, one challenge, and one thing you are looking forward to.',
    true
  ),
  (
    'two-truths-and-a-wish',
    'Two Truths and a Wish',
    'Share two true things about your work week and one wish for how the team can help.',
    false
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
