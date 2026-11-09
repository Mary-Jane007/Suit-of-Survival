import { initQueen, queenHost, queenSubmit, queenTick, queenView } from "./queen";
import type {
  CardName,
  GameDefinition,
  Outcome,
  PendingDraft,
  PlayInput,
  PlayView,
  PlayerRef,
  Runtime,
} from "./types";

export type SubmitPayload = {
  choice?: string;
  text?: string;
  number?: number;
  order?: string[];
  playerId?: string;
  role?: string;
  accept?: boolean;
  flag?: boolean;
  truth?: boolean;
  recommendation?: string;
  guess?: string;
  misleadTo?: string;
  misleadCard?: string;
  suit?: string;
  tap?: boolean;
  cardId?: string;
};

type EngineResult = { ok: true; runtime: Runtime } | { ok: false; error: string; runtime: Runtime };

const LOCKED = new Set([
  "multiple_choice",
  "keywords",
  "host_judge",
  "custom",
  "sequence",
  "echo_choice",
  "split_clue",
  "unanimous",
  "deduction_wolf",
  "pattern_doors",
  "number_contest",
]);

export function activePlayers(rt: Runtime) {
  return rt.players.filter((p) => p.playing);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function bag(rt: Runtime, round = rt.round) {
  const key = String(round);
  rt.submissions[key] ??= {};
  return rt.submissions[key];
}

export function hashSeed(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function doorLayout(doors: NonNullable<GameDefinition["doors"]>, round: number) {
  const walls = doors.walls;
  const n = walls.length;
  const layout: Record<string, "life" | "end"> = {};
  for (const [wall, kind] of Object.entries(doors.start)) {
    const idx = walls.indexOf(wall);
    if (idx < 0) continue;
    const shift = kind === "life" ? doors.lifeShift : doors.endShift;
    const next = (((idx + shift * round) % n) + n) % n;
    layout[walls[next]] = kind;
  }
  return layout;
}

function points(def: GameDefinition, key: "successPoints" | "failPoints", fallback: number) {
  const value = def[key];
  return typeof value === "number" ? value : fallback;
}

function finish(rt: Runtime, tone: "success" | "fail" | "mixed", summary: string, pending?: PendingDraft[]) {
  rt.phase = "complete";
  rt.completeTone = tone;
  rt.summary = summary;
  rt.deadline = null;
  rt.feedback = summary;
  if (pending) rt.pending = pending;
}

function give(rt: Runtime, userId: string, delta: number, success: boolean, reason: string) {
  rt.scores[userId] = (rt.scores[userId] ?? 0) + delta;
  rt.success[userId] = success;
  rt.reasons[userId] = reason;
}

function toneFrom(rt: Runtime): "success" | "fail" | "mixed" {
  const people = activePlayers(rt);
  const wins = people.filter((p) => rt.success[p.id]).length;
  if (wins === people.length && people.length > 0) return "success";
  if (wins === 0) return "fail";
  return "mixed";
}

function actorOf(rt: Runtime) {
  const id = String(rt.extra.actorId ?? "");
  return activePlayers(rt).find((p) => p.id === id) ?? activePlayers(rt)[0];
}

export function createRuntime(
  def: GameDefinition,
  players: PlayerRef[],
  now: number,
  seed: string,
  cards: CardName[],
  actorId?: string | null,
): Runtime {
  const format = def.format === "custom" ? "host_judge" : String(def.format || "host_judge");
  const rand = hashSeed(seed);
  const timer = Math.max(5, Number(def.timerSeconds ?? 60));
  const rounds =
    format === "pattern_doors"
      ? def.doors?.rounds ?? 8
      : format === "number_contest"
        ? def.contest?.rounds ?? 5
        : Math.max(1, Number(def.rounds ?? 1));
  const rt: Runtime = {
    format,
    round: 0,
    rounds,
    phase: "live",
    startedAt: now,
    deadline: now + timer * 1000,
    pausedRemaining: null,
    hintLevel: 0,
    players: players.map((p) => ({ ...p })),
    secret: {},
    submissions: {},
    scores: {},
    success: {},
    reasons: {},
    log: [],
    feedback: null,
    extra: { actorId: actorId ?? null, step: "start" },
    config: def,
  };
  const active = activePlayers(rt);
  if (active.length === 0) {
    finish(rt, "fail", "No one stepped into the challenge.");
    return rt;
  }
  if (format === "sequence") {
    const sequence = def.sequence ?? [];
    const pieces = sequence.map((token) => ({
      id: `piece-${Math.floor(rand() * 1e9)}`,
      token,
    }));
    rt.secret = { order: pieces.map((piece) => piece.id), pieces };
  }
  if (format === "pattern_doors" && def.doors) {
    rt.secret = { layouts: Array.from({ length: rounds }, (_, round) => doorLayout(def.doors!, round)) };
  }
  if (format === "deduction_wolf") {
    const wolf = active[Math.floor(rand() * active.length)];
    rt.secret = { wolfId: wolf.id };
    rt.log.push("Roles have been dealt in secret.");
  }
  if (format === "forehead") {
    const pool = cards.length >= active.length ? shuffle(cards, rand) : cards;
    const assignment: Record<string, CardName> = {};
    active.forEach((player, index) => {
      assignment[player.id] = pool[index] ?? {
        id: `sig-${index}`,
        label: `Signal ${index + 1}`,
        suit: "spades",
        rank: "A",
      };
    });
    rt.secret = { assignment };
  }
  if (format === "split_clue") {
    const fragments = def.fragments ?? [];
    const dealt: Record<string, string> = {};
    active.forEach((player, index) => {
      dealt[player.id] = fragments.filter((_, fragmentIndex) => fragmentIndex % active.length === index).join("  ·  ");
    });
    rt.secret = { dealt, aliases: def.aliases ?? [] };
  }
  if (format === "reaction") {
    const count = Math.max(3, Number(def.flashes ?? 6));
    const span = timer * 1000 * 0.8;
    const offsets: number[] = [];
    let cursor = 800;
    for (let i = 0; i < count; i++) {
      cursor += 700 + Math.floor(rand() * 900);
      offsets.push(Math.min(cursor, span));
    }
    rt.secret = { offsets };
    rt.extra.hits = {};
  }
  if (format === "order_coop" || format === "word_chain") {
    rt.extra.order = shuffle(active, rand).map((p) => p.id);
    rt.extra.cursor = 0;
    rt.extra.words = [];
  }
  if (format === "intuition" || format === "trade" || format === "chain" || format === "bluff_story") {
    rt.extra.deck = shuffle(cards, rand).slice(0, 8);
  }
  if (format === "host_judge" || format === "custom") {
    rt.extra.marks = {};
  }
  if (format === "queens_touch") {
    rt.rounds = Math.max(1, Math.min(5, Number(def.rounds ?? 5)));
    rt.deadline = null;
    initQueen(rt, rand);
  }
  return rt;
}

function everyoneSubmitted(rt: Runtime) {
  const current = bag(rt);
  return activePlayers(rt).every((player) => current[player.id]);
}

function scoreIndividuals(rt: Runtime, correct: (payload: Record<string, unknown>) => boolean, why: string) {
  const current = bag(rt);
  const win = points(rt.config, "successPoints", 5);
  const lose = points(rt.config, "failPoints", 0);
  for (const player of activePlayers(rt)) {
    const payload = current[player.id];
    const ok = payload ? correct(payload) : false;
    give(rt, player.id, ok ? win : lose, ok, ok ? why : payload ? "Incorrect." : "No answer in time.");
  }
  finish(rt, toneFrom(rt), rt.feedback || why);
}

function resolveStandard(rt: Runtime, now: number) {
  const format = rt.format;
  const def = rt.config;
  if (format === "multiple_choice") {
    const correctId = String(def.correctOptionId ?? "");
    scoreIndividuals(rt, (payload) => payload.choice === correctId, "Answer recorded.");
    rt.summary = "The choices are locked.";
    return;
  }
  if (format === "keywords") {
    const groups = def.keywordGroups ?? [];
    scoreIndividuals(rt, (payload) => hitKeywords(String(payload.text ?? ""), groups), "The pattern matches.");
    rt.summary = "The written answers are locked.";
    return;
  }
  if (format === "echo_choice") {
    const correctId = String(def.correctOptionId ?? "");
    const current = bag(rt);
    const ok = activePlayers(rt).every((player) => current[player.id]?.choice === correctId);
    const win = points(def, "successPoints", 6);
    for (const player of activePlayers(rt)) give(rt, player.id, ok ? win : 0, ok, ok ? "The group matched." : "The group did not match.");
    finish(rt, ok ? "success" : "fail", ok ? "One shared answer. Cleared." : "The table did not land on the same correct answer.");
    return;
  }
  if (format === "split_clue") {
    const aliases = ((rt.secret.aliases as string[]) ?? []).map(normalizeText);
    const current = bag(rt);
    const ok = activePlayers(rt).every((player) => aliases.includes(normalizeText(String(current[player.id]?.text ?? ""))));
    const win = points(def, "successPoints", 8);
    for (const player of activePlayers(rt)) give(rt, player.id, ok ? win : 0, ok, ok ? "The fragments formed the answer." : "The fragments did not meet.");
    finish(rt, ok ? "success" : "fail", ok ? "The clue is whole." : "The clue stayed broken.");
    return;
  }
  if (format === "unanimous") {
    const current = bag(rt);
    const values = activePlayers(rt).map((player) => normalizeText(String(current[player.id]?.text ?? current[player.id]?.number ?? "")));
    const must = def.mustEqual ? normalizeText(def.mustEqual) : "";
    const agreed = values.length > 0 && values.every((value) => value.length > 0 && value === values[0]);
    const ok = agreed && (!must || values[0] === must);
    const win = points(def, "successPoints", 6);
    for (const player of activePlayers(rt)) give(rt, player.id, ok ? win : 0, ok, ok ? "The table agreed." : "No agreement.");
    finish(rt, ok ? "success" : "fail", ok ? "Spoken as one." : "The answers diverged.");
    return;
  }
  if (format === "sequence") {
    const order = rt.secret.order as string[];
    scoreIndividuals(rt, (payload) => JSON.stringify(payload.order ?? []) === JSON.stringify(order), "Sequence matched.");
    rt.summary = "Memory check closed.";
    return;
  }
  if (format === "deduction_wolf") {
    resolveWolf(rt);
    return;
  }
  if (format === "number_contest") {
    resolveContestRound(rt, now);
    return;
  }
  if (format === "pattern_doors") {
    resolveDoorRound(rt, now);
    return;
  }
  if (format === "role_consensus") {
    resolveConsensus(rt, true);
    return;
  }
  if (format === "reaction") {
    resolveReaction(rt);
    return;
  }
  if (format === "order_coop" || format === "word_chain") {
    const win = points(def, "successPoints", 6);
    for (const player of activePlayers(rt)) give(rt, player.id, 0, false, "Time closed the chain.");
    finish(rt, "fail", "Time closed the chain.", );
    rt.scores = Object.fromEntries(activePlayers(rt).map((p) => [p.id, 0]));
    void win;
    return;
  }
  if (format === "chain") {
    resolveChain(rt);
    return;
  }
  if (format === "host_judge") {
    rt.extra.timeUp = true;
    rt.log.push("The clock has run out. The representative is waiting for a judgment.");
    rt.deadline = null;
    return;
  }
  const actor = actorOf(rt);
  if (actor) give(rt, actor.id, 0, false, "Time ran out before the choice was made.");
  finish(rt, "fail", "Time ran out.");
}

function hitKeywords(text: string, groups: string[][]) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return groups.every((group) => group.some((word) => normalized.includes(normalizeText(word))));
}

function resolveWolf(rt: Runtime) {
  const wolfId = String(rt.secret.wolfId ?? "");
  const current = bag(rt);
  const wolfPick = String(current[wolfId]?.playerId ?? "");
  const covered = new Set<string>();
  const rules = rt.config.wolf ?? { targetPoints: -10, wolfCaught: -10, wolfClear: 10, protectOtherCost: -5 };
  for (const player of activePlayers(rt)) {
    if (player.id === wolfId) continue;
    const chosen = String(current[player.id]?.playerId ?? "");
    if (chosen && chosen !== player.id) {
      covered.add(chosen);
      give(rt, player.id, rules.protectOtherCost, true, "You spent points to cover someone else.");
    } else {
      give(rt, player.id, 0, true, "You held your place.");
    }
  }
  if (!wolfPick || wolfPick === wolfId) {
    give(rt, wolfId, 0, false, "The wolf did not mark anyone.");
  } else if (covered.has(wolfPick)) {
    give(rt, wolfId, rules.wolfCaught, false, "The mark landed on someone the others covered.");
    const previous = rt.success[wolfPick];
    give(rt, wolfPick, 0, previous !== false, "The cover held. No mark landed.");
  } else {
    give(rt, wolfId, rules.wolfClear, true, "The mark landed in the open.");
    give(rt, wolfPick, rules.targetPoints, false, "You were marked. Digital points only.");
  }
  rt.feedback = "The marks are open.";
  finish(rt, toneFrom(rt), "Wolf among Sheep is decided. Points are digital. Everyone stays at the table.");
}

function resolveContestRound(rt: Runtime, now: number) {
  const rules = rt.config.contest ?? { min: 0, max: 100, factor: 0.8, winPoints: 2, losePoints: -2, rounds: rt.rounds };
  const current = bag(rt);
  const entries = activePlayers(rt)
    .map((player) => ({ player, number: Number(current[player.id]?.number) }))
    .filter((entry) => Number.isFinite(entry.number));
  if (entries.length === 0) {
    rt.feedback = "No numbers were entered.";
  } else {
    const mean = entries.reduce((sum, entry) => sum + entry.number, 0) / entries.length;
    const target = mean * rules.factor;
    let best = Infinity;
    const scored = entries.map((entry) => {
      const distance = Math.abs(entry.number - target);
      best = Math.min(best, distance);
      return { ...entry, distance };
    });
    const winners = new Set(scored.filter((entry) => entry.distance === best).map((entry) => entry.player.id));
    for (const player of activePlayers(rt)) {
      const win = winners.has(player.id);
      give(rt, player.id, win ? rules.winPoints : rules.losePoints, win, win ? "Closest to the balance." : "Away from the balance.");
    }
    rt.extra.lastBoard = {
      round: rt.round + 1,
      target: Math.round(target * 100) / 100,
      guesses: scored.map((entry) => ({ name: entry.player.username, number: entry.number })),
    };
    rt.feedback = `Balance point ${Math.round(target * 100) / 100}.`;
    rt.log.push(rt.feedback);
  }
  if (rt.round + 1 >= rt.rounds) {
    for (const player of activePlayers(rt)) rt.success[player.id] = (rt.scores[player.id] ?? 0) > 0;
    finish(rt, toneFrom(rt), "The scale has finished its rounds.");
    return;
  }
  rt.phase = "feedback";
  rt.extra.feedbackUntil = now + 1800;
  rt.extra.nextRound = rt.round + 1;
}

function resolveDoorRound(rt: Runtime, now: number) {
  const layouts = rt.secret.layouts as Record<string, "life" | "end">[];
  const layout = layouts[rt.round] ?? {};
  const doors = rt.config.doors!;
  const current = bag(rt);
  const revealed: { name: string; wall: string; outcome: string }[] = [];
  for (const player of activePlayers(rt)) {
    const wall = String(current[player.id]?.choice ?? "");
    const outcome = layout[wall];
    if (outcome === "life") {
      give(rt, player.id, doors.lifePoints, true, `${wall} was life.`);
      revealed.push({ name: player.username, wall, outcome: "life" });
    } else {
      give(rt, player.id, doors.endPoints, false, wall ? `${wall} was an end door.` : "No door chosen.");
      revealed.push({ name: player.username, wall: wall || "none", outcome: "end" });
    }
  }
  rt.extra.lastDoors = revealed;
  rt.feedback = revealed.map((item) => `${item.name}: ${item.wall} ${item.outcome}`).join(" · ");
  rt.log.push(`Round ${rt.round + 1}. ${rt.feedback}`);
  if (rt.round + 1 >= rt.rounds) {
    for (const player of activePlayers(rt)) rt.success[player.id] = (rt.scores[player.id] ?? 0) > 0;
    finish(rt, toneFrom(rt), "The doors have finished moving.");
    return;
  }
  rt.phase = "feedback";
  rt.extra.feedbackUntil = now + 1600;
  rt.extra.nextRound = rt.round + 1;
}

function resolveConsensus(rt: Runtime, forced: boolean) {
  const current = bag(rt);
  const roles = rt.config.roles ?? [];
  const agreed = activePlayers(rt).every((player) => {
    const row = current[player.id];
    return row?.role && row.accepted === true;
  });
  if (!agreed && !forced) return;
  if (!agreed) {
    const delta = rt.config.disagreementPoints ?? -10;
    for (const player of activePlayers(rt)) give(rt, player.id, delta, false, "The table did not agree.");
    finish(rt, "fail", "No shared choice. The disagreement cost is applied.");
    return;
  }
  for (const player of activePlayers(rt)) {
    const role = roles.find((item) => item.id === current[player.id].role);
    give(rt, player.id, role?.points ?? 0, true, role ? `${role.label} is locked.` : "Role locked.");
  }
  finish(rt, "success", "The table agreed. Points follow the chosen roles.");
}

function resolveReaction(rt: Runtime) {
    const hits = (rt.extra.hits ?? {}) as Record<string, number[]>;
    const each = rt.config.pointsEach ?? 1;
    for (const player of activePlayers(rt)) {
      const count = (hits[player.id] ?? []).length;
      give(rt, player.id, count * each, count > 0, `${count} clean taps.`);
    }
  finish(rt, toneFrom(rt), "The flashes have stopped.");
}

function resolveChain(rt: Runtime) {
  const rules = rt.config.chain ?? { returnedPoints: -10, passedPoints: 10 };
  const origin = String(rt.extra.originId ?? actorOf(rt)?.id ?? "");
  const holder = String(rt.extra.holderId ?? origin);
  const returned = holder === origin;
  if (origin) {
    give(
      rt,
      origin,
      returned ? rules.returnedPoints : rules.passedPoints,
      !returned,
      returned ? "The card came back." : "The card stayed with someone else.",
    );
  }
  finish(rt, returned ? "fail" : "success", returned ? "The card returned to the hand that cast it off." : "The card rests in another hand.");
}

function openNextRound(rt: Runtime, now: number) {
  const next = Number(rt.extra.nextRound ?? rt.round + 1);
  rt.round = next;
  rt.phase = "live";
  rt.feedback = null;
  rt.startedAt = now;
  const timer = Math.max(5, Number(rt.config.timerSeconds ?? 60));
  rt.deadline = now + timer * 1000;
  delete rt.extra.feedbackUntil;
  delete rt.extra.nextRound;
}

export function tick(runtime: Runtime, now: number): Runtime {
  const rt = clone(runtime);
  if (rt.phase === "complete" || rt.pausedRemaining !== null) return rt;
  if (rt.format === "queens_touch") {
    queenTick(rt, now);
    return rt;
  }
  if (rt.phase === "feedback") {
    const until = Number(rt.extra.feedbackUntil ?? 0);
    if (now >= until) openNextRound(rt, now);
    return rt;
  }
  if (rt.format === "sequence") {
    const pieces = (rt.secret.pieces as { id: string }[]) ?? [];
    const step = rt.config.stepMs ?? 900;
    const readyAt = rt.startedAt + pieces.length * step + 400;
    if (now < readyAt) return rt;
  }
  if (rt.deadline !== null && now >= rt.deadline) resolveStandard(rt, now);
  return rt;
}

function reject(runtime: Runtime, error: string): EngineResult {
  return { ok: false, error, runtime };
}

export function submit(runtime: Runtime, userId: string, payload: SubmitPayload, now: number): EngineResult {
  const rt = clone(runtime);
  if (rt.phase !== "live") return reject(rt, "This challenge is not accepting answers.");
  const player = activePlayers(rt).find((item) => item.id === userId);
  if (!player) return reject(rt, "You are not entered in this challenge.");
  if (rt.pausedRemaining !== null) return reject(rt, "The challenge is paused.");
  const current = bag(rt);
  if (LOCKED.has(rt.format) && current[userId] && rt.format !== "role_consensus") {
    return reject(rt, "You already answered this round.");
  }
  const error = applySubmit(rt, player, payload, now);
  if (error) return reject(runtime, error);
  return { ok: true, runtime: rt };
}

function applySubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload, now: number): string | null {
  const current = bag(rt);
  switch (rt.format) {
    case "multiple_choice":
    case "echo_choice": {
      if (!payload.choice) return "Choose an option.";
      current[player.id] = { choice: payload.choice };
      if (everyoneSubmitted(rt)) resolveStandard(rt, now);
      return null;
    }
    case "keywords":
    case "host_judge": {
      const text = String(payload.text ?? "").trim();
      if (text.length < 1 || text.length > 1000) return "Write an answer first.";
      current[player.id] = { text };
      if (rt.format === "keywords" && everyoneSubmitted(rt)) resolveStandard(rt, now);
      return null;
    }
    case "split_clue":
    case "unanimous": {
      const text = String(payload.text ?? payload.number ?? "").trim();
      if (!text || text.length > 200) return "Enter the shared answer.";
      current[player.id] = { text };
      if (everyoneSubmitted(rt)) resolveStandard(rt, now);
      return null;
    }
    case "sequence": {
      const pieces = (rt.secret.pieces as { id: string }[]) ?? [];
      const readyAt = rt.startedAt + pieces.length * (rt.config.stepMs ?? 900) + 400;
      if (now < readyAt) return "Watch the sequence first.";
      const order = payload.order ?? [];
      const expected = new Set(pieces.map((piece) => piece.id));
      if (order.length !== pieces.length || new Set(order).size !== order.length || order.some((id) => !expected.has(id))) {
        return "Place every mark once.";
      }
      current[player.id] = { order };
      if (everyoneSubmitted(rt)) resolveStandard(rt, now);
      return null;
    }
    case "pattern_doors": {
      const wall = String(payload.choice ?? "");
      const walls = rt.config.doors?.walls ?? [];
      if (!walls.includes(wall)) return "Choose a door.";
      current[player.id] = { choice: wall };
      if (everyoneSubmitted(rt)) resolveDoorRound(rt, now);
      return null;
    }
    case "number_contest": {
      const rules = rt.config.contest ?? { min: 0, max: 100, factor: 0.8, winPoints: 2, losePoints: -2, rounds: 5 };
      const number = Number(payload.number);
      if (!Number.isFinite(number) || number < rules.min || number > rules.max) return `Enter a number from ${rules.min} to ${rules.max}.`;
      current[player.id] = { number };
      if (everyoneSubmitted(rt)) resolveContestRound(rt, now);
      return null;
    }
    case "role_consensus": {
      if (payload.role) {
        const known = (rt.config.roles ?? []).some((role) => role.id === payload.role);
        if (!known) return "Choose one of the roles.";
        for (const person of activePlayers(rt)) {
          if (current[person.id]) current[person.id] = { ...current[person.id], accepted: false };
        }
        current[player.id] = { ...(current[player.id] ?? {}), role: payload.role, accepted: false };
      } else if (payload.accept) {
        if (!current[player.id]?.role) return "Choose your role before you accept.";
        current[player.id] = { ...current[player.id], accepted: true };
        resolveConsensus(rt, false);
      } else return "Choose a role.";
      return null;
    }
    case "deduction_wolf": {
      if (!payload.playerId) return "Choose a player.";
      if (!activePlayers(rt).some((person) => person.id === payload.playerId)) return "Choose someone at the table.";
      current[player.id] = { playerId: payload.playerId };
      if (everyoneSubmitted(rt)) resolveWolf(rt);
      return null;
    }
    case "transfer": {
      if (player.id !== actorOf(rt)?.id) return "Only the card bearer chooses.";
      if (!payload.playerId || payload.playerId === player.id) return "Choose another player.";
      give(rt, player.id, -(rt.config.transfer?.amount ?? 5), true, "You gave the points away.");
      give(rt, payload.playerId, rt.config.transfer?.amount ?? 5, true, "Points were given to you.");
      finish(rt, "success", "The gift is entered. Digital points only.");
      return null;
    }
    case "pending_trust":
    case "pending_guess":
    case "pending_alliance": {
      if (player.id !== actorOf(rt)?.id) return "Only the card bearer chooses.";
      if (!payload.playerId || payload.playerId === player.id) return "Choose another player.";
      return placePending(rt, player.id, payload.playerId);
    }
    case "pending_risk": {
      if (player.id !== actorOf(rt)?.id) return "Only the card bearer chooses.";
      if (rt.extra.step === "start") {
        if (!payload.playerId || payload.playerId === player.id) return "Choose another player.";
        rt.extra.targetId = payload.playerId;
        rt.extra.step = "suit";
        return null;
      }
      const suit = String(payload.suit ?? "");
      if (!["spades", "hearts", "diamonds", "clubs"].includes(suit)) return "Choose a suit.";
      return placePending(rt, player.id, String(rt.extra.targetId), suit);
    }
    case "reaction": {
      if (!payload.tap) return "Tap when the mark flashes.";
      return registerTap(rt, player.id, now);
    }
    case "order_coop":
      return takeOrderStep(rt, player.id);
    case "word_chain":
      return takeWord(rt, player.id, String(payload.text ?? ""));
    case "intuition":
      return intuitionSubmit(rt, player, payload);
    case "trade":
      return tradeSubmit(rt, player, payload);
    case "chain":
      return chainSubmit(rt, player, payload);
    case "bluff_story":
      return bluffSubmit(rt, player, payload);
    case "forehead":
      return foreheadSubmit(rt, player, payload);
    case "queens_touch":
      return queenSubmit(rt, player, payload, now);
    default:
      return "This game format is not playable yet.";
  }
}

