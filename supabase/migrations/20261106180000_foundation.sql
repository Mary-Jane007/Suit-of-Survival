-- Suit of Survival, Phase 2 foundation.
-- Tables only. No card text, no representatives, no announcements.
-- Row level security:
--   the owner writes content
--   the server role (service_role / secret key) writes rounds, answers, votes, and scores
-- Guests have no auth.users row. Their participant.user_id stays null.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.account_role as enum ('owner', 'player');

create type public.suit as enum ('spades', 'diamonds', 'clubs', 'hearts', 'any');

create type public.content_status as enum ('draft', 'published', 'archived');

create type public.content_source as enum ('export', 'proposal');

create type public.representative_role as enum ('representative', 'game_master');

create type public.session_mode as enum ('online', 'real_life');

create type public.session_status as enum ('lobby', 'live', 'paused', 'ended');

create type public.participant_role as enum ('host', 'player', 'board', 'phone');

create type public.participant_status as enum ('active', 'eliminated', 'stopped', 'left');

create type public.round_state as enum ('pending', 'open', 'locked', 'resolved');

create type public.announcement_trigger as enum (
  'session_start',
  'card_drawn',
  'round_resolved',
  'player_eliminated',
  'player_stopped'
);

-- ---------------------------------------------------------------------------
-- Accounts
-- public.users is the thin app row beside auth.users. Guests do not get one.
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.account_role not null default 'player',
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 40)
);

-- One owner. The signup trigger assigns the role. A later account cannot take it
-- while this row exists. If that account is removed, the next signup becomes owner.
create unique index profiles_one_owner
  on public.profiles ((1))
  where role = 'owner';

create table public.owner_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint owner_settings_key_format check (key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$')
);

create unique index owner_settings_key_unique on public.owner_settings (key);

-- ---------------------------------------------------------------------------
-- Content. Written by the owner. Read as published rows where a policy allows it.
-- ---------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  suit public.suit not null default 'any',
  summary text not null default '',
  rules jsonb not null default '{}'::jsonb,
  status public.content_status not null default 'draft',
  supports_realtime boolean not null default true,
  supports_real_life boolean not null default false,
  physical_challenge jsonb,
  source public.content_source not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint games_title_length check (char_length(btrim(title)) between 1 and 120)
);

create unique index games_slug_unique on public.games (slug);
create index games_status_idx on public.games (status);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete cascade,
  suit public.suit not null,
  rank text not null,
  title text not null default '',
  prompt text not null default '',
  effect jsonb not null default '{}'::jsonb,
  secret jsonb not null default '{}'::jsonb,
  art_url text,
  sort_order integer not null default 0,
  source public.content_source not null,
  publishable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_suit_is_a_suit check (suit <> 'any'),
  constraint cards_rank_known check (rank in ('A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'))
);

create unique index cards_game_suit_rank_unique
  on public.cards (game_id, suit, rank)
  where game_id is not null;

create unique index cards_shared_deck_suit_rank_unique
  on public.cards (suit, rank)
  where game_id is null;

create index cards_publishable_idx on public.cards (publishable);

comment on column public.cards.source is
  'export is verbatim source text. proposal is a later completion. Keep them distinct.';

comment on column public.cards.publishable is
  'False until the row is safe to show. Export lines that fail SAFETY.md stay false.';

comment on column public.cards.secret is
  'Hidden answers. Not part of the player-facing prompt. Owner and server role only.';

comment on column public.cards.effect is
  'Builder payload. The client does not interpret a score from this column in Phase 2.';

create table public.representatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role public.representative_role not null,
  suit public.suit,
  portrait_url text,
  bio text not null default '',
  announcement_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint representatives_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint representatives_suit_specific check (suit is null or suit <> 'any')
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  rules jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint collections_title_length check (char_length(btrim(title)) between 1 and 120)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  representative_id uuid references public.representatives (id) on delete set null,
  trigger public.announcement_trigger not null,
  title text not null default '',
  body text not null default '',
  timing jsonb not null default '{}'::jsonb,
  game_id uuid references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index announcements_slug_unique on public.announcements (slug);

