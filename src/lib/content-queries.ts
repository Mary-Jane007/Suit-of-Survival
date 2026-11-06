import "server-only";

import { connection } from "next/server";

import { getVerifiedUser } from "@/lib/auth";
import { asObject, publicEffect } from "@/lib/public-effect";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function ownerDb() {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, unconfigured: true as const };
  }

  const user = await getVerifiedUser();
  if (!user) {
    return { ok: false as const, unconfigured: true as const };
  }
  if (user.profileError || !user.profile) {
    return { ok: false as const, message: user.profileError ?? "This account has no profile." };
  }
  if (user.profile.role !== "owner") {
    return { ok: false as const, message: "Only the owner can edit the library." };
  }

  return { ok: true as const, supabase: user.supabase };
}

export async function listRepresentativeOptions() {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("representatives")
    .select("id, name, suit, role")
    .order("name", { ascending: true });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const, rows: data ?? [] };
}

export async function getOwnerGame(id: string) {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("games")
    .select("id, slug, title, suit, summary, status, source, supports_realtime, supports_real_life, representative_id, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data) {
    return { ok: false as const, message: "No game uses that id." };
  }

  const { data: rules, error: rulesError } = await db.supabase.rpc("game_rules", { game_id: id });
  if (rulesError) {
    return { ok: false as const, message: rulesError.message };
  }

  const { data: cards, error: cardError } = await db.supabase
    .from("cards")
    .select("id, suit, rank, title, source, publishable, sort_order")
    .eq("game_id", id)
    .order("suit", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("source", { ascending: true });

  if (cardError) {
    return { ok: false as const, message: cardError.message };
  }

  return { ok: true as const, game: { ...data, rules }, cards: cards ?? [] };
}

export async function getOwnerCard(id: string) {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("cards")
    .select("id, game_id, suit, rank, title, prompt, art_url, sort_order, source, publishable, representative_id, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data) {
    return { ok: false as const, message: "No card uses that id." };
  }

  const { data: effect, error: effectError } = await db.supabase.rpc("card_effect", { card_id: id });
  if (effectError) {
    return { ok: false as const, message: effectError.message };
  }

  const { data: secret, error: secretError } = await db.supabase.rpc("card_secret", { card_id: id });
  if (secretError) {
    return { ok: false as const, message: secretError.message };
  }

  return { ok: true as const, card: { ...data, effect }, secret };
}

export async function getOwnerRepresentative(id: string) {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("representatives")
    .select("id, name, role, suit, portrait_url, bio, dialogue, announcement_style")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data) {
    return { ok: false as const, message: "No representative uses that id." };
  }

  return { ok: true as const, representative: data };
}

export async function listAnnouncements() {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("announcements")
    .select("id, slug, trigger, title, body, source, representative_id")
    .order("slug", { ascending: true });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const, rows: data ?? [] };
}

export async function getAnnouncement(slug: string) {
  const db = await ownerDb();
  if (!db.ok) {
    return db;
  }

  const { data, error } = await db.supabase
    .from("announcements")
    .select("id, slug, trigger, title, body, timing, source, representative_id, game_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data) {
    return { ok: false as const, message: "No announcement uses that slug." };
  }

  let representative = null;
  if (data.representative_id) {
    const { data: person } = await db.supabase
      .from("representatives")
      .select("id, name, portrait_url, suit, bio")
      .eq("id", data.representative_id)
      .maybeSingle();
    representative = person;
  }

  return { ok: true as const, announcement: data, representative };
}

export async function getPublishedGame(slug: string) {
  await connection();

  if (!isSupabaseConfigured()) {
    return { ok: false as const, unconfigured: true as const };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, title, suit, summary, source, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data) {
    return { ok: false as const, missing: true as const };
  }

  const { data: cards, error: cardError } = await supabase
    .from("library_cards")
    .select("id, suit, rank, title, prompt, effect, source, sort_order, representative_id")
    .eq("game_id", data.id)
    .order("suit", { ascending: true })
    .order("sort_order", { ascending: true });

  if (cardError) {
    return { ok: false as const, message: cardError.message };
  }

  const visible = (cards ?? [])
    .filter((card) => asObject(card.effect).in_play !== false)
    .map((card) => ({
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      title: card.title,
      prompt: card.prompt,
      source: card.source,
      sort_order: card.sort_order,
      representative_id: card.representative_id,
      effect: publicEffect(card.effect),
    }));

  return { ok: true as const, game: data, cards: visible };
}
