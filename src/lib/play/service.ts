import "server-only";

import { cookies } from "next/headers";

import { getVerifiedUser } from "@/lib/auth";
import {
  actorCount,
  applyPending,
  assignActors,
  asObject,
  dealHands,
  emptyPhone,
  isPlayerFacing,
  pickCard,
  publicEffect,
  publicPlay,
  resolveCard,
  sanitizeMove,
  statusAfterElimination,
  voteChoice,
  type CardFace,
  type Move,
  type Pending,
  type PhoneTrack,
  type Seat,
} from "@/lib/engine/play";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverSupabaseKey, supabaseUrl } from "@/lib/supabase/env";
import {
  SKIP_MESSAGE,
  advanceBeat,
  beatTrigger,
  hintText,
  physicalCopy,
  playingSeats,
  releasedAnswer,
  releasedHint,
  shiftDeadline,
  type Audience,
} from "@/lib/engine/table";
import { appendChange, readHistory } from "@/lib/progression";
import { cleanRoomCode } from "@/lib/validate";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type RoomSettings = {
  draw_limit: number;
  draws_done: number;
  digital_elimination: boolean;
  hand_size: number;
  dealt: string[];
  hands: Record<string, string[]>;
  forehead: Record<string, string>;
  pending: Pending[];
  phone: PhoneTrack;
  inner: number;
  force_card_id: string | null;
  notice: string;
  beat: string;
  beat_until: number | null;
  hint_revealed: boolean;
  answer_revealed: boolean;
};

export type PlayView = {
  roomCode: string;
  sessionId: string;
  status: string;
  you: { id: string; role: string; status: string } | null;
  isHost: boolean;
  players: { id: string; name: string; role: string; status: string; points: number }[];
  drawsDone: number;
  drawLimit: number;
  notice: string;
  announcement: string;
  mode: string;
  beat: string;
  deadline: string | null;
  hint: string | null;
  answer: string | null;
  screen: {
    trigger: string;
    title: string;
    body: string;
    seconds: number | null;
    representative: { name: string; portrait_url: string | null; suit: string | null } | null;
  } | null;
  card: {
    title: string;
    suit: string;
    rank: string;
    prompt: string;
    question: string;
    kind: string;
    input: string;
    choices: string[];
    options: { value: string; label: string }[];
    privateNote: string;
    message: string;
    inner: number;
    innerCount: number;
    yours: boolean;
    physicalOptional: boolean;
    phoneAlternative: string | null;
  } | null;
};

type SessionRow = {
  id: string;
  room_code: string;
  status: string;
  game_id: string | null;
  host_user_id: string;
  mode: string;
  settings_snapshot: unknown;
};

type Person = Seat & {
  user_id: string | null;
  display_name: string;
  role: string;
  joined_at: string;
};

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringMap(value: unknown) {
  const source = asObject(value);
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (typeof entry === "string") {
      map[key] = entry;
    }
  }
  return map;
}

function handsOf(value: unknown) {
  const source = asObject(value);
  const hands: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(source)) {
    hands[key] = strings(entry);
  }
  return hands;
}

function readSettings(value: unknown): RoomSettings {
  const row = asObject(value);
  const phone = asObject(row.phone);
  return {
    draw_limit: typeof row.draw_limit === "number" ? row.draw_limit : 8,
    draws_done: typeof row.draws_done === "number" ? row.draws_done : 0,
    digital_elimination: row.digital_elimination === true,
    hand_size: typeof row.hand_size === "number" ? row.hand_size : 5,
    dealt: strings(row.dealt),
    hands: handsOf(row.hands),
    forehead: stringMap(row.forehead),
    pending: Array.isArray(row.pending) ? (row.pending as Pending[]) : [],
    phone: {
      taps: asObject(phone.taps) as Record<string, number>,
      holdStart: asObject(phone.holdStart) as Record<string, number>,
      stillStart: asObject(phone.stillStart) as Record<string, number>,
      stillTapped: asObject(phone.stillTapped) as Record<string, boolean>,
      passes: typeof phone.passes === "number" ? phone.passes : 0,
      cups: typeof phone.cups === "number" ? phone.cups : 0,
    },
    inner: typeof row.inner === "number" ? row.inner : 1,
    force_card_id: typeof row.force_card_id === "string" ? row.force_card_id : null,
    notice: typeof row.notice === "string" ? row.notice : "",
    beat: typeof row.beat === "string" ? row.beat : "",
    beat_until: typeof row.beat_until === "number" ? row.beat_until : null,
    hint_revealed: row.hint_revealed === true,
    answer_revealed: row.answer_revealed === true,
  };
}

