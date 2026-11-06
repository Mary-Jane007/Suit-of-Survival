-- Phase 6. The four collections are seed data. The numbers live in rules,
-- so the owner can change them without a deploy. They stay off until published.

insert into public.collections (id, title, description, rules, items, published)
select seed.id, seed.title, seed.description, seed.rules, '[]'::jsonb, false
from (
  values
    (
      'eeeeeeee-0000-4000-8000-000000000001'::uuid,
      'Diamond Mind',
      'Diamonds collection. The clear count is the stored rule.',
      '{"suit":"diamonds","clears_required":5,"clear_minimum":0}'::jsonb
    ),
    (
      'eeeeeeee-0000-4000-8000-000000000002'::uuid,
      'Heart Read',
      'Hearts collection. The clear count is the stored rule.',
      '{"suit":"hearts","clears_required":5,"clear_minimum":0}'::jsonb
    ),
    (
      'eeeeeeee-0000-4000-8000-000000000003'::uuid,
      'Club Line',
      'Clubs collection. The clear count is the stored rule.',
      '{"suit":"clubs","clears_required":5,"clear_minimum":0}'::jsonb
    ),
    (
      'eeeeeeee-0000-4000-8000-000000000004'::uuid,
      'Spade Step',
      'Spades collection. The clear count is the stored rule.',
      '{"suit":"spades","clears_required":5,"clear_minimum":0}'::jsonb
    )
) as seed(id, title, description, rules)
where not exists (select 1 from public.collections existing where existing.id = seed.id);
