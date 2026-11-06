import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";

import { getVerifiedUser } from "@/lib/auth";
import {
  clearsFor,
  collectionStanding,
  rankByPoints,
  readCollectionRule,
  readHistory,
  victoriesFor,
  type ScoreRow,
} from "@/lib/progression";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ProfileCollection = {
  id: string;
  title: string;
  description: string;
  sentence: string;
  clears: number;
  required: number;
  complete: boolean;
};

export type ProfileCard = {
  id: string;
  title: string;
  suit: string;
  rank: string;
};

export type ProfileSession = {
  id: string;
  roomCode: string;
  status: string;
  points: number;
  place: number;
  field: number;
};

export type ProfileView = {
  account: { name: string; role: string } | null;
  collections: ProfileCollection[];
  cards: ProfileCard[];
  sessions: ProfileSession[];
  victories: number;
  guestSession: { roomCode: string; status: string; ranking: { name: string; points: number }[] } | null;
  note: string;
};

export async function loadProfile(): Promise<
  { ok: true; view: ProfileView } | { ok: false; unconfigured: true } | { ok: false; message: string }
> {
  await connection();
  if (!isSupabaseConfigured()) {
    return { ok: false, unconfigured: true };
  }
  const supabase = await createClient();
  const { data: published, error } = await supabase
    .from("collections")
    .select("id, title, description, rules")
    .eq("published", true)
    .order("title");
  if (error) {
    return { ok: false, message: error.message };
  }

  const user = await getVerifiedUser();
  const admin = createAdminClient();
  const collections: ProfileCollection[] = [];
  let cards: ProfileCard[] = [];
  let sessions: ProfileSession[] = [];
  let victories = 0;
  let note = "";

  if (user && admin) {
    const { data: seats, error: seatError } = await admin
      .from("participants")
      .select("id, session_id")
      .eq("user_id", user.userId);
    if (seatError) {
      return { ok: false, message: seatError.message };
    }
    const seatIds = (seats ?? []).map((seat) => seat.id).filter((id): id is string => typeof id === "string");
    const sessionIds = [...new Set((seats ?? []).map((seat) => seat.session_id).filter((id): id is string => typeof id === "string"))];
    const { data: scoreRows } = seatIds.length
      ? await admin.from("scores").select("session_id, participant_id, points, result").in("participant_id", seatIds)
      : { data: [] };
    const history = (scoreRows ?? []).flatMap((row) => readHistory(row.result));
    const cardIds = [...new Set(history.map((change) => change.card_id))];
    const { data: cardRows } = cardIds.length
      ? await admin.from("cards").select("id, suit, rank, title").in("id", cardIds)
      : { data: [] };
    const suitByCard = new Map<string, string>();
    const cardById = new Map<string, ProfileCard>();
    for (const card of cardRows ?? []) {
      if (typeof card.id === "string" && typeof card.suit === "string") {
        suitByCard.set(card.id, card.suit);
        cardById.set(card.id, {
          id: card.id,
          title: typeof card.title === "string" ? card.title : card.id,
          suit: card.suit,
          rank: typeof card.rank === "string" ? card.rank : "",
        });
      }
    }
    const cleared = new Set<string>();
    for (const row of published ?? []) {
      const rule = readCollectionRule(row.rules);
      if (!rule || typeof row.id !== "string" || typeof row.title !== "string") {
        continue;
      }
      const matches = clearsFor(history, suitByCard, rule);
      for (const match of matches) {
        cleared.add(match.cardId);
      }
      const standing = collectionStanding(matches.length, rule);
      collections.push({
        id: row.id,
        title: row.title,
        description: typeof row.description === "string" ? row.description : "",
        sentence: standing.sentence,
        clears: standing.clears,
        required: standing.required,
        complete: standing.complete,
      });
    }
    cards = [...cleared].map((id) => cardById.get(id)).filter((card): card is ProfileCard => Boolean(card));

    if (sessionIds.length > 0) {
      const { data: sessionRows } = await admin
        .from("sessions")
        .select("id, room_code, status, created_at")
        .in("id", sessionIds);
      const { data: allScores } = await admin
        .from("scores")
        .select("session_id, participant_id, points")
        .in("session_id", sessionIds);
      const bySession = new Map<string, ScoreRow[]>();
      for (const row of allScores ?? []) {
        if (typeof row.session_id !== "string" || typeof row.participant_id !== "string" || typeof row.points !== "number") {
          continue;
        }
        const list = bySession.get(row.session_id) ?? [];
        list.push({ participantId: row.participant_id, points: row.points });
        bySession.set(row.session_id, list);
      }
      const mine = new Set(seatIds);
      const ended: { scores: ScoreRow[] }[] = [];
      sessions = (sessionRows ?? [])
        .filter((row) => typeof row.id === "string")
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .map((row) => {
          const scores = bySession.get(row.id) ?? [];
          const ranked = rankByPoints(scores);
          const place = ranked.findIndex((score) => mine.has(score.participantId));
          const mineScore = scores.find((score) => mine.has(score.participantId));
          if (row.status === "ended") {
            ended.push({ scores });
          }
          return {
            id: row.id,
            roomCode: typeof row.room_code === "string" ? row.room_code : "",
            status: typeof row.status === "string" ? row.status : "",
            points: mineScore?.points ?? 0,
            place: place >= 0 ? place + 1 : scores.length,
            field: scores.length,
          };
        });
      victories = victoriesFor(ended, mine);
    }
  } else {
    for (const row of published ?? []) {
      const rule = readCollectionRule(row.rules);
      if (!rule || typeof row.id !== "string" || typeof row.title !== "string") {
        continue;
      }
      const standing = collectionStanding(0, rule);
      collections.push({
        id: row.id,
        title: row.title,
        description: typeof row.description === "string" ? row.description : "",
        sentence: standing.sentence,
        clears: 0,
        required: standing.required,
        complete: false,
      });
    }
    if (user && !admin) {
      note = "Collection progress reads stored scores with the server key.";
    }
  }

  let guestSession: ProfileView["guestSession"] = null;
  if (!user && admin) {
    const cookieStore = await cookies();
    const participantId = cookieStore.get("sos_participant")?.value;
    if (participantId) {
      const { data: seat } = await admin
        .from("participants")
        .select("id, session_id, sessions(room_code, status)")
        .eq("id", participantId)
        .maybeSingle();
      const sessionId = typeof seat?.session_id === "string" ? seat.session_id : null;
      if (sessionId) {
        const { data: people } = await admin
          .from("participants")
          .select("id, display_name")
          .eq("session_id", sessionId);
        const { data: scores } = await admin.from("scores").select("participant_id, points").eq("session_id", sessionId);
        const names = new Map((people ?? []).map((person) => [person.id, person.display_name]));
        const ranked = rankByPoints(
          (scores ?? [])
            .filter((row) => typeof row.participant_id === "string" && typeof row.points === "number")
            .map((row) => ({ participantId: row.participant_id as string, points: row.points as number })),
        );
        const session = Array.isArray(seat?.sessions) ? seat.sessions[0] : seat?.sessions;
        guestSession = {
          roomCode: typeof session?.room_code === "string" ? session.room_code : "",
          status: typeof session?.status === "string" ? session.status : "",
          ranking: ranked.map((row) => ({
            name: typeof names.get(row.participantId) === "string" ? (names.get(row.participantId) as string) : "Player",
            points: row.points,
          })),
        };
      }
    }
  }

  return {
    ok: true,
    view: {
      account: user?.profile ? { name: user.profile.display_name, role: user.profile.role } : null,
      collections,
      cards,
      sessions,
      victories,
      guestSession,
      note,
    },
  };
}