function placePending(rt: Runtime, actorId: string, targetId: string, suit?: string): string | null {
  const rules = rt.config.pendingPoints ?? { hit: 5, miss: -5 };
  const kind =
    rt.format === "pending_trust" ? "trust" : rt.format === "pending_guess" ? "guess" : rt.format === "pending_alliance" ? "alliance" : "risk";
  const draft: PendingDraft = {
    kind,
    actorId,
    targetId,
    suit,
    hit: rules.hit,
    miss: rules.miss,
    bothFail: rules.bothFail,
    oneFail: rules.oneFail,
  };
  give(rt, actorId, 0, true, "The oath is recorded. It resolves on the next challenge.");
  finish(rt, "success", "Recorded. It will resolve when the next challenge ends.", [draft]);
  return null;
}

function registerTap(rt: Runtime, userId: string, now: number): string | null {
  const offsets = (rt.secret.offsets as number[]) ?? [];
  const hits = (rt.extra.hits ?? {}) as Record<string, number[]>;
  const claimed = new Set(hits[userId] ?? []);
  const windowMs = rt.config.windowMs ?? 1200;
  const index = offsets.findIndex((offset, position) => {
    if (claimed.has(position)) return false;
    const delta = now - (rt.startedAt + offset);
    return delta >= 0 && delta <= windowMs;
  });
  if (index < 0) return "Hold for the flash.";
  const next = [...claimed, index];
  hits[userId] = next;
  rt.extra.hits = { ...hits, [userId]: next };
  rt.extra.hitCounts = Object.fromEntries(Object.entries(hits).map(([id, list]) => [id, (list as number[]).length]));
  return null;
}

