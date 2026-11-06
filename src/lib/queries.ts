import "server-only";

import { connection } from "next/server";

import { getVerifiedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  CardRow,
  GameRow,
  PlayerRow,
  RepresentativeRow,
  SessionRow,
  SettingRow,
} from "@/lib/types";

export type QueryRows<T> =
  | { ok: true; rows: T[] }
  | { ok: false; message: string }
  | { ok: false; unconfigured: true };

async function reader() {
  await connection();

  if (!isSupabaseConfigured()) {
    return null;
  }

  return createClient();
}

export async function listPublishedGames(): Promise<QueryRows<GameRow>> {
  const supabase = await reader();
  if (!supabase) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await supabase
    .from("games")
    .select("id, slug, title, suit, summary, status, source, updated_at")
    .eq("status", "published")
    .order("title", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as GameRow[] };
}

export async function listOwnerGames(): Promise<QueryRows<GameRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await user.supabase
    .from("games")
    .select("id, slug, title, suit, summary, status, source, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as GameRow[] };
}

export async function listOwnerCards(): Promise<QueryRows<CardRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await user.supabase
    .from("cards")
    .select("id, suit, rank, title, source, publishable, updated_at")
    .order("suit", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as CardRow[] };
}

export async function listRepresentatives(): Promise<QueryRows<RepresentativeRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await user.supabase
    .from("representatives")
    .select("id, name, role, suit, bio")
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as RepresentativeRow[] };
}

export async function listProfiles(): Promise<QueryRows<PlayerRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await user.supabase
    .from("profiles")
    .select("user_id, display_name, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as PlayerRow[] };
}

export async function listSessions(): Promise<QueryRows<SessionRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const { data, error } = await user.supabase
    .from("sessions")
    .select("id, room_code, mode, status, created_at, participants(id)")
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as SessionRow[] };
}

export async function listSettings(prefix: "design" | "other"): Promise<QueryRows<SettingRow>> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  let query = user.supabase
    .from("owner_settings")
    .select("id, key, value, updated_at")
    .order("key", { ascending: true });

  query =
    prefix === "design" ? query.like("key", "design.%") : query.not("key", "like", "design.%");

  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, rows: (data ?? []) as SettingRow[] };
}

export type CountItem = {
  label: string;
  href: string | null;
  count: number | null;
  error: string | null;
};

export async function ownerCounts(): Promise<
  { ok: true; items: CountItem[] } | { ok: false; unconfigured: true } | { ok: false; message: string }
> {
  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false, unconfigured: true };
  }

  const specs = [
    { label: "Games", href: "/owner/games", table: "games" },
    { label: "Cards", href: "/owner/cards", table: "cards" },
    { label: "Representatives", href: "/owner/representatives", table: "representatives" },
    { label: "Players", href: "/owner/players", table: "profiles" },
    { label: "Sessions", href: "/owner/sessions", table: "sessions" },
    { label: "Collections", href: null, table: "collections" },
    { label: "Announcements", href: null, table: "announcements" },
  ] as const;

  const items = await Promise.all(
    specs.map(async (spec) => {
      let query = user.supabase.from(spec.table).select("*", { count: "exact", head: true });

      if (spec.table === "profiles") {
        query = query.eq("role", "player");
      }

      const { count, error } = await query;
      return {
        label: spec.label,
        href: spec.href,
        count: error ? null : (count ?? 0),
        error: error?.message ?? null,
      };
    }),
  );

  return { ok: true, items };
}
