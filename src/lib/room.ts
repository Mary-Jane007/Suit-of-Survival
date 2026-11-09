import { randomBytes, randomUUID } from "node:crypto";
import { hashSecret, verifySecret, openSession, ownerGate, type Account } from "./auth";
import { withTx, type Sql } from "./db";
import {
  challengePending,
  createRuntime,
  hostAct,
  isComplete,
  outcomes,
  submit,
  tick,
  view,
  type SubmitPayload,
} from "./engine";
import { cardTitle, fill, parseJson, publicDefinition } from "./present";
import { ready, rankWeight } from "./seed";
import { AVATARS, FORMATS, RANKS, SUITS, SAFETY_BANNER, type GameDefinition, type Runtime, type Suit } from "./types";

type Settings = {
  benchThreshold: number;
  benchingEnabled: boolean;
  benchLocksPlay: boolean;
  awardCardOn: string;
  maxPlayers: number;
  registrationSeconds: number;
  countdownSeconds: number;
  soundEnabled: boolean;
  handSize: number;
  theme: Record<string, unknown>;
  suits: Record<string, string>;
};

type Announcement = { kicker: string; title: string; body: string; bearerId?: string };
type Pending = {
  id: string;
  kind: "trust" | "guess" | "alliance" | "risk";
  actorId: string;
  targetId: string;
  suit?: string;
  hit: number;
  miss: number;
  bothFail?: number;
  oneFail?: number;
  armed: boolean;
  betray?: boolean | null;
};

type SessionRow = Record<string, unknown>;

function bearerIdOf(value: unknown) {
  return parseJson<{ bearerId?: string } | null>(value, null)?.bearerId;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function codeOf() {
  const bytes = randomBytes(5);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function cleanName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.'-]{1,18}$/u.test(name)) {
    throw new Error("Use 2–19 letters or numbers.");
  }
  return name;
}

function avatarOf(value: unknown) {
  const avatar = String(value ?? "mark");
  return (AVATARS as readonly string[]).includes(avatar) ? avatar : "mark";
}

async function settingsOf(q: Sql = async (text, params) => {
  const { sql } = await import("./db");
  return sql(text, params);
}): Promise<Settings> {
  const rows = await q<{ value: unknown }>("select value from app_settings where key = 'game'");
  return parseJson<Settings>(rows[0]?.value, {} as Settings);
}

async function templates(q: Sql) {
  const rows = await q<{ key: string; kicker: string; title_template: string; body_template: string; enabled: boolean }>(
    "select key, kicker, title_template, body_template, enabled from announcements",
  );
  return new Map(rows.map((row) => [row.key, row]));
}

function announce(map: Map<string, { kicker: string; title_template: string; body_template: string; enabled: boolean }>, key: string, vars: Record<string, string | number>, bearerId?: string): Announcement {
  const row = map.get(key);
  if (!row || row.enabled === false) return { kicker: key.replaceAll("_", " ").toUpperCase(), title: String(vars.game ?? ""), body: "", bearerId };
  return { kicker: fill(row.kicker, vars), title: fill(row.title_template, vars), body: fill(row.body_template, vars), bearerId };
}

async function logLine(q: Sql, sessionId: string | null, message: string) {
  await q("insert into activity (id, session_id, message) values ($1,$2,$3)", [randomUUID(), sessionId, message.slice(0, 240)]);
}

export async function registerPlayer(input: Record<string, unknown>) {
  await ready();
  const username = cleanName(input.username);
  const pin = String(input.pin ?? "");
  if (!/^\d{4}$/.test(pin)) throw new Error("Choose a 4-digit pin.");
  const avatar = avatarOf(input.avatar);
  const existing = await (await import("./db")).sql<{ id: string; pin_hash: string | null }>(
    "select id, pin_hash from users where lower(username) = lower($1)",
    [username],
  );
  if (existing[0]) {
    const ok = await verifySecret(pin, existing[0].pin_hash);
    if (!ok) throw new Error("That name is taken. The pin did not match.");
    await (await import("./db")).sql("update users set avatar = $2 where id = $1", [existing[0].id, avatar]);
    return openSession(existing[0].id);
  }
  const id = randomUUID();
  const pinHash = await hashSecret(pin);
  await (await import("./db")).sql(
    "insert into users (id, username, pin_hash, role, avatar) values ($1,$2,$3,'player',$4)",
    [id, username, pinHash, avatar],
  );
  return openSession(id);
}

export async function claimOwner(input: Record<string, unknown>) {
  await ready();
  if (!ownerGate(typeof input.accessCode === "string" ? input.accessCode : undefined)) {
    throw new Error("The owner key was refused. Set OWNER_ACCESS_CODE, or use the local dev server.");
  }
  const username = cleanName(input.username);
  const password = String(input.password ?? "");
  if (password.length < 8 || password.length > 80) throw new Error("Use a password of at least 8 characters.");
  const owners = await (await import("./db")).sql<{ id: string }>("select id from users where role = 'owner'");
  if (owners[0]) throw new Error("An owner already holds this table.");
  const id = randomUUID();
  const passwordHash = await hashSecret(password);
  await (await import("./db")).sql(
    "insert into users (id, username, password_hash, role, avatar) values ($1,$2,$3,'owner','crest')",
    [id, username, passwordHash],
  );
  await logLine(await import("./db").then((m) => m.sql), null, `${username} claimed the table.`);
  return openSession(id);
}