function takeOrderStep(rt: Runtime, userId: string): string | null {
  const order = (rt.extra.order as string[]) ?? [];
  const cursor = Number(rt.extra.cursor ?? 0);
  if (order[cursor] !== userId) return "Wait for your step.";
  const next = cursor + 1;
  rt.extra.cursor = next;
  rt.log.push(`Step ${next} locked.`);
  if (next >= order.length) {
    const win = points(rt.config, "successPoints", 6);
    for (const player of activePlayers(rt)) give(rt, player.id, win, true, "The order held.");
    finish(rt, "success", "The sequence was completed together.");
  }
  return null;
}

function takeWord(rt: Runtime, userId: string, text: string): string | null {
  const order = (rt.extra.order as string[]) ?? [];
  const cursor = Number(rt.extra.cursor ?? 0);
  if (order[cursor] !== userId) return "Wait for your turn.";
  const word = normalizeText(text).replace(/ /g, "");
  if (word.length < 2 || word.length > 16) return "Use one word, 2 to 16 letters.";
  const words = (rt.extra.words as string[]) ?? [];
  if (words.length > 0 && word[0] !== words[words.length - 1].slice(-1)) {
    return `Your word must start with ${words[words.length - 1].slice(-1).toUpperCase()}.`;
  }
  words.push(word);
  rt.extra.words = words;
  rt.extra.cursor = cursor + 1;
  if (cursor + 1 >= order.length) {
    const win = points(rt.config, "successPoints", 6);
    for (const player of activePlayers(rt)) give(rt, player.id, win, true, "The bridge held.");
    finish(rt, "success", `The chain: ${words.join(" · ")}`);
  }
  return null;
}

function intuitionSubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload): string | null {
  const actor = actorOf(rt);
  if (!actor) return "No bearer.";
  const deck = (rt.extra.deck as CardName[]) ?? [];
  const pick = deck.find((card) => card.id === (payload.choice || payload.cardId));
  if (rt.extra.step === "start") {
    if (player.id !== actor.id) return "The bearer chooses a partner.";
    if (!payload.playerId || payload.playerId === actor.id) return "Choose another player.";
    rt.extra.targetId = payload.playerId;
    rt.extra.step = "first";
    return null;
  }
  if (rt.extra.step === "first" || rt.extra.step === "second") {
    if (player.id !== rt.extra.targetId) return "The chosen player sets the cards.";
    if (!pick) return "Choose a card.";
    if (rt.extra.step === "first") {
      rt.extra.firstId = pick.id;
      rt.extra.step = "second";
      return null;
    }
    if (pick.id === rt.extra.firstId) return "Choose a different card.";
    rt.extra.secondId = pick.id;
    rt.extra.step = "truth";
    return null;
  }
  if (rt.extra.step === "truth" || rt.extra.step === "recommend") {
    if (player.id !== rt.extra.targetId) return "The chosen player is still setting the cards.";
    const first = deck.find((card) => card.id === rt.extra.firstId);
    const second = deck.find((card) => card.id === rt.extra.secondId);
    if (!first || !second || !pick || (pick.id !== first.id && pick.id !== second.id)) return "Choose one of the two cards.";
    if (rt.extra.step === "truth") {
      rt.secret = { ...rt.secret, truth: pick.id, first, second };
      rt.extra.step = "recommend";
      return null;
    }
    rt.extra.shown = [first, second];
    rt.extra.recommendation = pick.label;
    rt.extra.step = "choose";
    return null;
  }
  if (player.id !== actor.id) return "The bearer chooses now.";
  const truth = String(rt.secret.truth ?? "");
  const picked = String(payload.choice ?? "");
  const pair = rt.config.pairPoints ?? 7;
  const targetId = String(rt.extra.targetId);
  if (picked === truth) {
    give(rt, actor.id, pair, true, "You found the real card.");
    give(rt, targetId, -pair, false, "The bearer found the real card.");
    finish(rt, "mixed", "Intuition held.");
  } else {
    give(rt, actor.id, -pair, false, "The real card was the other one.");
    give(rt, targetId, pair, true, "The bearer missed.");
    finish(rt, "mixed", "Intuition missed.");
  }
  return null;
}

function tradeSubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload): string | null {
  const actor = actorOf(rt);
  if (!actor) return "No bearer.";
  const deck = (rt.extra.deck as CardName[]) ?? [];
  if (rt.extra.step === "start") {
    if (player.id !== actor.id) return "The bearer chooses who to face.";
    if (!payload.playerId || payload.playerId === actor.id) return "Choose another player.";
    if (deck.length < 2) return "Not enough cards are published to trade.";
    rt.extra.targetId = payload.playerId;
    rt.extra.actorCard = deck[0];
    rt.extra.targetCard = deck[1];
    rt.extra.step = "decide";
    return null;
  }
  if (player.id !== rt.extra.targetId) return "The other player decides.";
  const swap = payload.flag === true;
  const pair = rt.config.pairPoints ?? 7;
  rt.extra.swapped = swap;
  if (swap) {
    give(rt, actor.id, pair, true, "They took the offered card.");
    give(rt, player.id, 0, true, "You accepted the trade.");
    finish(rt, "success", "The trade was accepted.");
  } else {
    give(rt, actor.id, -pair, false, "They kept their own card.");
    give(rt, player.id, 0, true, "You kept your card.");
    finish(rt, "mixed", "The trade was refused.");
  }
  return null;
}

function chainSubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload): string | null {
  const actor = actorOf(rt);
  if (!actor) return "No bearer.";
  const deck = (rt.extra.deck as CardName[]) ?? [];
  if (!rt.extra.holderId) {
    if (player.id !== actor.id) return "The bearer starts the chain.";
    if (!rt.extra.pendingCard) {
      const card = deck.find((item) => item.id === (payload.cardId || payload.choice));
      if (!card) return "Choose a card.";
      rt.extra.pendingCard = card;
      return null;
    }
    if (!payload.playerId || payload.playerId === actor.id) return "Pass it to someone else.";
    const card = rt.extra.pendingCard as CardName;
    rt.extra.originId = actor.id;
    rt.extra.holderId = payload.playerId;
    rt.extra.card = card;
    rt.log.push(`${actor.username} passed ${card.label}.`);
    return null;
  }
  if (player.id !== rt.extra.holderId) return "Only the player holding the card can pass it.";
  if (!payload.playerId || payload.playerId === player.id) return "Pass it to someone else.";
  rt.extra.holderId = payload.playerId;
  const card = rt.extra.card as CardName;
  rt.log.push(`${player.username} passed ${card?.label ?? "the card"}.`);
  return null;
}

function bluffSubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload): string | null {
  const actor = actorOf(rt);
  if (!actor) return "No bearer.";
  if (rt.extra.step === "start") {
    if (player.id !== actor.id) return "The bearer chooses a listener.";
    if (!payload.playerId || payload.playerId === actor.id) return "Choose another player.";
    rt.extra.targetId = payload.playerId;
    rt.extra.step = "tell";
    return null;
  }
  if (rt.extra.step === "tell") {
    if (player.id !== actor.id) return "The bearer tells the story.";
    const text = String(payload.text ?? "").trim();
    if (text.length < 8 || text.length > 800) return "Tell a short story, at least a sentence.";
    rt.extra.story = text;
    rt.extra.step = "truth";
    return null;
  }
  if (rt.extra.step === "truth") {
    if (player.id !== actor.id) return "The bearer marks the story.";
    if (typeof payload.flag !== "boolean" && typeof payload.truth !== "boolean") return "Mark whether the story is true.";
    rt.secret = { ...rt.secret, truth: typeof payload.flag === "boolean" ? payload.flag : payload.truth };
    rt.extra.step = "guess";
    return null;
  }
  if (player.id !== rt.extra.targetId) return "The listener guesses.";
  if (typeof payload.flag !== "boolean") return "Say whether you believe it.";
  const truth = Boolean(rt.secret.truth);
  const rules = rt.config.bluff ?? { fooledPoints: 10, caughtPoints: -10 };
  const fooled = payload.flag !== truth;
  if (fooled) {
    give(rt, actor.id, rules.fooledPoints, true, "The listener missed.");
    give(rt, player.id, 0, false, "Your read was wrong.");
    finish(rt, "mixed", "The story was not read.");
  } else {
    give(rt, actor.id, rules.caughtPoints, false, "The listener read it.");
    give(rt, player.id, Math.abs(rules.fooledPoints), true, "Your read was right.");
    finish(rt, "mixed", "The story was read.");
  }
  return null;
}

