"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getVerifiedUser } from "@/lib/auth";
import { asObject } from "@/lib/public-effect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CARD_SUITS, cleanSlug, cleanText, RANKS, SUITS } from "@/lib/validate";
import type { ActionState } from "@/lib/types";

const UNSAFE_WORDING = /\b(dood|death|gegeten|eaten|forceer|straf|punishment)\b/i;

async function owner() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const user = await getVerifiedUser();
  if (!user) {
    return { error: "Sign in as the owner." } as const;
  }
  if (user.profile?.role !== "owner") {
    return { error: "Only the owner can edit the library." } as const;
  }
  return { supabase: user.supabase } as const;
}

function text(formData: FormData, key: string) {
  return cleanText(formData.get(key));
}

function optionalNumber(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return Number.NaN;
  }
  return number;
}

function representativeId(formData: FormData) {
  const value = text(formData, "representative_id");
  return value || null;
}

export async function createGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const title = text(formData, "title");
  const suit = text(formData, "suit");
  const slug = cleanSlug(title);
  if (!title || !slug) {
    return { error: "A game needs a title that can become a slug." };
  }
  if (!SUITS.includes(suit as (typeof SUITS)[number])) {
    return { error: "Choose a suit, or any." };
  }

  const { data, error } = await access.supabase
    .from("games")
    .insert({
      title,
      slug,
      suit,
      summary: text(formData, "summary"),
      source: "proposal",
      status: "draft",
      rules: {},
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "The game was not created." };
  }

  revalidatePath("/owner/games");
  redirect(`/owner/games/${data.id}`);
}

export async function updateGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const id = text(formData, "id");
  const title = text(formData, "title");
  const slug = cleanSlug(formData.get("slug"));
  const suit = text(formData, "suit");
  const status = text(formData, "status");
  if (!id || !title || !slug) {
    return { error: "Title, slug, and id are required." };
  }
  if (!SUITS.includes(suit as (typeof SUITS)[number])) {
    return { error: "Choose a suit, or any." };
  }
  if (status !== "draft" && status !== "published" && status !== "archived") {
    return { error: "Status must be draft, published, or archived." };
  }

  const draws = optionalNumber(formData, "draws");
  const handSize = optionalNumber(formData, "hand_size");
  if (Number.isNaN(draws) || Number.isNaN(handSize)) {
    return { error: "Draws and hand size must be numbers." };
  }

  const { data: currentRules, error: readError } = await access.supabase.rpc("game_rules", { game_id: id });
  if (readError) {
    return { error: readError.message };
  }

  const rules = asObject(currentRules);
  rules.draws = draws;
  rules.hand_size = handSize;
  rules.digital_elimination = formData.get("digital_elimination") === "on";
  rules.physical_offered = formData.get("physical_offered") === "on";
  rules.notes = text(formData, "rules_notes");

  const { error } = await access.supabase
    .from("games")
    .update({
      title,
      slug,
      suit,
      summary: text(formData, "summary"),
      status,
      representative_id: representativeId(formData),
      rules,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/owner/games");
  revalidatePath(`/owner/games/${id}`);
  revalidatePath("/library");
  revalidatePath(`/library/${slug}`);
  return { message: "Game saved." };
}

export async function duplicateGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }
  const id = text(formData, "id");
  if (!id) {
    return { error: "Choose a game to duplicate." };
  }
  const { data, error } = await access.supabase.rpc("duplicate_game", { source_id: id });
  if (error || !data) {
    return { error: error?.message ?? "The copy was not created." };
  }
  revalidatePath("/owner/games");
  redirect(`/owner/games/${data}`);
}

export async function deleteGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }
  const id = text(formData, "id");
  const slug = text(formData, "slug");
  const confirm = text(formData, "confirm");
  if (!id || !slug || confirm !== slug) {
    return { error: "Type the slug to delete this game." };
  }
  const { error } = await access.supabase.from("games").delete().eq("id", id).eq("slug", slug);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/owner/games");
  revalidatePath("/library");
  redirect("/owner/games");
}

export async function createCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const gameId = text(formData, "game_id");
  const title = text(formData, "title");
  const suit = text(formData, "suit");
  const rank = text(formData, "rank");
  if (!gameId || !title || !suit || !rank) {
    return { error: "A card needs a game, title, suit, and rank." };
  }
  if (!CARD_SUITS.includes(suit as (typeof CARD_SUITS)[number])) {
    return { error: "A card suit is spades, hearts, diamonds, or clubs." };
  }
  if (!RANKS.includes(rank as (typeof RANKS)[number])) {
    return { error: "Rank must be A, 2–10, J, Q, or K." };
  }

  const { data, error } = await access.supabase
    .from("cards")
    .insert({
      game_id: gameId,
      title,
      suit,
      rank,
      prompt: "",
      source: "proposal",
      publishable: false,
      effect: { kind: "custom", in_play: false },
      secret: {},
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "The card was not created." };
  }

  revalidatePath(`/owner/games/${gameId}`);
  redirect(`/owner/cards/${data.id}`);
}