export async function loginOwner(input: Record<string, unknown>) {
  await ready();
  if (!ownerGate(typeof input.accessCode === "string" ? input.accessCode : undefined)) {
    throw new Error("The owner key was refused.");
  }
  const username = cleanName(input.username);
  const rows = await (await import("./db")).sql<{ id: string; password_hash: string | null; role: string }>(
    "select id, password_hash, role from users where lower(username) = lower($1)",
    [username],
  );
  const row = rows[0];
  if (!row || row.role !== "owner") throw new Error("Owner sign-in failed.");
  const ok = await verifySecret(String(input.password ?? ""), row.password_hash);
  if (!ok) throw new Error("Owner sign-in failed.");
  return openSession(row.id);
}

export async function createSession(account: Account, input: { playStyle?: string; drawMode?: string; suits?: string[]; preventDuplicates?: boolean }) {
  await ready();
  if (account.role !== "owner") throw new Error("Only the owner can open a room.");
  const settings = await settingsOf();
  const playStyle = input.playStyle === "hands" ? "hands" : "arena";
  const drawMode = input.drawMode === "manual" ? "manual" : "random";
  const suits = (input.suits ?? []).filter((suit): suit is Suit => (SUITS as readonly string[]).includes(suit));
  return withTx(async (q) => {
    let code = codeOf();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await q("select id from game_sessions where code = $1", [code]);
      if (!clash[0]) break;
      code = codeOf();
    }
    const id = randomUUID();
    await q(
      `insert into game_sessions (id, code, host_user_id, phase, play_style, draw_mode, prevent_duplicates, suit_filter, announcement)
       values ($1,$2,$3,'lobby',$4,$5,$6,$7::jsonb,$8::jsonb)`,
      [id, code, account.id, playStyle, drawMode, input.preventDuplicates !== false, JSON.stringify(suits), JSON.stringify({ kicker: "ARENA OPEN", title: code, body: "Players join on their phones." })],
    );
    await q(
      `insert into participants (id, session_id, user_id, is_host, playing, ready, entered)
       values ($1,$2,$3,true,false,true,false)`,
      [randomUUID(), id, account.id],
    );
    if (playStyle === "hands") await dealHands(q, id, settings.handSize || 4, suits);
    await logLine(q, id, `Room ${code} opened.`);
    return code;
  });
}

async function dealHands(q: Sql, sessionId: string, handSize: number, suits: string[]) {
  const games = await availableGames(q, sessionId, suits, true);
  const people = await q<{ user_id: string; playing: boolean }>(
    "select user_id, playing from participants where session_id = $1 and kicked = false and playing = true",
    [sessionId],
  );
  const hands: Record<string, string[]> = {};
  let cursor = 0;
  for (const person of people) {
    hands[person.user_id] = games.slice(cursor, cursor + handSize).map((game) => String(game.id));
    cursor += handSize;
  }
  await q("update game_sessions set hands = $2::jsonb where id = $1", [sessionId, JSON.stringify(hands)]);
}

async function availableGames(q: Sql, sessionId: string, suits: string[], ignoreUsed: boolean) {
  const session = await q<{ used_game_ids: unknown; prevent_duplicates: boolean }>("select used_game_ids, prevent_duplicates from game_sessions where id = $1", [sessionId]);
  const used = new Set(parseJson<string[]>(session[0]?.used_game_ids, []));
  const rows = await q<Record<string, unknown>>(
    "select id, name, suit, rank, min_players, max_players from games where status = 'published' order by suit, difficulty",
  );
  return rows.filter((row) => {
    if (suits.length && !suits.includes(String(row.suit))) return false;
    if (!ignoreUsed && session[0]?.prevent_duplicates && used.has(String(row.id))) return false;
    return true;
  });
}

export async function joinRoom(account: Account, code: string) {
  await ready();
  return withTx(async (q) => {
    const session = await lock(q, code);
    const existing = await q<{ kicked: boolean }>("select kicked from participants where session_id = $1 and user_id = $2", [session.id, account.id]);
    if (existing[0]?.kicked) throw new Error("The table has removed you from this room.");
    if (!existing[0]) {
      const settings = await settingsOf(q);
      const count = await q<{ n: string }>("select count(*)::text as n from participants where session_id = $1 and kicked = false and playing = true", [session.id]);
      if (Number(count[0]?.n ?? 0) >= Math.min(16, settings.maxPlayers || 12)) throw new Error("This room is full.");
      await q(
        "insert into participants (id, session_id, user_id, playing) values ($1,$2,$3,true)",
        [randomUUID(), session.id, account.id],
      );
      if (session.play_style === "hands") {
        const hands = parseJson<Record<string, string[]>>(session.hands, {});
        const settingsHand = (await settingsOf(q)).handSize || 4;
        const games = await availableGames(q, String(session.id), parseJson<string[]>(session.suit_filter, []), false);
        const taken = new Set(Object.values(hands).flat());
        hands[account.id] = games.filter((game) => !taken.has(String(game.id))).slice(0, settingsHand).map((game) => String(game.id));
        await q("update game_sessions set hands = $2::jsonb where id = $1", [session.id, JSON.stringify(hands)]);
      }
      await logLine(q, String(session.id), `${account.username} joined ${code}.`);
    } else {
      await q("update participants set connected_at = now() where session_id = $1 and user_id = $2", [session.id, account.id]);
    }
    return readRoom(q, code, account);
  });
}

async function lock(q: Sql, code: string) {
  const rows = await q<SessionRow>("select * from game_sessions where upper(code) = upper($1) for update", [code.trim()]);
  if (!rows[0] || rows[0].closed_at) throw new Error("No open room uses that code.");
  return rows[0];
}