function foreheadSubmit(rt: Runtime, player: PlayerRef, payload: SubmitPayload): string | null {
  const assignment = rt.secret.assignment as Record<string, CardName>;
  const guess = String(payload.guess || payload.choice || "");
  const mine = assignment[player.id];
  if (!mine || !Object.values(assignment).some((card) => card.id === guess)) return "Name the card you think is yours.";
  const current = bag(rt);
  current[player.id] = {
    guess,
    misleadTo: payload.misleadTo ?? "",
    misleadCard: payload.misleadCard ?? "",
  };
  if (everyoneSubmitted(rt)) resolveForehead(rt);
  return null;
}

function resolveForehead(rt: Runtime) {
  const assignment = rt.secret.assignment as Record<string, CardName>;
  const rules = rt.config.forehead ?? { correct: 10, wrong: -15, mislead: 5 };
  const current = bag(rt);
  for (const player of activePlayers(rt)) {
    const guess = String(current[player.id]?.guess ?? "");
    const correct = guess === assignment[player.id]?.id;
    give(rt, player.id, correct ? rules.correct : rules.wrong, correct, correct ? "You named your card." : "That was not your card.");
  }
  for (const player of activePlayers(rt)) {
    const to = String(current[player.id]?.misleadTo ?? "");
    const card = String(current[player.id]?.misleadCard ?? "");
    if (!to || !card || to === player.id) continue;
    const victimGuess = String(current[to]?.guess ?? "");
    const actual = assignment[to]?.id;
    if (victimGuess === card && card !== actual) {
      give(rt, player.id, rules.mislead, rt.success[player.id] ?? false, "Someone followed your wrong suggestion.");
    }
  }
  finish(rt, toneFrom(rt), "The forehead cards are named. Digital points only.");
}

export function hostAct(
  runtime: Runtime,
  action:
    | { type: "hint" }
    | { type: "reveal" }
    | { type: "pause"; now: number }
    | { type: "resume"; now: number }
    | { type: "extend"; seconds: number }
    | { type: "shorten"; seconds: number }
    | { type: "skip"; now: number }
    | { type: "end" }
    | { type: "mark"; userId: string; correct: boolean }
    | { type: "resolve" },
): EngineResult {
  const rt = clone(runtime);
  if (rt.phase === "complete" && action.type !== "reveal") return reject(rt, "This challenge is already over.");
  if (action.type === "hint") {
    rt.hintLevel = rt.hintLevel < 1 ? 1 : rt.hintLevel;
    rt.log.push("A hint was opened.");
    return { ok: true, runtime: rt };
  }
  if (action.type === "reveal") {
    rt.hintLevel = 2;
    rt.log.push("The answer was revealed.");
    return { ok: true, runtime: rt };
  }
  if (action.type === "pause") {
    if (rt.deadline !== null) rt.pausedRemaining = Math.max(0, rt.deadline - action.now);
    rt.deadline = null;
    return { ok: true, runtime: rt };
  }
  if (action.type === "resume") {
    const remaining = rt.pausedRemaining ?? 0;
    rt.pausedRemaining = null;
    if (remaining > 0) rt.deadline = action.now + remaining;
    return { ok: true, runtime: rt };
  }
  if (action.type === "extend" || action.type === "shorten") {
    const delta = Math.max(1, Math.min(600, action.seconds)) * 1000 * (action.type === "extend" ? 1 : -1);
    if (rt.deadline !== null) rt.deadline = Math.max(Date.now() + 1000, rt.deadline + delta);
    if (rt.pausedRemaining !== null) rt.pausedRemaining = Math.max(1000, rt.pausedRemaining + delta);
    return { ok: true, runtime: rt };
  }
  if (action.type === "skip") {
    if (rt.format === "queens_touch") queenHost(rt, "skip", action.now);
    else resolveStandard(rt, action.now);
    return { ok: true, runtime: rt };
  }
  if (action.type === "end") {
    if (rt.format === "queens_touch") {
      queenHost(rt, "end", Date.now());
      return { ok: true, runtime: rt };
    }
    for (const player of activePlayers(rt)) {
      if (rt.reasons[player.id]) continue;
      give(rt, player.id, 0, false, "The representative closed the challenge.");
    }
    finish(rt, "fail", "The representative closed the challenge early.");
    return { ok: true, runtime: rt };
  }
  if (action.type === "mark") {
    if (rt.format !== "host_judge") return reject(rt, "This challenge scores itself.");
    const marks = { ...((rt.extra.marks as Record<string, string>) ?? {}) };
    marks[action.userId] = action.correct ? "yes" : "no";
    rt.extra.marks = marks;
    return { ok: true, runtime: rt };
  }
  if (action.type === "resolve") {
    if (rt.format !== "host_judge") return reject(rt, "This challenge scores itself.");
    const marks = (rt.extra.marks as Record<string, string>) ?? {};
    const win = points(rt.config, "successPoints", 5);
    const lose = points(rt.config, "failPoints", 0);
    for (const player of activePlayers(rt)) {
      const ok = marks[player.id] === "yes";
      give(rt, player.id, ok ? win : lose, ok, ok ? "The representative accepted the answer." : "The representative did not accept the answer.");
    }
    finish(rt, toneFrom(rt), "Judgment is entered.");
    return { ok: true, runtime: rt };
  }
  return reject(rt, "Unknown control.");
}

function sequenceReady(rt: Runtime, now: number) {
  const pieces = (rt.secret.pieces as { id: string }[]) ?? [];
  return now >= rt.startedAt + pieces.length * (rt.config.stepMs ?? 900) + 400;
}

function revealedPieces(rt: Runtime, now: number) {
  const pieces = (rt.secret.pieces as { id: string; token: string }[]) ?? [];
  const step = rt.config.stepMs ?? 900;
  const count = Math.max(0, Math.min(pieces.length, Math.floor((now - rt.startedAt) / step)));
  const labels = rt.config.sequenceLabels ?? {};
  return pieces.slice(0, count).map((piece) => ({ id: piece.token, label: labels[piece.token] ?? piece.token }));
}

