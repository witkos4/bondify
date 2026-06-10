delete from public.game_rounds as rounds
using public.game_templates as templates
where rounds.game_template_id = templates.id
  and templates.slug = 'two-truths-and-a-wish';

update public.game_templates
set
  slug = 'two-truths-and-a-lie',
  name = 'Two Truths and a Lie',
  prompt = 'Share three statements, mark which one is the lie, then guess the lie in each teammate''s set.',
  is_history_enabled = true
where slug = 'two-truths-and-a-wish';

insert into public.game_templates (slug, name, prompt, is_history_enabled)
select
  'two-truths-and-a-lie',
  'Two Truths and a Lie',
  'Share three statements, mark which one is the lie, then guess the lie in each teammate''s set.',
  true
where not exists (
  select 1
  from public.game_templates
  where slug = 'two-truths-and-a-lie'
);