-- ---------------------------------------------------------------------------
-- Sessions. Creating a lobby is allowed for a signed-in host.
-- Outcomes of play are not. Phase 2 never moves a session out of the lobby.
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  mode public.session_mode not null default 'online',
  status public.session_status not null default 'lobby',
  game_id uuid references public.games (id) on delete set null,
  host_user_id uuid not null references auth.users (id) on delete restrict,
  settings_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint sessions_room_code_format check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$')
);

create unique index sessions_room_code_unique on public.sessions (room_code);
create index sessions_host_idx on public.sessions (host_user_id);
create index sessions_status_idx on public.sessions (status);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  role public.participant_role not null default 'player',
  status public.participant_status not null default 'active',
  device_label text,
  joined_at timestamptz not null default now(),
  constraint participants_display_name_length check (char_length(btrim(display_name)) between 1 and 40)
);

comment on column public.participants.user_id is
  'Null when the person joined with a display name and a room code and no account.';

comment on column public.participants.status is
  'eliminated is digital only. stopped means the player quit. Neither leaves the app.';

create index participants_session_idx on public.participants (session_id);

create unique index participants_one_account_per_session
  on public.participants (session_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- Game outcomes. No policies grant insert, update, or delete to the browser.
-- The server role bypasses row level security and is the only writer.
-- ---------------------------------------------------------------------------

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  index integer not null,
  state public.round_state not null default 'pending',
  opened_at timestamptz,
  deadline_at timestamptz,
  resolution jsonb,
  constraint rounds_index_nonnegative check (index >= 0)
);

create unique index rounds_session_card_index_unique
  on public.rounds (session_id, card_id, index)
  where card_id is not null;