export function view(runtime: Runtime, userId: string | null, isHost: boolean, now: number, revealQueen = true): PlayView {
  if (runtime.format === "queens_touch") return queenView(runtime, userId, isHost, now, revealQueen);
  const rt = runtime;
  const active = activePlayers(rt);
  const current = rt.submissions[String(rt.round)] ?? {};
  const me = userId ? active.find((player) => player.id === userId) : undefined;
  const paused = rt.pausedRemaining !== null;
  const progress = active.map((player) => ({
    id: player.id,
    name: player.username,
    done: Boolean(current[player.id]) || rt.phase === "complete",
  }));
  const base: PlayView = {
    format: rt.format,
    round: rt.round + 1,
    rounds: rt.rounds,
    phase: rt.phase,
    deadline: paused ? now + (rt.pausedRemaining ?? 0) : rt.deadline,
    paused,
    prompt: rt.config.prompt || "Follow the representative.",
    subprompt: "",
    input: { kind: "wait", message: "Watch the main screen." },
    submitted: Boolean(userId && current[userId]),
    feedback: rt.feedback,
    progress,
    hint: rt.hintLevel >= 1 ? rt.config.hint ?? null : null,
    revealed: rt.hintLevel >= 2 ? rt.config.answerReveal ?? null : null,
    board: null,
    yourScore: userId ? rt.scores[userId] ?? 0 : 0,
    hostPanel: isHost && rt.format === "host_judge" ? judgeEntries(rt) : null,
  };
  if (rt.phase === "complete") {
    base.input = { kind: "wait", message: rt.summary || "The challenge is over." };
    base.board = publicBoard(rt, userId, isHost, now);
    return base;
  }
  if (rt.phase === "feedback") {
    base.input = { kind: "wait", message: rt.feedback || "Round closed." };
    base.board = publicBoard(rt, userId, isHost, now);
    return base;
  }
  if (!me && !(isHost && rt.format === "host_judge")) {
    base.board = publicBoard(rt, userId, isHost, now);
    return base;
  }
  base.input = inputFor(rt, me, isHost, now);
  base.subprompt = subprompt(rt, me);
  base.board = publicBoard(rt, userId, isHost, now);
  if (base.input.kind !== "tap" && base.input.kind !== "accept" && userId && current[userId] && LOCKED.has(rt.format)) {
    base.submitted = true;
  }
  return base;
}

function subprompt(rt: Runtime, me: PlayerRef | undefined) {
  if (rt.format === "pattern_doors") return `Door round ${rt.round + 1} of ${rt.rounds}. Life is +1. End is −1. Digital only.`;
  if (rt.format === "number_contest") return `Round ${rt.round + 1} of ${rt.rounds}.`;
  if (rt.format === "deduction_wolf") return me && rt.secret.wolfId === me.id ? "You are the wolf. Mark one player." : "You are a sheep. Cover is real only when someone else covers you.";
  return "";
}

function inputFor(rt: Runtime, me: PlayerRef | undefined, isHost: boolean, now: number): PlayInput {
  const people = activePlayers(rt)
    .filter((player) => player.id !== me?.id)
    .map((player) => ({ id: player.id, label: player.username }));
  switch (rt.format) {
    case "multiple_choice":
    case "echo_choice":
      return { kind: "choice", options: rt.config.options ?? [] };
    case "keywords":
    case "host_judge":
      return { kind: "text", placeholder: "Write your answer" };
    case "split_clue":
    case "unanimous":
      return { kind: "text", placeholder: rt.format === "unanimous" ? "Agree on one answer" : "The assembled answer" };
    case "sequence":
      if (!sequenceReady(rt, now)) return { kind: "wait", message: "Watch the sequence." };
      return { kind: "order", pool: shuffledPool(rt) };
    case "pattern_doors":
      return { kind: "doors", walls: rt.config.doors?.walls ?? [] };
    case "number_contest": {
      const rules = rt.config.contest ?? { min: 0, max: 100, factor: 0.8, winPoints: 2, losePoints: -2, rounds: 5 };
      return { kind: "number", min: rules.min, max: rules.max };
    }
    case "role_consensus":
      return { kind: "roles", roles: rt.config.roles ?? [] };
    case "deduction_wolf":
    case "transfer":
    case "pending_trust":
    case "pending_guess":
    case "pending_alliance":
      return { kind: "players", people };
    case "pending_risk":
      return rt.extra.step === "suit" ? { kind: "suits" } : { kind: "players", people };
    case "reaction":
      return { kind: "tap", label: "Tap the flash" };
    case "order_coop": {
      const order = (rt.extra.order as string[]) ?? [];
      const cursor = Number(rt.extra.cursor ?? 0);
      if (order[cursor] !== me?.id) {
        const name = activePlayers(rt).find((player) => player.id === order[cursor])?.username ?? "someone";
        return { kind: "wait", message: `Waiting for ${name}.` };
      }
      return { kind: "tap", label: "My step" };
    }
    case "word_chain": {
      const order = (rt.extra.order as string[]) ?? [];
      const cursor = Number(rt.extra.cursor ?? 0);
      if (order[cursor] !== me?.id) {
        const name = activePlayers(rt).find((player) => player.id === order[cursor])?.username ?? "someone";
        return { kind: "wait", message: `Waiting for ${name}.` };
      }
      const words = (rt.extra.words as string[]) ?? [];
      const start = words.length ? words[words.length - 1].slice(-1).toUpperCase() : "any letter";
      return { kind: "text", placeholder: `One word starting with ${start}` };
    }
    case "intuition":
      return intuitionInput(rt, me);
    case "trade":
      return tradeInput(rt, me);
    case "chain":
      return chainInput(rt, me, people);
    case "bluff_story":
      return bluffInput(rt, me, people);
    case "forehead":
      return { kind: "choice", options: foreheadOptions(rt) };
    default:
      return { kind: "wait", message: "Waiting." };
  }
}

function judgeEntries(rt: Runtime): Extract<PlayInput, { kind: "judge" }> {
  const marks = (rt.extra.marks as Record<string, string>) ?? {};
  const current = rt.submissions[String(rt.round)] ?? {};
  return {
    kind: "judge",
    entries: activePlayers(rt).map((player) => ({
      id: player.id,
      name: player.username,
      text: String(current[player.id]?.text ?? ""),
      marked: marks[player.id] ?? null,
    })),
  };
}

function shuffledPool(rt: Runtime) {
  const pieces = (rt.secret.pieces as { id: string; token: string }[]) ?? [];
  const labels = rt.config.sequenceLabels ?? {};
  const rand = hashSeed(pieces.map((piece) => piece.id).join("|") || "pool");
  return shuffle(pieces, rand).map((piece) => ({ id: piece.id, label: labels[piece.token] ?? piece.token }));
}

function intuitionInput(rt: Runtime, me: PlayerRef | undefined): PlayInput {
  const actor = actorOf(rt);
  const people = activePlayers(rt).filter((player) => player.id !== me?.id).map((player) => ({ id: player.id, label: player.username }));
  if (rt.extra.step === "start") {
    return me?.id === actor?.id ? { kind: "players", people } : { kind: "wait", message: "The bearer is choosing a partner." };
  }
  const deck = (rt.extra.deck as CardName[]) ?? [];
  if (rt.extra.step === "first" || rt.extra.step === "second") {
    if (me?.id !== rt.extra.targetId) return { kind: "wait", message: "Two cards are being prepared." };
    const options = deck
      .filter((card) => rt.extra.step === "first" || card.id !== rt.extra.firstId)
      .map((card) => ({ id: card.id, label: card.label }));
    return { kind: "choice", options };
  }
  if (rt.extra.step === "truth" || rt.extra.step === "recommend") {
    if (me?.id !== rt.extra.targetId) return { kind: "wait", message: "The cards are being marked." };
    const options = deck
      .filter((card) => card.id === rt.extra.firstId || card.id === rt.extra.secondId)
      .map((card) => ({ id: card.id, label: card.label }));
    return { kind: "choice", options };
  }
  if (me?.id !== actor?.id) return { kind: "wait", message: "The bearer is choosing." };
  const shown = (rt.extra.shown as CardName[]) ?? [];
  return {
    kind: "pair",
    cards: shown.map((card) => ({ id: card.id, label: card.label })),
    recommendation: String(rt.extra.recommendation ?? shown[0]?.label ?? ""),
  };
}

