create table if not exists users (
  id text primary key,
  username text not null unique,
  pin_hash text,
  password_hash text,
  role text not null default 'player',
  avatar text not null default 'mark',
  created_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists representatives (
  id text primary key,
  name text not null,
  suit text,
  portrait_key text not null default 'herald',
  portrait_image text,
  personality text not null default '',
  style text not null default '',
  intro text not null default '',
  rules_line text not null default '',
  start_line text not null default '',
  success_line text not null default '',
  failure_line text not null default '',
  special_line text not null default '',
  enabled boolean not null default true,
  accent text not null default '#c4161c'
);

create table if not exists cards (
  id text primary key,
  suit text not null,
  rank text not null,
  difficulty int not null,
  special boolean not null default false,
  difficulty_label text not null,
  description text not null default '',
  active boolean not null default true,
  unique (suit, rank)
);

create table if not exists games (
  id text primary key,
  slug text unique,
  source text not null default 'custom',
  name text not null,
  description text not null default '',
  suit text not null,
  rank text not null,
  difficulty int not null,
  representative_id text references representatives(id),
  min_players int not null default 1,
  max_players int not null default 8,
  duration_seconds int not null default 60,
  materials text not null default '',
  rules text not null default '',
  rules_original text not null default '',
  instructions text not null default '',
  objective text not null default '',
  win_condition text not null default '',
  fail_condition text not null default '',
  scoring_summary text not null default '',
  rounds int not null default 1,
  timer_seconds int not null default 60,
  status text not null default 'draft',
  visibility text not null default 'private',
  format text not null default 'host_judge',
  definition jsonb not null default '{}',
  safety_note text not null default '',
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists announcements (
  key text primary key,
  kicker text not null,
  title_template text not null,
  body_template text not null,
  enabled boolean not null default true
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

create table if not exists game_sessions (
  id text primary key,
  code text not null unique,
  host_user_id text not null references users(id),
  phase text not null default 'lobby',
  play_style text not null default 'arena',
  draw_mode text not null default 'random',
  prevent_duplicates boolean not null default true,
  suit_filter jsonb not null default '[]',
  current_game_id text references games(id),
  runtime jsonb,
  deadline_ms bigint,
  paused boolean not null default false,
  round_index int not null default 0,
  used_game_ids jsonb not null default '[]',
  pending_effects jsonb not null default '[]',
  hands jsonb not null default '{}',
  result jsonb,
  announcement jsonb,
  log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists participants (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  user_id text not null references users(id),
  ready boolean not null default false,
  entered boolean not null default false,
  is_host boolean not null default false,
  playing boolean not null default true,
  score int not null default 0,
  status text not null default 'in_play',
  kicked boolean not null default false,
  connected_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table if not exists score_events (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  user_id text not null references users(id),
  game_id text,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists collections (
  user_id text not null references users(id) on delete cascade,
  game_id text not null references games(id),
  session_id text,
  earned_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists answers (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  game_id text,
  user_id text not null references users(id),
  round_index int not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  game_id text,
  user_id text not null references users(id),
  choice jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists draws (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  game_id text not null references games(id),
  method text not null,
  created_at timestamptz not null default now()
);

create table if not exists game_rounds (
  id text primary key,
  session_id text not null references game_sessions(id) on delete cascade,
  game_id text,
  round_index int not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists achievements (
  id text primary key,
  name text not null,
  description text not null,
  rule jsonb not null
);

create table if not exists user_achievements (
  user_id text not null references users(id) on delete cascade,
  achievement_id text not null references achievements(id),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists activity (
  id text primary key,
  session_id text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists participants_session_idx on participants (session_id);
create index if not exists score_events_user_idx on score_events (user_id);
create index if not exists games_status_idx on games (status);