export async function readRoom(q: Sql, code: string, account: Account | null) {
  const rows = await q<SessionRow>("select * from game_sessions where upper(code) = upper($1)", [code.trim()]);
  const session = rows[0];
  if (!session) throw new Error("No open room uses that code.");
  const people = await q<Record<string, unknown>>(
    `select p.*, u.username, u.avatar, u.role from participants p join users u on u.id = p.user_id
     where p.session_id = $1 and p.kicked = false order by p.is_host desc, u.username`,
    [session.id],
  );
  if (account) {
    await q("update participants set connected_at = now() where session_id = $1 and user_id = $2", [session.id, account.id]);
  }
  const game = session.current_game_id
    ? (await q<Record<string, unknown>>("select g.*, c.difficulty_label, r.name as rep_name, r.portrait_key, r.portrait_image, r.accent, r.intro, r.rules_line, r.start_line, r.success_line, r.failure_line, r.personality from games g left join cards c on c.suit = g.suit and c.rank = g.rank left join representatives r on r.id = g.representative_id where g.id = $1", [session.current_game_id]))[0]
    : null;
  const me = account ? people.find((person) => person.user_id === account.id) : undefined;
  const isHost = Boolean(me?.is_host) || account?.role === "owner";
  const phase = String(session.phase);
  const runtime = phase === "playing" || phase === "results" ? parseJson<Runtime | null>(session.runtime, null) : null;
  const now = Date.now();
  const play = runtime && (phase === "playing" || phase === "results") ? view(runtime, account?.id ?? null, isHost, now) : null;
  const hands = parseJson<Record<string, string[]>>(session.hands, {});
  const handIds = account ? hands[account.id] ?? [] : [];
  const handGames = handIds.length
    ? await q<{ id: string; name: string; suit: string; rank: string }>(
        `select id, name, suit, rank from games where id in (${handIds.map((_, index) => `$${index + 1}`).join(",")})`,
        handIds,
      )
    : [];
  const used = parseJson<string[]>(session.used_game_ids, []);
  const suits = parseJson<string[]>(session.suit_filter, []);
  const deckRows = isHost ? await availableGames(q, String(session.id), suits, false) : [];
  const draws = await q<{ name: string; suit: string; rank: string }>(
    `select g.name, g.suit, g.rank from draws d join games g on g.id = d.game_id where d.session_id = $1 order by d.created_at`,
    [session.id],
  );
  const pending = parseJson<Pending[]>(session.pending_effects, []);
  const armedRisk = pending.find((effect) => effect.armed && effect.kind === "risk");
  const settings = await settingsOf(q);
  const announcement = parseJson<Announcement | null>(session.announcement, null);
  const result = parseJson<Record<string, unknown> | null>(session.result, null);
  return {
    now,
    safety: SAFETY_BANNER,
    you: me
      ? {
          id: account?.id,
          username: me.username,
          role: me.role,
          avatar: me.avatar,
          isHost,
          playing: me.playing === true,
          ready: me.ready === true,
          entered: me.entered === true,
          score: Number(me.score ?? 0),
          status: me.status,
          hand: handGames,
        }
      : null,
    session: {
      code: session.code,
      phase,
      playStyle: session.play_style,
      drawMode: session.draw_mode,
      preventDuplicates: session.prevent_duplicates === true,
      suitFilter: suits,
      paused: session.paused === true,
      deadline: session.deadline_ms ? Number(session.deadline_ms) : null,
      roundIndex: Number(session.round_index ?? 0),
    },
    announcement,
    card: game
      ? {
          suit: game.suit,
          rank: game.rank,
          name: game.name,
          title: cardTitle(String(game.suit), String(game.rank)),
          difficulty: game.difficulty_label || rankWeight(String(game.rank)),
          rules: game.rules,
          objective: game.objective,
          materials: game.materials,
          safety: game.safety_note,
        }
      : null,
    representative: game
      ? {
          name: game.rep_name,
          portraitKey: game.portrait_key,
          portraitImage: game.portrait_image,
          accent: game.accent,
          personality: game.personality,
          line: lineFor(phase, game, announcement),
        }
      : null,
    players: people.map((person) => ({
      id: person.user_id,
      username: person.username,
      avatar: person.avatar,
      ready: person.ready === true,
      entered: person.entered === true,
      score: Number(person.score ?? 0),
      status: person.status,
      isHost: person.is_host === true,
      playing: person.playing === true,
      connected: Date.now() - new Date(String(person.connected_at)).getTime() < 15000,
    })),
    play,
    result,
    history: draws,
    remaining: isHost ? deckRows.length : Math.max(0, 52 - used.length),
    deck: isHost ? deckRows.map((row) => ({ id: row.id, name: row.name, suit: row.suit, rank: row.rank })) : null,
    pendingNote: armedRisk ? `The next card must be ${String(armedRisk.suit).toUpperCase()}.` : null,
    oath: phase === "oath" ? announcement : null,
    sound: settings.soundEnabled === true,
    log: parseJson<string[]>(session.log, []).slice(-8),
  };
}

function lineFor(phase: string, game: Record<string, unknown>, announcement: Announcement | null) {
  if (phase === "intro") return String(game.intro ?? "");
  if (phase === "rules" || phase === "registration") return String(game.rules_line ?? "");
  if (phase === "playing" || phase === "countdown") return String(game.start_line ?? "");
  if (phase === "results") return announcement?.body || String(game.success_line ?? "");
  return String(game.intro ?? "");
}

export async function viewRoom(account: Account | null, code: string) {
  await ready();
  return withTx(async (q) => {
    const session = await lock(q, code);
    await advanceClock(q, session);
    return readRoom(q, code, account);
  });
}