async function broadcast(sessionId: string) {
  const url = supabaseUrl();
  const key = serverSupabaseKey();
  if (!url || !key) {
    return;
  }
  await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ topic: `session:${sessionId}`, event: "state", payload: { ok: true } }],
    }),
  }).catch(() => undefined);
}

async function people(admin: Admin, sessionId: string) {
  const { data, error } = await admin
    .from("participants")
    .select("id, user_id, display_name, role, status, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as Person[];
}

async function pointsOf(admin: Admin, sessionId: string) {
  const { data, error } = await admin.from("scores").select("participant_id, points").eq("session_id", sessionId);
  if (error) {
    throw new Error(error.message);
  }
  const points = new Map<string, number>();
  for (const row of data ?? []) {
    if (typeof row.participant_id === "string" && typeof row.points === "number") {
      points.set(row.participant_id, row.points);
    }
  }
  return points;
}

async function pool(admin: Admin, gameId: string) {
  const { data, error } = await admin
    .from("cards")
    .select("id, suit, rank, title, prompt, source, effect, secret, publishable")
    .eq("game_id", gameId);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? [])
    .filter((row) => isPlayerFacing({ publishable: row.publishable === true, effect: asObject(row.effect) }))
    .map((row) => ({
      id: String(row.id),
      suit: String(row.suit),
      rank: String(row.rank),
      title: String(row.title ?? ""),
      prompt: String(row.prompt ?? ""),
      source: String(row.source),
      effect: asObject(row.effect),
      secret: asObject(row.secret),
    })) satisfies CardFace[];
}

async function saveSettings(admin: Admin, sessionId: string, settings: RoomSettings) {
  const { error } = await admin.from("sessions").update({ settings_snapshot: settings }).eq("id", sessionId);
  if (error) {
    throw new Error(error.message);
  }
}

async function loadScreen(admin: Admin, gameId: string | null, trigger: string, suit: string | null, cardTitle: string) {
  if (!gameId) {
    return null;
  }
  const { data } = await admin
    .from("announcements")
    .select("title, body, timing, representative_id, trigger")
    .eq("game_id", gameId)
    .eq("trigger", trigger)
    .order("slug", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) {
    return null;
  }
  let representative: { name: string; portrait_url: string | null; suit: string | null } | null = null;
  if (typeof data.representative_id === "string") {
    const { data: person } = await admin
      .from("representatives")
      .select("name, portrait_url, suit")
      .eq("id", data.representative_id)
      .maybeSingle();
    if (person && typeof person.name === "string") {
      representative = {
        name: person.name,
        portrait_url: typeof person.portrait_url === "string" ? person.portrait_url : null,
        suit: typeof person.suit === "string" ? person.suit : null,
      };
    }
  } else if (suit) {
    const { data: person } = await admin
      .from("representatives")
      .select("name, portrait_url, suit")
      .eq("suit", suit)
      .eq("role", "representative")
      .limit(1)
      .maybeSingle();
    if (person && typeof person.name === "string") {
      representative = {
        name: person.name,
        portrait_url: typeof person.portrait_url === "string" ? person.portrait_url : null,
        suit: typeof person.suit === "string" ? person.suit : null,
      };
    }
  }
  const timing = asObject(data.timing);
  const body = typeof data.body === "string" ? data.body : "";
  return {
    trigger: typeof data.trigger === "string" ? data.trigger : trigger,
    title: typeof data.title === "string" ? data.title : trigger,
    body: body.replaceAll("[Name]", "").replaceAll("[Card title]", cardTitle),
    seconds: typeof timing.seconds === "number" ? timing.seconds : null,
    representative,
  };
}

async function announcement(admin: Admin, gameId: string | null, trigger: string, name: string, title: string) {
  if (!gameId) {
    return "";
  }
  const { data } = await admin
    .from("announcements")
    .select("body")
    .eq("game_id", gameId)
    .eq("trigger", trigger)
    .order("slug", { ascending: true })
    .limit(1)
    .maybeSingle();
  const body = typeof data?.body === "string" ? data.body : "";
  return body.replaceAll("[Name]", name).replaceAll("[Card title]", title);
}