create index rounds_session_idx on public.rounds (session_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index answers_round_idx on public.answers (round_id);
create index answers_participant_idx on public.answers (participant_id);

comment on table public.answers is
  'Secret marks stay here until a card says to reveal them. The browser never writes this table.';

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  voter_participant_id uuid not null references public.participants (id) on delete cascade,
  choice jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index votes_one_per_voter
  on public.votes (round_id, voter_participant_id);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  points integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index scores_one_per_participant
  on public.scores (session_id, participant_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create trigger representatives_set_updated_at
  before update on public.representatives
  for each row execute function public.set_updated_at();

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create trigger owner_settings_set_updated_at
  before update on public.owner_settings
  for each row execute function public.set_updated_at();

create trigger scores_set_updated_at
  before update on public.scores
  for each row execute function public.set_updated_at();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'profile role is assigned at signup and cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  clean_name text;
  assigned public.account_role;
begin
  -- Serialize signups so two first accounts cannot both become owner.
  perform pg_advisory_xact_lock(872341001);

  raw_name := coalesce(new.raw_user_meta_data ->> 'display_name', '');
  clean_name := left(btrim(raw_name), 40);

  if clean_name = '' then
    clean_name := left(split_part(coalesce(new.email, 'player'), '@', 1), 40);
  end if;

  if clean_name = '' then
    clean_name := 'Player';
  end if;

  if exists (select 1 from public.profiles where role = 'owner') then
    assigned := 'player';
  else
    assigned := 'owner';
  end if;

  insert into public.users (id, email, created_at)
  values (new.id, new.email, coalesce(new.created_at, now()));

  insert into public.profiles (user_id, display_name, role)
  values (new.id, clean_name, assigned);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_user_email();

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.sync_user_email() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.protect_profile_role() from public;
revoke all on function public.is_owner() from public;

grant execute on function public.is_owner() to anon, authenticated, service_role;
grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.protect_profile_role() to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
    grant execute on function public.sync_user_email() to supabase_auth_admin;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Row level security still decides which rows a role can touch.
-- Outcome tables do not grant insert, update, or delete to anon or authenticated.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on public.users to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.owner_settings to authenticated;
grant select, insert, update, delete on public.games to authenticated;
grant select on public.games to anon;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert, update, delete on public.representatives to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select on public.collections to anon;
grant select, insert, update, delete on public.announcements to authenticated;

grant select, insert, delete on public.sessions to authenticated;
grant select, insert on public.participants to authenticated;

grant select on public.rounds to authenticated;
grant select on public.answers to authenticated;
grant select on public.votes to authenticated;
grant select on public.scores to authenticated;

grant all on public.users to service_role;
grant all on public.profiles to service_role;
grant all on public.owner_settings to service_role;
grant all on public.games to service_role;
grant all on public.cards to service_role;
grant all on public.representatives to service_role;
grant all on public.collections to service_role;
grant all on public.announcements to service_role;
grant all on public.sessions to service_role;
grant all on public.participants to service_role;
grant all on public.rounds to service_role;
grant all on public.answers to service_role;
grant all on public.votes to service_role;
grant all on public.scores to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.owner_settings enable row level security;
alter table public.games enable row level security;
alter table public.cards enable row level security;
alter table public.representatives enable row level security;
alter table public.collections enable row level security;
alter table public.announcements enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.rounds enable row level security;
alter table public.answers enable row level security;
alter table public.votes enable row level security;
alter table public.scores enable row level security;

create policy users_select_self_or_owner
  on public.users
  for select
  to authenticated
  using (id = auth.uid() or public.is_owner());

create policy profiles_select_self_or_owner
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_owner());

-- Content: owner writes every row. Published games and collections are readable
-- without an account so the library can render. Cards stay owner-only because
-- secret answers share the row. Phase 3 can add a public projection that omits secret.

create policy owner_settings_owner_all
  on public.owner_settings
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy games_owner_all
  on public.games
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy games_select_published
  on public.games
  for select
  to anon, authenticated
  using (status = 'published');

create policy cards_owner_all
  on public.cards
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy representatives_owner_all
  on public.representatives
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy collections_owner_all
  on public.collections
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy collections_select_published
  on public.collections
  for select
  to anon, authenticated
  using (published = true);

create policy announcements_owner_all
  on public.announcements
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Lobby: a signed-in host may open an online lobby and remove it if it is still a lobby.
-- Moving the room to live, paused, or ended is not granted here.
-- Phase 2 also refuses real_life at the policy so this shell cannot pretend that mode runs.

create policy sessions_select_host_or_owner
  on public.sessions
  for select
  to authenticated
  using (host_user_id = auth.uid() or public.is_owner());

create policy sessions_insert_own_lobby
  on public.sessions
  for insert
  to authenticated
  with check (
    host_user_id = auth.uid()
    and status = 'lobby'
    and mode = 'online'
  );

create policy sessions_delete_own_lobby
  on public.sessions
  for delete
  to authenticated
  using (host_user_id = auth.uid() and status = 'lobby');

-- The host adds themselves. A guest (null user_id) is inserted by the server role,
-- which bypasses these policies.

create policy participants_select_related
  on public.participants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_owner()
    or exists (
      select 1
      from public.sessions
      where sessions.id = participants.session_id
        and sessions.host_user_id = auth.uid()
    )
  );

create policy participants_insert_host
  on public.participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'host'
    and status = 'active'
    and exists (
      select 1
      from public.sessions
      where sessions.id = participants.session_id
        and sessions.host_user_id = auth.uid()
        and sessions.status = 'lobby'
    )
  );

-- Owner can read outcomes for the dashboard. Nobody signed in can write them.

create policy rounds_select_owner
  on public.rounds
  for select
  to authenticated
  using (public.is_owner());

create policy answers_select_owner
  on public.answers
  for select
  to authenticated
  using (public.is_owner());

create policy votes_select_owner
  on public.votes
  for select
  to authenticated
  using (public.is_owner());

create policy scores_select_owner
  on public.scores
  for select
  to authenticated
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- Realtime. One channel per session comes in a later phase.
-- The publication is created by Supabase. Skip the step on plain Postgres.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sessions;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.participants;
    exception
      when duplicate_object then null;
    end;
  end if;
end;
$$;

alter table public.sessions replica identity full;
alter table public.participants replica identity full;