async function advanceClock(q: Sql, session: SessionRow) {
  const now = Date.now();
  const phase = String(session.phase);
  if (session.paused === true) return;
  const deadline = session.deadline_ms ? Number(session.deadline_ms) : null;
  if ((phase === "registration" || phase === "countdown") && deadline && now >= deadline) {
    if (phase === "registration") {
      const entered = await q<{ n: string }>("select count(*)::text as n from participants where session_id = $1 and entered = true and playing = true", [session.id]);
      if (Number(entered[0]?.n ?? 0) < 1) {
        await q("update game_sessions set deadline_ms = null, updated_at = now() where id = $1", [session.id]);
        await pushLog(q, session, "Registration stayed open. No one stepped in.");
        return;
      }
      const settings = await settingsOf(q);
      const map = await templates(q);
      const game = await gameRow(q, String(session.current_game_id));
      const next = announce(map, "countdown", varsOf(game, session, settings.countdownSeconds), bearerIdOf(session.announcement));
      await q(
        "update game_sessions set phase = 'countdown', deadline_ms = $2, announcement = $3::jsonb, updated_at = now() where id = $1",
        [session.id, now + settings.countdownSeconds * 1000, JSON.stringify(next)],
      );
      return;
    }
    await beginPlay(q, session);
    return;
  }
  if (phase === "playing") {
    const runtime = parseJson<Runtime | null>(session.runtime, null);
    if (!runtime) return;
    const next = tick(runtime, now);
    if (JSON.stringify(next) !== JSON.stringify(runtime)) {
      await q("update game_sessions set runtime = $2::jsonb, paused = $3, updated_at = now() where id = $1", [
        session.id,
        JSON.stringify(next),
        next.pausedRemaining !== null,
      ]);
      if (isComplete(next)) await settle(q, session, next);
    }
  }
}

async function beginPlay(q: Sql, session: SessionRow) {
  const pending = parseJson<Pending[]>(session.pending_effects, []);
  const oath = pending.find((effect) => effect.armed && effect.kind === "trust" && effect.betray == null);
  if (oath) {
    const name = await q<{ username: string }>("select username from users where id = $1", [oath.targetId]);
    const announcement = {
      kicker: "AN OATH",
      title: name[0]?.username ?? "A player",
      body: "Before the challenge, answer Ally or Betray. This is a button, not a confession.",
      bearerId: bearerIdOf(session.announcement),
      oathId: oath.id,
      targetId: oath.targetId,
    };
    await q("update game_sessions set phase = 'oath', deadline_ms = null, announcement = $2::jsonb, updated_at = now() where id = $1", [
      session.id,
      JSON.stringify(announcement),
    ]);
    return;
  }
  const game = await gameRow(q, String(session.current_game_id));
  const definition = parseJson<GameDefinition>(game.definition, {});
  const entered = await q<{ user_id: string; username: string }>(
    `select p.user_id, u.username from participants p join users u on u.id = p.user_id
     where p.session_id = $1 and p.entered = true and p.playing = true and p.kicked = false
     order by u.username`,
    [session.id],
  );
  if (entered.length < Number(game.min_players)) {
    await pushLog(q, session, `Need ${game.min_players} entered players. Registration stayed open.`);
    await q("update game_sessions set phase = 'registration', deadline_ms = null where id = $1", [session.id]);
    return;
  }
  const playing = entered.slice(0, Number(game.max_players));
  if (entered.length > playing.length) await pushLog(q, session, "The card is full. Extra players are watching.");
  const announcement = parseJson<Announcement>(session.announcement, { kicker: "", title: "", body: "" });
  const actor = definition.needsActor ? announcement.bearerId || playing[0]?.user_id : playing[0]?.user_id;
  const names = await q<{ id: string; label: string; suit: string; rank: string }>(
    "select id, name as label, suit, rank from games where status = 'published'",
  );
  const runtime = createRuntime(
    { ...definition, format: String(game.format), timerSeconds: Number(game.timer_seconds), prompt: definition.prompt || String(game.instructions || game.name) },
    playing.map((person) => ({ id: person.user_id, username: person.username, playing: true })),
    Date.now(),
    `${session.id}:${session.current_game_id}:${session.round_index}`,
    names.map((card) => ({ id: card.id, label: card.label, suit: card.suit as Suit, rank: card.rank })),
    actor,
  );
  const map = await templates(q);
  const banner = announce(map, "game_started", { ...varsOf(game, session, 0), line: String(game.start_line ?? "") }, actor ?? undefined);
  await q(
    "update game_sessions set phase = 'playing', runtime = $2::jsonb, deadline_ms = $3, announcement = $4::jsonb, paused = false, updated_at = now() where id = $1",
    [session.id, JSON.stringify(runtime), runtime.deadline, JSON.stringify(banner)],
  );
}