async function addDeltas(
  admin: Admin,
  sessionId: string,
  cardId: string,
  draw: number,
  deltas: { participantId: string; points: number; reason: string }[],
) {
  if (deltas.length === 0) {
    return;
  }
  const { data, error: readError } = await admin
    .from("scores")
    .select("participant_id, points, result")
    .eq("session_id", sessionId);
  if (readError) {
    throw new Error(readError.message);
  }
  const current = new Map<string, { points: number; result: unknown }>();
  for (const row of data ?? []) {
    if (typeof row.participant_id === "string" && typeof row.points === "number") {
      current.set(row.participant_id, { points: row.points, result: row.result });
    }
  }
  const grouped = new Map<string, { points: number; reason: string }>();
  for (const delta of deltas) {
    const previous = grouped.get(delta.participantId);
    grouped.set(delta.participantId, {
      points: (previous?.points ?? 0) + delta.points,
      reason: delta.reason,
    });
  }
  for (const [participantId, delta] of grouped) {
    const previous = current.get(participantId);
    const points = (previous?.points ?? 0) + delta.points;
    const history = appendChange(readHistory(previous?.result), {
      card_id: cardId,
      draw,
      points: delta.points,
      reason: delta.reason,
    });
    const { error } = await admin.from("scores").upsert(
      {
        session_id: sessionId,
        participant_id: participantId,
        points,
        result: { card_id: cardId, reason: delta.reason, history },
      },
      { onConflict: "session_id,participant_id" },
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function finish(admin: Admin, session: SessionRow, settings: RoomSettings, seats: Person[]) {
  const scoreMap = await pointsOf(admin, session.id);
  const before = playingSeats(seats, session.mode).map((seat) => ({
    id: seat.id,
    status: seat.status,
    points: scoreMap.get(seat.id) ?? 0,
  }));
  const after = statusAfterElimination(before, settings.digital_elimination);
  const eliminated = after.filter((seat, index) => seat.status === "eliminated" && before[index]?.status !== "eliminated");
  for (const seat of eliminated) {
    await admin.from("participants").update({ status: "eliminated" }).eq("id", seat.id);
  }
  const name = seats.find((seat) => seat.id === eliminated[0]?.id)?.display_name ?? "";
  settings.notice = eliminated.length
    ? await announcement(admin, session.game_id, "player_eliminated", name, "")
    : await announcement(admin, session.game_id, "game_over", "", "");
  if (session.mode === "real_life") {
    settings.beat = "game_over";
    settings.beat_until = null;
  }
  await saveSettings(admin, session.id, settings);
  await admin.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", session.id);
}

async function openDraw(admin: Admin, session: SessionRow, settings: RoomSettings, seats: Person[]) {
  if (!session.game_id) {
    throw new Error("This room has no published game.");
  }
  const cards = await pool(admin, session.game_id);
  const picked = pickCard(cards, settings.dealt, settings.force_card_id);
  if (!picked.id) {
    settings.notice = picked.message ?? "No card is left.";
    await finish(admin, session, settings, seats);
    return;
  }
  const face = cards.find((item) => item.id === picked.id);
  if (!face) {
    throw new Error("The drawn card could not be loaded.");
  }
  const active = playingSeats(seats, session.mode);
  const needed = Math.min(actorCount(face.effect, active.length), active.length);
  const actors = assignActors(active, settings.draws_done + 1, needed);
  if (settings.force_card_id === face.id) {
    settings.force_card_id = null;
  }
  settings.forehead = {};
  if (face.effect.kind === "forehead" && actors.length >= 4) {
    const ids = cards.map((item) => item.id).filter((id) => id !== face.id);
    const dealt = dealHands(ids, actors.map((seat) => seat.id), 1);
    settings.forehead = Object.fromEntries(Object.entries(dealt).map(([id, hand]) => [id, hand[0] ?? ""]));
  }
  settings.inner = 1;
  settings.phone = emptyPhone();
  settings.hint_revealed = false;
  settings.answer_revealed = false;
  if (session.mode === "real_life" && (settings.beat === "" || settings.beat === "play")) {
    settings.beat = "draw";
    settings.beat_until = Date.now() + 4000;
  }
  const timer = face.effect.timer_seconds;
  const deadline = typeof timer === "number" ? new Date(Date.now() + timer * 1000).toISOString() : null;
  const { data, error } = await admin
    .from("rounds")
    .insert({
      session_id: session.id,
      game_id: session.game_id,
      card_id: face.id,
      index: settings.draws_done + 1,
      state: "open",
      opened_at: new Date().toISOString(),
      deadline_at: deadline,
      resolution: { actors: actors.map((seat) => seat.id) },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "The draw was not stored.");
  }
  settings.notice = await announcement(admin, session.game_id, "card_drawn", "", face.title);
  await saveSettings(admin, session.id, settings);
}

async function closeCard(
  admin: Admin,
  session: SessionRow,
  settings: RoomSettings,
  seats: Person[],
  card: CardFace,
  roundId: string,
  outcome: ReturnType<typeof resolveCard>,
  actorIds: string[],
) {
  const { data: closed, error: closeError } = await admin.rpc("close_round", {
    round_id: roundId,
    next_resolution: { message: outcome.message, deltas: outcome.deltas, resolvable: outcome.resolvable },
  });
  if (closeError) {
    throw new Error(closeError.message);
  }
  if (closed !== true) {
    return;
  }
  const deferred = applyPending(settings.pending, outcome.deltas, actorIds);
  await addDeltas(admin, session.id, card.id, settings.draws_done + 1, [...outcome.deltas, ...deferred]);
  settings.hands = outcome.hands;
  settings.phone = outcome.phone;
  settings.pending = outcome.pending;
  const assigned = outcome.pending.find((item) => item.type === "assigned");
  settings.force_card_id = assigned && assigned.type === "assigned" ? assigned.cardId : null;
  if (!settings.dealt.includes(card.id)) {
    settings.dealt.push(card.id);
  }
  settings.draws_done += 1;
  settings.notice = outcome.message;
  if (session.mode === "real_life") {
    settings.beat = "success";
    settings.beat_until = Date.now() + 4000;
  }
  await saveSettings(admin, session.id, settings);
  if (settings.draws_done >= settings.draw_limit && !settings.force_card_id) {
    await finish(admin, session, settings, seats);
    return;
  }
  await openDraw(admin, session, settings, seats);
}

async function settle(admin: Admin, session: SessionRow, settings: RoomSettings, seats: Person[], advance: boolean): Promise<"idle" | "waiting" | "advanced"> {
  if (!session.game_id || session.status !== "live") {
    return "idle";
  }
  const { data: round } = await admin
    .from("rounds")
    .select("id, card_id, deadline_at, resolution")
    .eq("session_id", session.id)
    .eq("state", "open")
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round?.card_id) {
    return "idle";
  }
  const cards = await pool(admin, session.game_id);
  const face = cards.find((item) => item.id === round.card_id);
  if (!face) {
    return "idle";
  }
  const { data: answers } = await admin
    .from("answers")
    .select("participant_id, payload, submitted_at")
    .eq("round_id", round.id);
  let moves: Move[] = (answers ?? [])
    .filter((row) => asObject(row.payload).inner === settings.inner)
    .map((row) => ({
      participantId: String(row.participant_id),
      payload: sanitizeMove(row.payload),
      at: Date.parse(String(row.submitted_at)),
    }));
  if (face.effect.kind === "role_pick") {
    const { data: votes } = await admin
      .from("votes")
      .select("voter_participant_id, choice, created_at")
      .eq("round_id", round.id);
    if (votes && votes.length > 0) {
      moves = votes.map((row) => ({
        participantId: String(row.voter_participant_id),
        payload: voteChoice(row.choice),
        at: Date.parse(String(row.created_at)),
      }));
    }
  }
  const actorIds = strings(asObject(round.resolution).actors);
  const actors = seats.filter((seat) => actorIds.includes(seat.id));
  const innerCount = typeof face.effect.rounds === "number" ? face.effect.rounds : 1;
  const outcome = resolveCard(
    face,
    {
      actors,
      moves,
      inner: settings.inner,
      innerCount,
      now: Date.now(),
      deadlineAt: round.deadline_at ? Date.parse(String(round.deadline_at)) : null,
      hands: settings.hands,
      forehead: settings.forehead,
      phone: emptyPhone(),
    },
    cards.map((item) => item.id),
  );
  if (!outcome.ready) {
    return "waiting";
  }
  if (outcome.resolvable && !outcome.complete) {
    const { data: claimed, error: claimError } = await admin.rpc("claim_round_step", {
      round_id: round.id,
      step: settings.inner,
      next_resolution: { actors: actorIds, scored_inner: settings.inner, message: outcome.message },
    });
    if (claimError) {
      throw new Error(claimError.message);
    }
    if (claimed !== true) {
      return "idle";
    }
    await addDeltas(admin, session.id, face.id, settings.draws_done + 1, outcome.deltas);
    settings.inner += 1;
    settings.hands = outcome.hands;
    settings.notice = outcome.message;
    await saveSettings(admin, session.id, settings);
    return "advanced";
  }
  if (!outcome.resolvable && !advance) {
    settings.notice = outcome.message;
    await saveSettings(admin, session.id, settings);
    return "waiting";
  }
  await closeCard(admin, session, settings, seats, face, String(round.id), outcome, actors.map((seat) => seat.id));
  return "advanced";
}

export async function readPlay(rawCode: string, audience: Audience = "room"): Promise<
  | { kind: "unconfigured" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: PlayView }
> {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { kind: "invalid" };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { kind: "unconfigured" };
  }
  const { data, error } = await admin
    .from("sessions")
    .select("id, room_code, status, mode, game_id, host_user_id, settings_snapshot")
    .eq("room_code", roomCode)
    .maybeSingle();
  if (error) {
    return { kind: "error", message: error.message };
  }
  if (!data) {
    return { kind: "missing" };
  }
  const session = data as SessionRow;
  let settings = readSettings(session.settings_snapshot);
  let seats = await people(admin, session.id);
  if (session.status === "live") {
    try {
      await settle(admin, session, settings, seats, false);
    } catch (caught) {
      return { kind: "error", message: caught instanceof Error ? caught.message : "The room could not be read." };
    }
    const refreshed = await admin
      .from("sessions")
      .select("id, room_code, status, mode, game_id, host_user_id, settings_snapshot")
      .eq("id", session.id)
      .single();
    if (refreshed.data) {
      Object.assign(session, refreshed.data);
      settings = readSettings(session.settings_snapshot);
      seats = await people(admin, session.id);
    }
  }
  if (session.mode === "real_life" && session.status === "live") {
    const next = advanceBeat(settings.beat, settings.beat_until, Date.now());
    if (next.beat !== settings.beat || next.until !== settings.beat_until) {
      settings.beat = next.beat;
      settings.beat_until = next.until;
      await saveSettings(admin, session.id, settings);
    }
  }
  const user = await getVerifiedUser();
  const cookieStore = await cookies();
  const cookieId = cookieStore.get("sos_participant")?.value ?? null;
  const you = seats.find((seat) => user && seat.user_id === user.userId) ?? seats.find((seat) => seat.id === cookieId) ?? null;
  const scoreMap = await pointsOf(admin, session.id);
  let card: PlayView["card"] = null;
  let deadline: string | null = null;
  let hint: string | null = null;
  let answer: string | null = null;
  let suitForScreen: string | null = null;
  if (session.game_id && session.status !== "lobby") {
    const { data: round } = await admin
      .from("rounds")
      .select("id, card_id, resolution, state, deadline_at")
      .eq("session_id", session.id)
      .order("index", { ascending: false })
      .limit(1)
      .maybeSingle();
    deadline = typeof round?.deadline_at === "string" ? round.deadline_at : null;
    if (round?.card_id) {
      const cards = await pool(admin, session.game_id);
      const face = cards.find((item) => item.id === round.card_id);
      if (face) {
        const actorIds = strings(asObject(round.resolution).actors);
        const actors = seats.filter((seat) => actorIds.includes(seat.id));
        const viewerId = audience === "board" ? null : you?.id ?? null;
        const shown = publicPlay(face, viewerId, actors);
        const copy = physicalCopy(face.effect);
        suitForScreen = face.suit;
        hint = releasedHint(hintText(face.effect), settings.hint_revealed);
        const storedAnswer = typeof face.secret.answer === "string" ? face.secret.answer : null;
        answer = releasedAnswer(storedAnswer, settings.answer_revealed, audience, Boolean(user && user.userId === session.host_user_id));
        const effect = publicEffect(face.effect);
        const labels = new Map(cards.map((item) => [item.id, `${item.rank} ${item.suit}`]));
        let options = shown.choices.map((choice) => ({ value: choice, label: choice }));
        if (shown.input === "player" || shown.input === "assign") {
          options = seats
            .filter((seat) => seat.status === "active" && seat.id !== you?.id)
            .map((seat) => ({ value: seat.id, label: seat.display_name }));
        }
        if (face.effect.kind === "forehead") {
          options = Object.values(settings.forehead)
            .filter(Boolean)
            .map((id) => ({ value: id, label: labels.get(id) ?? "Card" }));
          if (you) {
            const others = actors
              .filter((seat) => seat.id !== you.id && settings.forehead[seat.id])
              .map((seat) => `${seat.display_name}: ${labels.get(settings.forehead[seat.id]) ?? "Card"}`);
            shown.privateNote = others.join(". ");
          }
        }
        if (face.effect.kind === "trade" && you) {
          const partner = actors.find((seat) => seat.id !== you.id);
          options = (settings.hands[you.id] ?? []).map((id) => ({ value: id, label: labels.get(id) ?? "Card" }));
          shown.privateNote = partner
            ? `Their hand: ${(settings.hands[partner.id] ?? []).map((id) => labels.get(id) ?? "Card").join(", ")}`
            : "";
        }
        if (face.effect.kind === "pass_around" && you) {
          options = (settings.hands[you.id] ?? []).map((id) => ({ value: id, label: labels.get(id) ?? "Card" }));
        }
        if (face.effect.kind === "assigned_replay") {
          options = cards.map((item) => ({ value: item.id, label: `${item.rank} ${item.title}` }));
        }
        const innerCount = typeof effect.rounds === "number" ? effect.rounds : 1;
        card = {
          title: shown.title,
          suit: face.suit,
          rank: face.rank,
          prompt: shown.prompt,
          question: shown.question,
          kind: shown.kind,
          input: round.state === "resolved" ? "done" : shown.input,
          choices: shown.choices,
          options,
          privateNote: shown.privateNote,
          message: settings.notice,
          inner: settings.inner,
          innerCount,
          yours: audience !== "board" && Boolean(you && actors.some((seat) => seat.id === you.id) && you.status === "active"),
          physicalOptional: copy.optional,
          phoneAlternative: copy.phone,
        };
      }
    }
  }
  const beat = session.mode === "real_life" ? settings.beat : "";
  const trigger = beatTrigger(beat);
  const screen = trigger ? await loadScreen(admin, session.game_id, trigger, suitForScreen, card?.title ?? "") : null;
  return {
    kind: "ready",
    view: {
      roomCode: session.room_code,
      sessionId: session.id,
      status: session.status,
      you: you ? { id: you.id, role: you.role, status: you.status } : null,
      isHost: Boolean(user && user.userId === session.host_user_id),
      players: seats.map((seat) => ({
        id: seat.id,
        name: seat.display_name,
        role: seat.role,
        status: seat.status,
        points: scoreMap.get(seat.id) ?? 0,
      })),
      drawsDone: settings.draws_done,
      drawLimit: settings.draw_limit,
      notice: settings.notice,
      announcement: settings.notice,
      mode: session.mode,
      beat,
      deadline: beat === "play" ? deadline : null,
      hint,
      answer,
      screen,
      card,
    },
  };
}

async function hostSession(roomCode: string) {
  const admin = createAdminClient();
  if (!admin) {
    return { error: "Play needs the server key in .env.local." } as const;
  }
  const user = await getVerifiedUser();
  if (!user) {
    return { error: "Sign in as the host." } as const;
  }
  const { data, error } = await admin
    .from("sessions")
    .select("id, room_code, status, mode, game_id, host_user_id, settings_snapshot")
    .eq("room_code", roomCode)
    .maybeSingle();
  if (error || !data) {
    return { error: error?.message ?? "No room uses that code." } as const;
  }
  if (data.host_user_id !== user.userId) {
    return { error: "Only the host can do that." } as const;
  }
  return { admin, session: data as SessionRow } as const;
}

export async function startPlay(rawCode: string) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const access = await hostSession(roomCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (session.status !== "lobby") {
    return { error: "The room has already started." };
  }
  const { data: game } = await admin
    .from("games")
    .select("id, rules")
    .eq("slug", "suit-of-survival")
    .eq("status", "published")
    .maybeSingle();
  const gameId = session.game_id ?? (typeof game?.id === "string" ? game.id : null);
  if (!gameId) {
    return { error: "No published game is stored. Apply the Phase 3 migration." };
  }
  const rules = asObject(game?.rules);
  const settings = readSettings(session.settings_snapshot);
  settings.draw_limit = typeof rules.draws === "number" ? rules.draws : 8;
  settings.digital_elimination = rules.digital_elimination === true;
  settings.hand_size = typeof rules.hand_size === "number" ? rules.hand_size : 5;
  const seats = await people(admin, session.id);
  const cards = await pool(admin, gameId);
  settings.hands = dealHands(
    cards.map((item) => item.id),
    playingSeats(seats, session.mode).map((seat) => seat.id),
    settings.hand_size,
  );
  if (session.mode === "real_life") {
    settings.beat = "start";
    settings.beat_until = Date.now() + 4000;
  }
  await admin.from("sessions").update({ status: "live", game_id: gameId }).eq("id", session.id);
  for (const seat of seats) {
    await admin.from("scores").upsert(
      { session_id: session.id, participant_id: seat.id, points: 0, result: {} },
      { onConflict: "session_id,participant_id" },
    );
  }
  session.game_id = gameId;
  session.status = "live";
  settings.notice = await announcement(admin, gameId, "session_start", "", "");
  await saveSettings(admin, session.id, settings);
  await openDraw(admin, session, settings, seats);
  await broadcast(session.id);
  return { ok: true };
}

export async function setPlayStatus(rawCode: string, status: "paused" | "live" | "ended") {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const access = await hostSession(roomCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (status === "ended") {
    const settings = readSettings(session.settings_snapshot);
    const seats = await people(admin, session.id);
    await finish(admin, session, settings, seats);
  } else if (status === "paused" && session.status === "live") {
    const settings = readSettings(session.settings_snapshot);
    if (session.mode === "real_life") {
      settings.beat = "pause";
      settings.beat_until = null;
      await saveSettings(admin, session.id, settings);
    }
    await admin.from("sessions").update({ status: "paused" }).eq("id", session.id);
  } else if (status === "live" && session.status === "paused") {
    const settings = readSettings(session.settings_snapshot);
    if (session.mode === "real_life") {
      settings.beat = "play";
      settings.beat_until = null;
      await saveSettings(admin, session.id, settings);
    }
    await admin.from("sessions").update({ status: "live" }).eq("id", session.id);
  } else {
    return { error: "That control does not apply to this room." };
  }
  await broadcast(session.id);
  return { ok: true };
}

export async function advancePlay(rawCode: string) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const access = await hostSession(roomCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (session.status !== "live") {
    return { error: "The room is not live." };
  }
  const settings = readSettings(session.settings_snapshot);
  const seats = await people(admin, session.id);
  const result = await settle(admin, session, settings, seats, true);
  await broadcast(session.id);
  if (result === "waiting") {
    return { error: "This card is still open. It can still be played." };
  }
  return { ok: true };
}

export async function stopPlaying(rawCode: string) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: "Play needs the server key in .env.local." };
  }
  const loaded = await readPlay(roomCode);
  if (loaded.kind !== "ready" || !loaded.view.you) {
    return { error: "Join the room before stopping." };
  }
  if (loaded.view.you.status !== "active") {
    return { error: "You have already stopped." };
  }
  await admin.from("participants").update({ status: "stopped" }).eq("id", loaded.view.you.id);
  const { data } = await admin
    .from("sessions")
    .select("id, game_id, settings_snapshot")
    .eq("id", loaded.view.sessionId)
    .single();
  if (data) {
    const settings = readSettings(data.settings_snapshot);
    const name = loaded.view.players.find((player) => player.id === loaded.view.you?.id)?.name ?? "";
    settings.notice = await announcement(admin, data.game_id, "player_stopped", name, "");
    await saveSettings(admin, loaded.view.sessionId, settings);
  }
  await broadcast(loaded.view.sessionId);
  return { ok: true };
}