export async function updateCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const id = text(formData, "id");
  const title = text(formData, "title");
  const prompt = text(formData, "prompt");
  if (!id || !title) {
    return { error: "A card needs an id and a title." };
  }

  const { data: current, error: readError } = await access.supabase
    .from("cards")
    .select("game_id")
    .eq("id", id)
    .single();
  if (readError || !current) {
    return { error: readError?.message ?? "That card is not stored." };
  }

  const { data: effectData, error: effectError } = await access.supabase.rpc("card_effect", { card_id: id });
  if (effectError) {
    return { error: effectError.message };
  }

  const { data: secretData, error: secretError } = await access.supabase.rpc("card_secret", { card_id: id });
  if (secretError) {
    return { error: secretError.message };
  }

  const publishable = formData.get("publishable") === "on";
  const inPlay = formData.get("in_play") === "on";
  const secret = asObject(secretData);
  const answer = text(formData, "secret_answer");
  if (answer) {
    secret.answer = answer;
  } else {
    delete secret.answer;
  }

  const effect = asObject(effectData);
  const note = typeof effect.owner_note === "string" ? effect.owner_note : "";
  if ((publishable || inPlay) && /plaintext/i.test(note) && !answer) {
    return {
      error: "This card stays out of play until you save a plaintext. Do not invent the page solution.",
    };
  }
  const wording = prompt.replace(/nothing is eaten/gi, "");
  if (publishable && UNSAFE_WORDING.test(wording)) {
    return {
      error: "That wording stays unpublished. Death, eaten, force, straf, and punishment do not ship.",
    };
  }

  const rounds = optionalNumber(formData, "rounds");
  const timer = optionalNumber(formData, "timer_seconds");
  if (Number.isNaN(rounds) || Number.isNaN(timer)) {
    return { error: "Rounds and the timer must be numbers." };
  }

  let scoring: unknown = {};
  const scoringRaw = text(formData, "scoring");
  if (scoringRaw) {
    try {
      scoring = JSON.parse(scoringRaw) as unknown;
    } catch {
      return { error: "Scoring has to be a JSON object." };
    }
    if (typeof scoring !== "object" || scoring === null || Array.isArray(scoring)) {
      return { error: "Scoring has to be a JSON object." };
    }
  }

  effect.rounds = rounds;
  effect.timer_seconds = timer;
  effect.question = text(formData, "question");
  effect.hints = text(formData, "hints")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  effect.scoring = scoring;
  effect.in_play = inPlay;

  const { data: saved, error } = await access.supabase
    .from("cards")
    .update({
      title,
      prompt,
      publishable,
      representative_id: representativeId(formData),
      effect,
      secret,
    })
    .eq("id", id)
    .select("id");

  if (error || !saved?.length) {
    return { error: error?.message ?? "The card was not saved." };
  }

  revalidatePath(`/owner/cards/${id}`);
  revalidatePath(`/owner/games/${current.game_id}`);
  revalidatePath("/library");
  return { message: "Card saved." };
}

export async function deleteCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }
  const id = text(formData, "id");
  const gameId = text(formData, "game_id");
  const confirm = text(formData, "confirm");
  if (!id || confirm !== "delete") {
    return { error: "Type delete to remove this card." };
  }
  const { error } = await access.supabase.from("cards").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  if (gameId) {
    revalidatePath(`/owner/games/${gameId}`);
  }
  revalidatePath("/owner/cards");
  revalidatePath("/library");
  redirect(gameId ? `/owner/games/${gameId}` : "/owner/cards");
}

export async function updateRepresentative(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id || !name) {
    return { error: "A representative needs a name." };
  }

  const dialogue: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("dialogue__") && typeof value === "string" && value.trim()) {
      dialogue[key.slice("dialogue__".length)] = value.trim();
    }
  }
  const newKey = text(formData, "new_key").replace(/[^a-z0-9_]/g, "");
  const newValue = text(formData, "new_value");
  if (newKey && newValue) {
    dialogue[newKey] = newValue;
  }

  const { error } = await access.supabase
    .from("representatives")
    .update({
      name,
      bio: text(formData, "bio"),
      portrait_url: text(formData, "portrait_url"),
      dialogue,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/owner/representatives");
  revalidatePath(`/owner/representatives/${id}`);
  return { message: "Representative saved." };
}

export async function updateAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await owner();
  if ("error" in access) {
    return access;
  }

  const id = text(formData, "id");
  const title = text(formData, "title");
  const body = text(formData, "body");
  if (!id || !title || !body) {
    return { error: "An announcement needs a title and a body." };
  }

  const seconds = optionalNumber(formData, "seconds");
  if (Number.isNaN(seconds)) {
    return { error: "The countdown has to be a number of seconds." };
  }

  const { data: current, error: readError } = await access.supabase
    .from("announcements")
    .select("timing, slug")
    .eq("id", id)
    .single();
  if (readError || !current) {
    return { error: readError?.message ?? "That announcement is not stored." };
  }

  const timing = asObject(current.timing);
  if (seconds === null) {
    delete timing.seconds;
  } else {
    timing.seconds = seconds;
  }

  const { error } = await access.supabase
    .from("announcements")
    .update({
      title,
      body,
      representative_id: representativeId(formData),
      timing,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/owner/announcements");
  revalidatePath(`/owner/announcements/${current.slug}`);
  return { message: "Announcement saved." };
}