async function settle(q: Sql, session: SessionRow, runtime: Runtime) {
  const phaseNow = await q<{ phase: string }>("select phase from game_sessions where id = $1", [session.id]);
  if (phaseNow[0]?.phase === "results") return;
  const game = await gameRow(q, String(session.current_game_id));
  const rows = outcomes(runtime);
  const pending = parseJson<Pending[]>(session.pending_effects, []);
  const armed = pending.filter((effect) => effect.armed);
  const kept = pending.filter((effect) => !effect.armed);
  const extras: { userId: string; delta: number; reason: string }[] = [];
  for (const effect of armed) {
    if (effect.kind === "trust") {
      const betrayed = effect.betray === true;
      extras.push({ userId: effect.actorId, delta: betrayed ? effect.miss : effect.hit, reason: betrayed ? "The trust was broken." : "The trust held." });
    } else if (effect.kind === "guess") {
      const target = rows.find((row) => row.userId === effect.targetId);
      if (!target) {
        kept.push(effect);
        continue;
      }
      const hit = !target.success;
      extras.push({ userId: effect.actorId, delta: hit ? effect.hit : effect.miss, reason: hit ? "Your prediction landed." : "They cleared the challenge." });
    } else if (effect.kind === "alliance") {
      const a = rows.find((row) => row.userId === effect.actorId);
      const b = rows.find((row) => row.userId === effect.targetId);
      if (!a || !b) {
        kept.push(effect);
        continue;
      }
      const delta = a.success && b.success ? effect.hit : !a.success && !b.success ? effect.bothFail ?? effect.miss : effect.oneFail ?? effect.miss;
      const reason = a.success && b.success ? "The alliance cleared." : "The alliance broke.";
      extras.push({ userId: effect.actorId, delta, reason }, { userId: effect.targetId, delta, reason });
    } else if (effect.kind === "risk") {
      if (String(game.suit) !== effect.suit) {
        kept.push(effect);
        continue;
      }
      const target = rows.find((row) => row.userId === effect.targetId);
      if (!target) {
        kept.push(effect);
        continue;
      }
      const failed = !target.success;
      extras.push({ userId: effect.actorId, delta: failed ? effect.hit : effect.miss, reason: failed ? "They missed the suit you named." : "They cleared the suit you named." });
    }
  }
  for (const draft of challengePending(runtime)) {
    kept.push({ ...draft, id: randomUUID(), armed: false, betray: null });
  }
  const settings = await settingsOf(q);
  const totals = new Map<string, { delta: number; success: boolean; reason: string }>();
  for (const row of rows) totals.set(row.userId, { delta: row.delta, success: row.success, reason: row.reason });
  for (const extra of extras) {
    const current = totals.get(extra.userId) ?? { delta: 0, success: false, reason: extra.reason };
    current.delta += extra.delta;
    current.reason = `${current.reason} ${extra.reason}`.trim();
    totals.set(extra.userId, current);
  }
  const publicRows = [];
  for (const [userId, info] of totals) {
    await q("update participants set score = score + $3 where session_id = $1 and user_id = $2", [session.id, userId, info.delta]);
    await q(
      "insert into score_events (id, session_id, user_id, game_id, delta, reason) values ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), session.id, userId, session.current_game_id, info.delta, info.reason.slice(0, 240)],
    );
    const award = settings.awardCardOn !== "never" && (settings.awardCardOn === "participate" || info.success);
    if (award && session.current_game_id) {
      await q(
        "insert into collections (user_id, game_id, session_id) values ($1,$2,$3) on conflict do nothing",
        [userId, session.current_game_id, session.id],
      );
    }
    const name = await q<{ username: string; score: number }>("select u.username, p.score from participants p join users u on u.id = p.user_id where p.session_id = $1 and p.user_id = $2", [session.id, userId]);
    publicRows.push({ username: name[0]?.username ?? "Player", delta: info.delta, total: name[0]?.score ?? info.delta, success: info.success, reason: info.reason });
    if (settings.benchingEnabled && (name[0]?.score ?? 0) <= settings.benchThreshold) {
      await q("update participants set status = 'benched' where session_id = $1 and user_id = $2", [session.id, userId]);
    }
  }
  await awardAchievements(q, [...totals.keys()]);
  const successes = publicRows.filter((row) => row.success).length;
  const tone = successes === publicRows.length && publicRows.length > 0 ? "success" : successes === 0 ? "game_over" : "final_results";
  const map = await templates(q);
  const line = tone === "success" ? String(game.success_line ?? "") : String(game.failure_line ?? "");
  const banner = announce(map, tone, { ...varsOf(game, session, 0), line }, undefined);
  const summary = runtime.summary || banner.body;
  await q(
    `update game_sessions set phase = 'results', runtime = $2::jsonb, result = $3::jsonb, pending_effects = $4::jsonb,
      announcement = $5::jsonb, deadline_ms = null, paused = false, updated_at = now() where id = $1`,
    [session.id, JSON.stringify(runtime), JSON.stringify({ tone, summary, rows: publicRows }), JSON.stringify(kept), JSON.stringify({ ...banner, body: summary })],
  );
  await logLine(q, String(session.id), `${game.name} resolved.`);
}

async function awardAchievements(q: Sql, userIds: string[]) {
  const achievements = await q<{ id: string; rule: unknown }>("select id, rule from achievements");
  for (const userId of userIds) {
    const owned = await q<{ slug: string; suit: string }>(
      `select g.slug, g.suit from collections c join games g on g.id = c.game_id where c.user_id = $1`,
      [userId],
    );
    for (const achievement of achievements) {
      const rule = parseJson<{ type: string; count?: number; suit?: string; slug?: string }>(achievement.rule, { type: "" });
      const cleared =
        (rule.type === "clears" && owned.length >= (rule.count ?? 1)) ||
        (rule.type === "suit" && owned.filter((row) => row.suit === rule.suit).length >= (rule.count ?? 13)) ||
        (rule.type === "slug" && owned.some((row) => row.slug === rule.slug));
      if (cleared) {
        await q(
          "insert into user_achievements (user_id, achievement_id) values ($1,$2) on conflict do nothing",
          [userId, achievement.id],
        );
      }
    }
  }
}