export async function submitMove(rawCode: string, fields: Record<string, string>) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: "Play needs the server key in .env.local." };
  }
  const loaded = await readPlay(roomCode);
  if (loaded.kind !== "ready" || !loaded.view.you) {
    return { error: "Join the room before answering." };
  }
  if (loaded.view.status === "paused") {
    return { error: "The room is paused." };
  }
  if (loaded.view.status !== "live") {
    return { error: "The room is not taking answers." };
  }
  if (loaded.view.you.status !== "active" || !loaded.view.card?.yours) {
    return { error: "This card is not waiting for you." };
  }
  const payload = voteChoice({
    ...fields,
    inner: loaded.view.card.inner,
    agree: fields.agree === "on" || fields.agree === "true",
    weather: fields.weather === "true" ? true : fields.weather === "false" ? false : undefined,
    guess: fields.guess === "true" ? true : fields.guess === "false" ? false : undefined,
    hold_start: fields.action === "hold_start",
    hold_end: fields.action === "hold_end",
    still_start: fields.action === "still_start",
    tap: fields.action === "tap",
    pass_token: fields.action === "pass_token",
    place: fields.action === "place",
    pass: fields.action === "pass",
    refuse: fields.action === "refuse",
    stop: fields.action === "stop",
    stay: fields.action === "stay",
  });
  const { data: round } = await admin
    .from("rounds")
    .select("id")
    .eq("session_id", loaded.view.sessionId)
    .eq("state", "open")
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round) {
    return { error: "No card is open." };
  }
  const { error } = await admin.from("answers").insert({
    round_id: round.id,
    participant_id: loaded.view.you.id,
    payload,
  });
  if (error) {
    return { error: error.message };
  }
  if (loaded.view.card?.kind === "role_pick") {
    const { error: voteError } = await admin.from("votes").upsert(
      {
        round_id: round.id,
        voter_participant_id: loaded.view.you.id,
        choice: payload,
      },
      { onConflict: "round_id,voter_participant_id" },
    );
    if (voteError) {
      return { error: voteError.message };
    }
  }
  const { data: session } = await admin
    .from("sessions")
    .select("id, room_code, status, mode, game_id, host_user_id, settings_snapshot")
    .eq("id", loaded.view.sessionId)
    .single();
  if (session) {
    const row = session as SessionRow;
    await settle(admin, row, readSettings(row.settings_snapshot), await people(admin, row.id), false);
  }
  await broadcast(loaded.view.sessionId);
  return { ok: true };
}

