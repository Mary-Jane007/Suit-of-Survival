export type AccountRole = "owner" | "player";

export type Profile = {
  user_id: string;
  display_name: string;
  role: AccountRole;
  avatar_url: string | null;
  created_at: string;
};

export type GameRow = {
  id: string;
  slug: string;
  title: string;
  suit: string;
  summary: string;
  status: string;
  source: string;
  updated_at: string;
};

export type CardRow = {
  id: string;
  suit: string;
  rank: string;
  title: string;
  source: string;
  publishable: boolean;
  updated_at: string;
};

export type RepresentativeRow = {
  id: string;
  name: string;
  role: string;
  suit: string | null;
  bio: string;
  portrait_url?: string | null;
};

export type PlayerRow = {
  user_id: string;
  display_name: string;
  role: AccountRole;
  created_at: string;
};

export type SessionRow = {
  id: string;
  room_code: string;
  mode: string;
  status: string;
  created_at: string;
  participants: { id: string }[] | null;
};

export type SettingRow = {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
};

export type LobbyParticipant = {
  id: string;
  display_name: string;
  role: string;
  status: string;
  user_id: string | null;
  joined_at: string;
};

export type Lobby = {
  id: string;
  room_code: string;
  mode: string;
  status: string;
  host_user_id: string;
  created_at: string;
  participants: LobbyParticipant[];
};

export type ActionState = {
  error?: string;
  message?: string;
};