async function gameRow(q: Sql, id: string) {
  const rows = await q<Record<string, unknown>>(
    `select g.*, r.intro, r.rules_line, r.start_line, r.success_line, r.failure_line, r.name as rep_name
     from games g left join representatives r on r.id = g.representative_id where g.id = $1`,
    [id],
  );
  if (!rows[0]) throw new Error("That card is no longer in the library.");
  return rows[0];
}

function varsOf(game: Record<string, unknown> | undefined, session: SessionRow, seconds: number) {
  return {
    game: String(game?.name ?? ""),
    card: game ? cardTitle(String(game.suit), String(game.rank)) : "",
    suit: String(game?.suit ?? ""),
    rank: String(game?.rank ?? ""),
    difficulty: String(game?.difficulty ?? ""),
    representative: String(game?.rep_name ?? "The Herald"),
    line: "",
    players: "",
    seconds,
    round: Number(session.round_index ?? 0) + 1,
    code: String(session.code ?? ""),
  };
}

async function pushLog(q: Sql, session: SessionRow, message: string) {
  const log = parseJson<string[]>(session.log, []);
  log.push(message);
  await q("update game_sessions set log = $2::jsonb where id = $1", [session.id, JSON.stringify(log.slice(-30))]);
  await logLine(q, String(session.id), message);
}

function hostOnly(account: Account, session: SessionRow) {
  if (account.role !== "owner" && account.id !== session.host_user_id) throw new Error("Only the owner can do that.");
}

export async function act(account: Account, code: string, action: Record<string, unknown>) {
  await ready();
  return withTx(async (q) => {
    const session = await lock(q, code);
    await advanceClock(q, session);
    const freshRows = await q<SessionRow>("select * from game_sessions where id = $1", [session.id]);
    const current = freshRows[0];
    const type = String(action.type ?? "");
    if (["ready", "enter", "leave", "submit", "betray", "play_card"].includes(type)) {
      await playerAct(q, current, account, action);
    } else {
      hostOnly(account, current);
      await hostAction(q, current, account, action);
    }
    const again = await q<SessionRow>("select * from game_sessions where id = $1", [session.id]);
    if (again[0]) await advanceClock(q, again[0]);
    return readRoom(q, code, account);
  });
}

async function playerAct(q: Sql, session: SessionRow, account: Account, action: Record<string, unknown>) {
  const me = await q<{ playing: boolean; kicked: boolean; status: string }>(
    "select playing, kicked, status from participants where session_id = $1 and user_id = $2",
    [session.id, account.id],
  );
  if (!me[0] || me[0].kicked) throw new Error("You are not in this room.");
  const type = String(action.type);
  if (type === "ready") {
    await q("update participants set ready = not ready where session_id = $1 and user_id = $2", [session.id, account.id]);
    return;
  }
  if (type === "leave") {
    await q("update participants set kicked = true, status = 'left' where session_id = $1 and user_id = $2 and is_host = false", [session.id, account.id]);
    return;
  }
  if (type === "enter") {
    if (session.phase !== "registration" && session.phase !== "rules") throw new Error("Registration is not open.");
    const settings = await settingsOf(q);
    if (settings.benchLocksPlay && me[0].status === "benched") throw new Error("You are benched. Ask the owner to restore you.");
    await q("update participants set entered = true, ready = true where session_id = $1 and user_id = $2", [session.id, account.id]);
    return;
  }
  if (type === "play_card") {
    if (session.phase !== "lobby" && session.phase !== "results") throw new Error("Wait for the arena to open.");
    if (session.play_style !== "hands") throw new Error("This room draws from the table, not from hands.");
    const hands = parseJson<Record<string, string[]>>(session.hands, {});
    const gameId = String(action.gameId ?? "");
    if (!(hands[account.id] ?? []).includes(gameId)) throw new Error("That card is not in your hand.");
    hands[account.id] = hands[account.id].filter((id) => id !== gameId);
    await q("update game_sessions set hands = $2::jsonb where id = $1", [session.id, JSON.stringify(hands)]);
    await reveal(q, session, gameId, "hand", account.id);
    return;
  }
  if (type === "betray") {
    if (session.phase !== "oath") throw new Error("Nothing is asking for an oath.");
    const pending = parseJson<Pending[]>(session.pending_effects, []);
    const banner = parseJson<{ oathId?: string }>(session.announcement, {});
    const effect = pending.find((item) => item.id === banner.oathId);
    if (!effect || effect.targetId !== account.id) throw new Error("This oath is not yours.");
    effect.betray = action.flag === true;
    await q("update game_sessions set pending_effects = $2::jsonb where id = $1", [session.id, JSON.stringify(pending)]);
    const nextSession = { ...session, pending_effects: pending, announcement: session.announcement };
    await beginPlay(q, nextSession);
    return;
  }
  if (type === "submit") {
    if (session.phase !== "playing") throw new Error("The challenge is not open.");
    const runtime = parseJson<Runtime | null>(session.runtime, null);
    if (!runtime) throw new Error("The challenge is not open.");
    const payload = (action.payload ?? {}) as SubmitPayload;
    const result = submit(runtime, account.id, payload, Date.now());
    if (!result.ok) throw new Error(result.error);
    await q(
      "insert into answers (id, session_id, game_id, user_id, round_index, payload) values ($1,$2,$3,$4,$5,$6::jsonb)",
      [randomUUID(), session.id, session.current_game_id, account.id, result.runtime.round, JSON.stringify(payload)],
    );
    if (["role_consensus", "echo_choice", "deduction_wolf"].includes(result.runtime.format)) {
      await q(
        "insert into votes (id, session_id, game_id, user_id, choice) values ($1,$2,$3,$4,$5::jsonb)",
        [randomUUID(), session.id, session.current_game_id, account.id, JSON.stringify(payload)],
      );
    }
    await q("update game_sessions set runtime = $2::jsonb where id = $1", [session.id, JSON.stringify(result.runtime)]);
    if (isComplete(result.runtime)) await settle(q, session, result.runtime);
  }
}