function tradeInput(rt: Runtime, me: PlayerRef | undefined): PlayInput {
  const actor = actorOf(rt);
  if (rt.extra.step === "start") {
    const people = activePlayers(rt).filter((player) => player.id !== me?.id).map((player) => ({ id: player.id, label: player.username }));
    return me?.id === actor?.id ? { kind: "players", people } : { kind: "wait", message: "A partner is being chosen." };
  }
  if (me?.id !== rt.extra.targetId) return { kind: "wait", message: "Waiting for the decision." };
  return { kind: "boolean", trueLabel: "Take their card", falseLabel: "Keep mine" };
}

function chainInput(rt: Runtime, me: PlayerRef | undefined, people: { id: string; label: string }[]): PlayInput {
  const actor = actorOf(rt);
  if (!rt.extra.holderId) {
    if (me?.id !== actor?.id) return { kind: "wait", message: "The bearer is choosing a card to pass." };
    if (!rt.extra.pendingCard) {
      const deck = (rt.extra.deck as CardName[]) ?? [];
      return { kind: "choice", options: deck.slice(0, 4).map((card) => ({ id: card.id, label: card.label })) };
    }
    return { kind: "players", people };
  }
  if (me?.id !== rt.extra.holderId) return { kind: "wait", message: "The card is moving." };
  return { kind: "players", people };
}

function bluffInput(rt: Runtime, me: PlayerRef | undefined, people: { id: string; label: string }[]): PlayInput {
  const actor = actorOf(rt);
  if (rt.extra.step === "start") return me?.id === actor?.id ? { kind: "players", people } : { kind: "wait", message: "A listener is being chosen." };
  if (rt.extra.step === "tell") return me?.id === actor?.id ? { kind: "story" } : { kind: "wait", message: "A story is being told." };
  if (rt.extra.step === "truth") return me?.id === actor?.id ? { kind: "boolean", trueLabel: "The story is true", falseLabel: "The story is invented" } : { kind: "wait", message: "The bearer is marking the story." };
  if (me?.id !== rt.extra.targetId) return { kind: "wait", message: "The listener is deciding." };
  return { kind: "boolean", trueLabel: "I believe it", falseLabel: "I don't believe it" };
}

function foreheadOptions(rt: Runtime) {
  const assignment = (rt.secret.assignment as Record<string, CardName>) ?? {};
  const unique = new Map<string, string>();
  for (const card of Object.values(assignment)) unique.set(card.id, card.label);
  return [...unique.entries()].map(([id, label]) => ({ id, label }));
}

function publicBoard(rt: Runtime, userId: string | null, isHost: boolean, now: number) {
  if (rt.format === "sequence") {
    const accepting = sequenceReady(rt, now);
    return { revealed: accepting ? [] : revealedPieces(rt, now), accepting };
  }
  if (rt.format === "pattern_doors") return { last: rt.extra.lastDoors ?? [], round: rt.round + 1 };
  if (rt.format === "number_contest") return { last: rt.extra.lastBoard ?? null };
  if (rt.format === "role_consensus") {
    const current = rt.submissions[String(rt.round)] ?? {};
    return {
      seats: activePlayers(rt).map((player) => ({
        name: player.username,
        role: current[player.id]?.role ?? null,
        accepted: current[player.id]?.accepted === true,
      })),
    };
  }
  if (rt.format === "reaction") {
    const offsets = (rt.secret.offsets as number[]) ?? [];
    const windowMs = rt.config.windowMs ?? 1200;
    const live = offsets.some((offset) => {
      const delta = now - (rt.startedAt + offset);
      return delta >= 0 && delta <= windowMs;
    });
    return { live, hits: rt.extra.hitCounts ?? {} };
  }
  if (rt.format === "word_chain") return { words: rt.extra.words ?? [], cursor: rt.extra.cursor ?? 0 };
  if (rt.format === "order_coop") {
    const order = (rt.extra.order as string[]) ?? [];
    const cursor = Number(rt.extra.cursor ?? 0);
    return { steps: order.length, cursor, current: activePlayers(rt).find((player) => player.id === order[cursor])?.username ?? "" };
  }
  if (rt.format === "chain") {
    const card = rt.extra.card as CardName | undefined;
    const holder = activePlayers(rt).find((player) => player.id === rt.extra.holderId);
    return { card: card?.label ?? null, holder: holder?.username ?? null };
  }
  if (rt.format === "trade" && rt.extra.step === "decide") {
    const actorCard = rt.extra.actorCard as CardName;
    const targetCard = rt.extra.targetCard as CardName;
    return { offered: actorCard?.label ?? "", theirs: targetCard?.label ?? "" };
  }
  if (rt.format === "bluff_story" && rt.extra.story && (rt.extra.step === "guess" || rt.phase === "complete")) {
    return { story: rt.extra.story, truth: rt.hintLevel >= 2 || rt.phase === "complete" ? rt.secret.truth : null };
  }
  if (rt.format === "forehead") {
    const assignment = (rt.secret.assignment as Record<string, CardName>) ?? {};
    if (!userId || !assignment[userId]) {
      return { hidden: true, message: "Cards are dealt to phones only. The main screen stays dark." };
    }
    return {
      others: activePlayers(rt)
        .filter((player) => player.id !== userId)
        .map((player) => ({ name: player.username, card: assignment[player.id]?.label ?? "" })),
      selfHidden: true,
    };
  }
  if (rt.format === "split_clue") {
    const dealt = (rt.secret.dealt as Record<string, string>) ?? {};
    return { fragment: userId ? dealt[userId] ?? "" : "", count: activePlayers(rt).length };
  }
  if (rt.format === "deduction_wolf" && rt.phase === "complete" && (isHost || rt.hintLevel >= 2)) {
    const wolf = activePlayers(rt).find((player) => player.id === rt.secret.wolfId);
    return { wolf: wolf?.username ?? "" };
  }
  if (isHost && rt.format === "host_judge") return { judging: true };
  return null;
}

export function outcomes(rt: Runtime): Outcome[] {
  return activePlayers(rt).map((player) => ({
    userId: player.id,
    delta: rt.scores[player.id] ?? 0,
    success: Boolean(rt.success[player.id]),
    reason: rt.reasons[player.id] || "",
  }));
}

export function challengePending(rt: Runtime) {
  return rt.pending ?? [];
}

export function isComplete(rt: Runtime) {
  return rt.phase === "complete";
}