async function liveTable(rawCode: string) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." } as const;
  }
  const access = await hostSession(roomCode);
  if ("error" in access) {
    return access;
  }
  if (access.session.mode !== "real_life") {
    return { error: "That control is for a table room." } as const;
  }
  return access;
}

export async function shiftTimer(rawCode: string, deltaMs: number) {
  const access = await liveTable(rawCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (session.status !== "live" && session.status !== "paused") {
    return { error: "The room is not live." };
  }
  const { data: round } = await admin
    .from("rounds")
    .select("id, deadline_at")
    .eq("session_id", session.id)
    .eq("state", "open")
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round) {
    return { error: "No card is open." };
  }
  const deadline = shiftDeadline(typeof round.deadline_at === "string" ? round.deadline_at : null, deltaMs, Date.now());
  const { error } = await admin.from("rounds").update({ deadline_at: deadline }).eq("id", round.id);
  if (error) {
    return { error: error.message };
  }
  await broadcast(session.id);
  return { ok: true };
}

export async function skipCard(rawCode: string) {
  const access = await liveTable(rawCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (session.status !== "live") {
    return { error: "The room is not live." };
  }
  const settings = readSettings(session.settings_snapshot);
  const seats = await people(admin, session.id);
  const { data: round } = await admin
    .from("rounds")
    .select("id, card_id")
    .eq("session_id", session.id)
    .eq("state", "open")
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round) {
    return { error: "No card is open." };
  }
  const { data: closed, error } = await admin.rpc("close_round", {
    round_id: round.id,
    next_resolution: { message: SKIP_MESSAGE, deltas: [], resolvable: false, skipped: true },
  });
  if (error) {
    return { error: error.message };
  }
  if (closed !== true) {
    return { ok: true };
  }
  if (typeof round.card_id === "string" && !settings.dealt.includes(round.card_id)) {
    settings.dealt.push(round.card_id);
  }
  settings.draws_done += 1;
  settings.notice = SKIP_MESSAGE;
  settings.beat = "play";
  settings.beat_until = null;
  await saveSettings(admin, session.id, settings);
  if (settings.draws_done >= settings.draw_limit && !settings.force_card_id) {
    await finish(admin, session, settings, seats);
  } else {
    await openDraw(admin, session, settings, seats);
  }
  await broadcast(session.id);
  return { ok: true };
}