async function hostAction(q: Sql, session: SessionRow, account: Account, action: Record<string, unknown>) {
  const type = String(action.type);
  const map = await templates(q);
  if (type === "draw_random" || type === "draw_manual") {
    if (session.phase !== "lobby" && session.phase !== "results") throw new Error("Finish the current announcement before drawing.");
    const pending = parseJson<Pending[]>(session.pending_effects, []).map((effect) => ({ ...effect, armed: true }));
    await q("update game_sessions set pending_effects = $2::jsonb, phase = 'lobby', result = null where id = $1", [session.id, JSON.stringify(pending)]);
    const risk = pending.find((effect) => effect.kind === "risk");
    const suits = risk?.suit ? [risk.suit] : parseJson<string[]>(session.suit_filter, []);
    const pool = await availableGames(q, String(session.id), suits, Boolean(risk));
    if (!pool.length) throw new Error("The deck has no cards left for that draw. Reset it, or widen the suits.");
    const chosen = type === "draw_manual" ? pool.find((game) => game.id === action.gameId) : pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) throw new Error("That card cannot be drawn right now.");
    await reveal(q, { ...session, pending_effects: pending }, String(chosen.id), type === "draw_manual" ? "manual" : "random", account.id);
    return;
  }
  if (type === "advance") {
    await advancePhase(q, session, map);
    return;
  }
  if (type === "set_bearer") {
    const announcement = parseJson<Announcement>(session.announcement, { kicker: "", title: "", body: "" });
    announcement.bearerId = String(action.userId ?? "");
    await q("update game_sessions set announcement = $2::jsonb where id = $1", [session.id, JSON.stringify(announcement)]);
    return;
  }
  if (type === "enter_all") {
    await q("update participants set entered = true where session_id = $1 and playing = true and kicked = false", [session.id]);
    return;
  }
  if (type === "reset_deck") {
    await q("update game_sessions set used_game_ids = '[]'::jsonb where id = $1", [session.id]);
    await pushLog(q, session, "The deck was reset.");
    return;
  }
  if (type === "kick") {
    await q("update participants set kicked = true, status = 'left' where session_id = $1 and user_id = $2 and is_host = false", [session.id, String(action.userId ?? "")]);
    return;
  }
  if (type === "restore") {
    await q("update participants set status = 'in_play' where session_id = $1 and user_id = $2", [session.id, String(action.userId ?? "")]);
    return;
  }
  if (type === "host_play") {
    await q("update participants set playing = $3 where session_id = $1 and user_id = $2", [session.id, account.id, action.playing === true]);
    return;
  }
  if (type === "close") {
    const banner = announce(map, "session_completed", { code: String(session.code), game: "", card: "", representative: "The Herald", line: "", seconds: 0, round: 0, players: "", suit: "", rank: "", difficulty: "" });
    await q("update game_sessions set phase = 'closed', closed_at = now(), announcement = $2::jsonb where id = $1", [session.id, JSON.stringify(banner)]);
    return;
  }
  if (type === "continue") {
    const pending = parseJson<Pending[]>(session.pending_effects, []).map((effect) => ({ ...effect, armed: true }));
    await q(
      "update game_sessions set phase = 'lobby', runtime = null, result = null, current_game_id = null, pending_effects = $2::jsonb, announcement = $3::jsonb where id = $1",
      [session.id, JSON.stringify(pending), JSON.stringify({ kicker: "BETWEEN CARDS", title: String(session.code), body: "Draw when the table is ready." })],
    );
    return;
  }
  if (!["hint", "reveal", "pause", "resume", "extend", "shorten", "skip", "end", "mark", "resolve"].includes(type)) {
    throw new Error("Unknown control.");
  }
  if (session.phase !== "playing") throw new Error("That control is for a live challenge.");
  const runtime = parseJson<Runtime | null>(session.runtime, null);
  if (!runtime) throw new Error("That control is for a live challenge.");
  const seconds = Math.max(1, Math.min(600, Number(action.seconds ?? 15)));
  const result =
    type === "extend" || type === "shorten"
      ? hostAct(runtime, { type, seconds })
      : type === "mark"
        ? hostAct(runtime, { type: "mark", userId: String(action.userId ?? ""), correct: action.correct === true })
        : type === "pause" || type === "resume" || type === "skip"
          ? hostAct(runtime, { type, now: Date.now() })
          : hostAct(runtime, { type: type as "hint" | "reveal" | "end" | "resolve" });
  if (!result.ok) throw new Error(result.error);
  const key = type === "hint" ? "hint_revealed" : type === "pause" ? "paused" : type === "resume" ? "resumed" : null;
  let announcement = parseJson<Announcement>(session.announcement, { kicker: "", title: "", body: "" });
  if (key) {
    const game = await gameRow(q, String(session.current_game_id));
    announcement = announce(map, key, varsOf(game, session, seconds));
  }
  await q("update game_sessions set runtime = $2::jsonb, paused = $3, announcement = $4::jsonb where id = $1", [
    session.id,
    JSON.stringify(result.runtime),
    result.runtime.pausedRemaining !== null,
    JSON.stringify(announcement),
  ]);
  if (isComplete(result.runtime)) await settle(q, session, result.runtime);
}

