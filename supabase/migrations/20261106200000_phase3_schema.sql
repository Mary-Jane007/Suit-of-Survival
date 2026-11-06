-- Phase 3 schema. Content rows are in the next migration so new enum
-- values are committed before they are used.

alter table public.games
  add column representative_id uuid references public.representatives (id) on delete set null;

alter table public.cards
  add column representative_id uuid references public.representatives (id) on delete set null;

alter table public.representatives
  add column dialogue jsonb not null default '{}'::jsonb;

alter table public.announcements
  add column source public.content_source not null default 'proposal';

comment on column public.representatives.dialogue is
  'Lines the owner can edit. Announcement screens read the announcements table, not this column, unless a screen is pointed at a representative.';

comment on column public.cards.representative_id is
  'Who reads the card. Original cast only. Not a show likeness.';

-- An export row and a proposal row may share a suit and rank.
drop index if exists public.cards_game_suit_rank_unique;
drop index if exists public.cards_shared_deck_suit_rank_unique;

create unique index cards_game_suit_rank_source_unique
  on public.cards (game_id, suit, rank, source)
  where game_id is not null;

create unique index cards_shared_deck_suit_rank_source_unique
  on public.cards (suit, rank, source)
  where game_id is null;

-- Preview screens. PostgreSQL cannot insert these values in the same
-- transaction that adds them, so the inserts live in the next file.
alter type public.announcement_trigger add value if not exists 'card_detected';
alter type public.announcement_trigger add value if not exists 'rules';
alter type public.announcement_trigger add value if not exists 'countdown';
alter type public.announcement_trigger add value if not exists 'started';
alter type public.announcement_trigger add value if not exists 'paused';
alter type public.announcement_trigger add value if not exists 'success';
alter type public.announcement_trigger add value if not exists 'game_over';

-- Players may read a published, in-play card. They cannot read secret.
grant select on public.cards to anon;
revoke select (secret) on public.cards from anon, authenticated;
revoke select (effect) on public.cards from anon, authenticated;

create policy cards_select_published
  on public.cards
  for select
  to anon, authenticated
  using (
    publishable = true
    and coalesce(effect->>'in_play', 'true') <> 'false'
    and (
      game_id is null
      or exists (
        select 1
        from public.games
        where games.id = cards.game_id
          and games.status = 'published'
      )
    )
  );

grant select on public.representatives to anon;

create policy representatives_select_public
  on public.representatives
  for select
  to anon, authenticated
  using (true);

create or replace function public.card_secret(card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select secret
  from public.cards
  where id = card_id
    and public.is_owner();
$$;

revoke all on function public.card_secret(uuid) from public;
grant execute on function public.card_secret(uuid) to authenticated;

create or replace function public.card_effect(card_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select effect
  from public.cards
  where id = card_id
    and public.is_owner();
$$;

revoke all on function public.card_effect(uuid) from public;
grant execute on function public.card_effect(uuid) to authenticated;

create or replace view public.library_cards
with (security_invoker = false) as
select
  id,
  game_id,
  suit,
  rank,
  title,
  prompt,
  source,
  sort_order,
  representative_id,
  jsonb_strip_nulls(jsonb_build_object(
    'kind', effect->'kind',
    'player_count', effect->'player_count',
    'rounds', effect->'rounds',
    'timer_seconds', effect->'timer_seconds',
    'scoring', effect->'scoring',
    'hints', effect->'hints',
    'question', effect->'question',
    'physical', effect->'physical'
  )) as effect
from public.cards
where publishable = true
  and coalesce(effect->>'in_play', 'true') <> 'false'
  and (
    game_id is null
    or exists (
      select 1
      from public.games
      where games.id = cards.game_id
        and games.status = 'published'
    )
  );

grant select on public.library_cards to anon, authenticated;

revoke select (rules, physical_challenge) on public.games from anon, authenticated;

create or replace function public.game_rules(game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select rules
  from public.games
  where id = game_id
    and public.is_owner();
$$;

revoke all on function public.game_rules(uuid) from public;
grant execute on function public.game_rules(uuid) to authenticated;

create or replace function public.duplicate_game(source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  base public.games%rowtype;
  suffix text := substr(replace(new_id::text, '-', ''), 1, 4);
begin
  if not public.is_owner() then
    raise exception 'only the owner can duplicate a game';
  end if;

  select * into base from public.games where id = source_id;
  if not found then
    raise exception 'game not found';
  end if;

  insert into public.games (
    id, slug, title, suit, summary, rules, status,
    supports_realtime, supports_real_life, physical_challenge,
    source, representative_id
  )
  values (
    new_id,
    base.slug || '-' || suffix,
    left(base.title || ' copy', 120),
    base.suit,
    base.summary,
    base.rules,
    'draft',
    base.supports_realtime,
    base.supports_real_life,
    base.physical_challenge,
    base.source,
    base.representative_id
  );

  insert into public.cards (
    game_id, suit, rank, title, prompt, effect, secret, art_url,
    sort_order, source, publishable, representative_id
  )
  select
    new_id, suit, rank, title, prompt, effect, secret, art_url,
    sort_order, source, false, representative_id
  from public.cards
  where game_id = source_id;

  return new_id;
end;
$$;

revoke all on function public.duplicate_game(uuid) from public;
grant execute on function public.duplicate_game(uuid) to authenticated;