export async function revealCard(rawCode: string, kind: "hint" | "answer") {
  const access = await liveTable(rawCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  if (!session.game_id) {
    return { error: "This room has no published game." };
  }
  const { data: round } = await admin
    .from("rounds")
    .select("card_id")
    .eq("session_id", session.id)
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round?.card_id) {
    return { error: "No card is open." };
  }
  const cards = await pool(admin, session.game_id);
  const face = cards.find((item) => item.id === round.card_id);
  if (!face) {
    return { error: "The card could not be loaded." };
  }
  const settings = readSettings(session.settings_snapshot);
  if (kind === "hint") {
    if (!hintText(face.effect)) {
      return { error: "This card has no stored hint." };
    }
    settings.hint_revealed = true;
  } else if (typeof face.secret.answer !== "string" || !face.secret.answer.trim()) {
    return { error: "This card has no stored answer." };
  } else {
    settings.answer_revealed = true;
  }
  await saveSettings(admin, session.id, settings);
  await broadcast(session.id);
  return { ok: true };
}

export async function restartTable(rawCode: string) {
  const access = await liveTable(rawCode);
  if ("error" in access) {
    return access;
  }
  const { admin, session } = access;
  const previous = readSettings(session.settings_snapshot);
  const { error: roundError } = await admin.from("rounds").delete().eq("session_id", session.id);
  if (roundError) {
    return { error: roundError.message };
  }
  const seats = await people(admin, session.id);
  for (const seat of seats) {
    if (seat.status === "eliminated") {
      await admin.from("participants").update({ status: "active" }).eq("id", seat.id);
    }
    await admin.from("scores").upsert(
      { session_id: session.id, participant_id: seat.id, points: 0, result: {} },
      { onConflict: "session_id,participant_id" },
    );
  }
  const settings = readSettings({});
  settings.draw_limit = previous.draw_limit;
  settings.digital_elimination = previous.digital_elimination;
  settings.hand_size = previous.hand_size;
  settings.notice = "The table is reset.";
  await saveSettings(admin, session.id, settings);
  await admin.from("sessions").update({ status: "lobby", ended_at: null }).eq("id", session.id);
  await broadcast(session.id);
  return { ok: true };
}

export async function ensureBoard(rawCode: string) {
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { error: "That is not a room code." };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: "The board needs the server key in .env.local." };
  }
  const { data: session } = await admin.from("sessions").select("id, status").eq("room_code", roomCode).maybeSingle();
  if (!session) {
    return { error: "No room uses that code." };
  }
  if (session.status === "ended") {
    return { ok: true };
  }
  const { data: existing } = await admin
    .from("participants")
    .select("id")
    .eq("session_id", session.id)
    .eq("role", "board")
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true };
  }
  const { error } = await admin.from("participants").insert({
    session_id: session.id,
    user_id: null,
    display_name: "Table",
    role: "board",
    status: "active",
  });
  if (error) {
    return { error: error.message };
  }
  await broadcast(session.id);
  return { ok: true };
}