async function advancePhase(q: Sql, session: SessionRow, map: Awaited<ReturnType<typeof templates>>) {
  const phase = String(session.phase);
  const game = session.current_game_id ? await gameRow(q, String(session.current_game_id)) : null;
  const settings = await settingsOf(q);
  if (phase === "countdown" || phase === "registration") {
    if (phase === "registration") {
      const entered = await q<{ n: string }>("select count(*)::text as n from participants where session_id = $1 and entered = true and playing = true", [session.id]);
      if (Number(entered[0]?.n ?? 0) < 1) throw new Error("No one has stepped in yet.");
    }
    await beginPlay(q, session);
    return;
  }
  const order = ["detected", "intro", "rules", "registration"];
  const index = order.indexOf(phase);
  if (index < 0) throw new Error("There is nothing to advance.");
  const next = order[index + 1];
  if (!next || !game) throw new Error("There is nothing to advance.");
  const bearerId = bearerIdOf(session.announcement);
  if (next === "registration") {
    const banner = announce(map, "registration_open", { ...varsOf(game, session, settings.registrationSeconds), line: String(game.rules_line ?? "") }, bearerId);
    await q("update game_sessions set phase = 'registration', deadline_ms = $2, announcement = $3::jsonb where id = $1", [
      session.id,
      Date.now() + settings.registrationSeconds * 1000,
      JSON.stringify(banner),
    ]);
    return;
  }
  if (next === "countdown") {
    const banner = announce(map, "countdown", varsOf(game, session, settings.countdownSeconds), bearerId);
    await q("update game_sessions set phase = 'countdown', deadline_ms = $2, announcement = $3::jsonb where id = $1", [
      session.id,
      Date.now() + settings.countdownSeconds * 1000,
      JSON.stringify(banner),
    ]);
    return;
  }
  const key = next === "intro" ? "representative_intro" : next === "rules" ? "rules" : "card_reveal";
  const line = next === "intro" ? String(game.intro ?? "") : String(game.rules_line ?? "");
  const banner = announce(map, key, { ...varsOf(game, session, 0), line }, bearerId);
  await q("update game_sessions set phase = $2, announcement = $3::jsonb, deadline_ms = null where id = $1", [session.id, next, JSON.stringify(banner)]);
}

async function reveal(q: Sql, session: SessionRow, gameId: string, method: string, bearerId: string) {
  const game = await gameRow(q, gameId);
  if (game.status !== "published") throw new Error("That game is not published.");
  const used = parseJson<string[]>(session.used_game_ids, []);
  if (!used.includes(gameId)) used.push(gameId);
  const map = await templates(q);
  const banner = announce(map, "card_detected", varsOf(game, session, 0), bearerId);
  await q(
    `update game_sessions set phase = 'detected', current_game_id = $2, used_game_ids = $3::jsonb, announcement = $4::jsonb,
      runtime = null, result = null, round_index = round_index + 1, deadline_ms = null, paused = false, updated_at = now() where id = $1`,
    [session.id, gameId, JSON.stringify(used), JSON.stringify(banner)],
  );
  await q("insert into draws (id, session_id, game_id, method) values ($1,$2,$3,$4)", [randomUUID(), session.id, gameId, method]);
  await q("update participants set entered = false where session_id = $1 and is_host = false", [session.id]);
  await logLine(q, String(session.id), `${game.name} was drawn.`);
}

export async function library(detailId?: string) {
  await ready();
  if (!detailId) {
    const rows = await (await import("./db")).sql(
      `select id, slug, source, name, description, suit, rank, difficulty, min_players, max_players, timer_seconds, format, status
       from games where status = 'published' order by suit, difficulty, name`,
    );
    return rows;
  }
  const rows = await (await import("./db")).sql<Record<string, unknown>>(
    `select g.*, r.name as rep_name, r.personality, c.difficulty_label, c.description as card_description
     from games g left join representatives r on r.id = g.representative_id
     left join cards c on c.suit = g.suit and c.rank = g.rank
     where g.id = $1 and g.status = 'published'`,
    [detailId],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, definition: publicDefinition(parseJson<GameDefinition>(row.definition, {})) };
}

export async function profile(account: Account) {
  await ready();
  const { sql } = await import("./db");
  const collection = await sql(
    `select g.id, g.name, g.suit, g.rank, c.earned_at from collections c join games g on g.id = c.game_id
     where c.user_id = $1 order by c.earned_at desc`,
    [account.id],
  );
  const history = await sql(
    `select s.delta, s.reason, s.created_at, g.name, g.suit, g.rank from score_events s
     left join games g on g.id = s.game_id where s.user_id = $1 order by s.created_at desc limit 40`,
    [account.id],
  );
  const achievements = await sql(
    `select a.name, a.description, u.earned_at from user_achievements u join achievements a on a.id = u.achievement_id
     where u.user_id = $1 order by u.earned_at desc`,
    [account.id],
  );
  const totals = await sql<{ score: string; clears: string }>(
    `select coalesce(sum(delta),0)::text as score,
            (select count(*)::text from collections where user_id = $1) as clears
     from score_events where user_id = $1`,
    [account.id],
  );
  return { account, collection, history, achievements, totals: totals[0] };
}

export async function theme() {
  await ready();
  const settings = await settingsOf();
  return { theme: settings.theme, sound: settings.soundEnabled, suits: settings.suits, safety: SAFETY_BANNER };
}

export { FORMATS, RANKS, SUITS };
