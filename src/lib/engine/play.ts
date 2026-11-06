export type CardFace = {
  id: string;
  suit: string;
  rank: string;
  title: string;
  prompt: string;
  source: string;
  effect: Record<string, unknown>;
  secret: Record<string, unknown>;
};

export type Seat = {
  id: string;
  status: string;
};

export type Move = {
  participantId: string;
  payload: Record<string, unknown>;
  at?: number;
};

export type Delta = {
  participantId: string;
  points: number;
  reason: string;
};

export type Pending =
  | { type: "trust"; pickerId: string; trustedId: string; lost: number; kept: number }
  | { type: "prediction"; pickerId: string; targetId: string; zakken: number; win: number }
  | { type: "alliance"; pickerId: string; partnerId: string; bothGain: number; oneLoses: number; bothLose: number }
  | { type: "assigned"; assignerId: string; assignedId: string; cardId: string; loses: number; wins: number };

export type PhoneTrack = {
  taps: Record<string, number>;
  holdStart: Record<string, number>;
  stillStart: Record<string, number>;
  stillTapped: Record<string, boolean>;
  passes: number;
  cups: number;
};

export type RoundContext = {
  actors: Seat[];
  moves: Move[];
  inner: number;
  innerCount: number;
  now: number;
  deadlineAt: number | null;
  hands: Record<string, string[]>;
  forehead: Record<string, string>;
  phone: PhoneTrack;
};

export type Outcome = {
  resolvable: boolean;
  ready: boolean;
  complete: boolean;
  message: string;
  deltas: Delta[];
  pending: Pending[];
  hands: Record<string, string[]>;
  phone: PhoneTrack;
};

const BLOCKED_KEYS = new Set(["points", "score", "scores", "result", "delta", "deltas", "secret", "answer"]);

export function emptyPhone(): PhoneTrack {
  return { taps: {}, holdStart: {}, stillStart: {}, stillTapped: {}, passes: 0, cups: 0 };
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function sanitizeMove(value: unknown): Record<string, unknown> {
  const source = asObject(value);
  const payload: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (BLOCKED_KEYS.has(key)) {
      continue;
    }
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null) {
      payload[key] = entry;
    }
  }
  return payload;
}

export function scoringNumber(effect: Record<string, unknown>, key: string) {
  const scoring = asObject(effect.scoring);
  const value = scoring[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function flag(payload: Record<string, unknown>, key: string) {
  return payload[key] === true;
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/degrees?|°/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function answersMatch(given: string, expected: string) {
  const left = normalize(given);
  const right = normalize(expected);
  return left.length > 0 && left === right;
}

function waiting(message: string, phone: PhoneTrack, hands: Record<string, string[]>): Outcome {
  return { resolvable: true, ready: false, complete: false, message, deltas: [], pending: [], hands, phone };
}

function unresolved(message: string, phone: PhoneTrack, hands: Record<string, string[]>): Outcome {
  return { resolvable: false, ready: true, complete: true, message, deltas: [], pending: [], hands, phone };
}

function done(
  message: string,
  deltas: Delta[],
  phone: PhoneTrack,
  hands: Record<string, string[]>,
  pending: Pending[] = [],
): Outcome {
  return { resolvable: true, ready: true, complete: true, message, deltas, pending, hands, phone };
}

function moveFor(moves: Move[], participantId: string) {
  return [...moves].reverse().find((move) => move.participantId === participantId);
}

function kindOf(card: CardFace) {
  const kind = card.effect.kind;
  return typeof kind === "string" ? kind : "";
}

export function actorCount(effect: Record<string, unknown>, seated: number) {
  const raw = effect.player_count;
  if (raw === "all") {
    return Math.max(seated, 1);
  }
  const count = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(count) || count < 1) {
    return 1;
  }
  return count;
}

export function assignActors(seats: Seat[], drawIndex: number, needed: number) {
  const active = seats.filter((seat) => seat.status === "active");
  if (active.length === 0 || needed > active.length) {
    return [];
  }
  const start = (drawIndex - 1) % active.length;
  const actors: Seat[] = [];
  for (let offset = 0; offset < needed; offset += 1) {
    actors.push(active[(start + offset) % active.length]);
  }
  return actors;
}

export function pickCard(
  pool: { id: string; suit: string; rank: string; source: string }[],
  dealt: string[],
  assignedId: string | null,
  rng: () => number = Math.random,
) {
  if (assignedId) {
    const assigned = pool.find((card) => card.id === assignedId);
    if (!assigned) {
      return { id: null as string | null, message: "The assigned card is not a published, in-play card." };
    }
    return { id: assigned.id, message: null as string | null };
  }

  const fresh = pool.filter((card) => !dealt.includes(card.id));
  const chosen = new Map<string, (typeof fresh)[number]>();
  for (const card of fresh) {
    const key = `${card.suit}:${card.rank}`;
    const previous = chosen.get(key);
    if (!previous || (card.source === "proposal" && previous.source !== "proposal")) {
      chosen.set(key, card);
    }
  }
  const list = [...chosen.values()];
  if (list.length === 0) {
    return { id: null, message: "No published card is left to draw." };
  }
  const index = Math.min(list.length - 1, Math.floor(rng() * list.length));
  return { id: list[index].id, message: null };
}

export function digitalElimination(players: { id: string; status: string; points: number }[], enabled: boolean) {
  if (!enabled) {
    return [] as string[];
  }
  const active = players.filter((player) => player.status === "active");
  if (active.length < 2) {
    return [];
  }
  const lowest = Math.min(...active.map((player) => player.points));
  const tied = active.filter((player) => player.points === lowest);
  if (tied.length !== 1) {
    return [];
  }
  return [tied[0].id];
}

export function applyPending(pending: Pending[], deltas: Delta[], actorIds: string[]) {
  const extra: Delta[] = [];
  const deltaFor = (id: string) => deltas.find((delta) => delta.participantId === id)?.points ?? 0;
  for (const item of pending) {
    if (item.type === "trust") {
      const lost = deltaFor(item.pickerId) < 0 && actorIds.includes(item.trustedId);
      extra.push({
        participantId: item.pickerId,
        points: lost ? item.lost : item.kept,
        reason: lost ? "betrayed" : "kept",
      });
    }
    if (item.type === "prediction") {
      const change = deltaFor(item.targetId);
      if (change < 0) {
        extra.push({ participantId: item.pickerId, points: item.zakken, reason: "zakken" });
      } else if (change > 0) {
        extra.push({ participantId: item.pickerId, points: item.win, reason: "win" });
      }
    }
    if (item.type === "alliance") {
      const left = deltaFor(item.pickerId);
      const right = deltaFor(item.partnerId);
      let points = 0;
      if (left > 0 && right > 0) {
        points = item.bothGain;
      } else if (left < 0 && right < 0) {
        points = item.bothLose;
      } else if (left < 0 || right < 0) {
        points = item.oneLoses;
      }
      if (points !== 0) {
        extra.push({ participantId: item.pickerId, points, reason: "alliance" });
        extra.push({ participantId: item.partnerId, points, reason: "alliance" });
      }
    }
    if (item.type === "assigned") {
      const change = deltaFor(item.assignedId);
      if (change < 0) {
        extra.push({ participantId: item.assignerId, points: item.loses, reason: "assigned_loses" });
      } else if (change > 0) {
        extra.push({ participantId: item.assignerId, points: item.wins, reason: "assigned_wins" });
      }
    }
  }
  return extra;
}

function puzzle(card: CardFace, context: RoundContext): Outcome {
  const expected = card.secret.answer;
  if (typeof expected !== "string" || !expected.trim()) {
    return unresolved("This card has no stored answer. No score is written.", context.phone, context.hands);
  }
  const success = scoringNumber(card.effect, "success");
  if (success === null) {
    return unresolved("This card does not store a success score. No score is written.", context.phone, context.hands);
  }
  const miss = scoringNumber(card.effect, "miss") ?? 0;
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Waiting for an answer.", context.phone, context.hands);
  }
  const given = text(move.payload, "text");
  const matched = answersMatch(given, expected);
  return done(
    matched ? "The answer matches the card." : "The answer does not match the card.",
    [{ participantId: actor.id, points: matched ? success : miss, reason: matched ? "match" : "miss" }],
    context.phone,
    context.hands,
  );
}

function door(card: CardFace, context: RoundContext): Outcome {
  const clear = scoringNumber(card.effect, "clear");
  const out = scoringNumber(card.effect, "out");
  if (clear === null || out === null) {
    return unresolved("This door card does not store its point numbers. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting(`Round ${context.inner} of ${context.innerCount}. Pick a door.`, context.phone, context.hands);
  }
  const doorName = text(move.payload, "choice").toLowerCase();
  const walls = ["north", "east", "south", "west"];
  if (!walls.includes(doorName)) {
    return waiting("Pick north, east, south, or west.", context.phone, context.hands);
  }
  const clearSet = context.inner % 2 === 1 ? new Set(["north", "south"]) : new Set(["east", "west"]);
  const points = clearSet.has(doorName) ? clear : out;
  const last = context.inner >= context.innerCount;
  return {
    resolvable: true,
    ready: true,
    complete: last,
    message: points > 0 ? "That door is clear." : "That door is out. Points only.",
    deltas: [{ participantId: actor.id, points, reason: points > 0 ? "clear" : "out" }],
    pending: [],
    hands: context.hands,
    phone: context.phone,
  };
}

function numberTarget(context: RoundContext): Outcome {
  return unresolved(
    "This card does not define the result the numbers are measured against. No score is written.",
    context.phone,
    context.hands,
  );
}

function pointGift(card: CardFace, context: RoundContext): Outcome {
  const gift = scoringNumber(card.effect, "gift");
  if (gift === null) {
    return unresolved("This card does not store the gift. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Choose a player to receive the points.", context.phone, context.hands);
  }
  const target = text(move.payload, "target");
  if (!target || target === actor.id) {
    return waiting("Choose another player.", context.phone, context.hands);
  }
  return done("The points are given.", [{ participantId: target, points: gift, reason: "gift" }], context.phone, context.hands);
}

function transfer(card: CardFace, context: RoundContext): Outcome {
  const take = scoringNumber(card.effect, "take");
  if (take === null) {
    return unresolved("This card does not store the transfer. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Choose a player.", context.phone, context.hands);
  }
  const target = text(move.payload, "target");
  if (!target || target === actor.id) {
    return waiting("Choose another player.", context.phone, context.hands);
  }
  return done(
    "The points move.",
    [
      { participantId: actor.id, points: take, reason: "take" },
      { participantId: target, points: -take, reason: "taken" },
    ],
    context.phone,
    context.hands,
  );
}

function trust(card: CardFace, context: RoundContext): Outcome {
  const lost = scoringNumber(card.effect, "betrayed");
  const kept = scoringNumber(card.effect, "kept");
  if (lost === null || kept === null) {
    return unresolved("This card does not store the trust scores. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Choose a player to trust.", context.phone, context.hands);
  }
  const trustedId = text(move.payload, "target");
  if (!trustedId || trustedId === actor.id) {
    return waiting("Choose another player.", context.phone, context.hands);
  }
  return done("Trust is scored from the next card.", [], context.phone, context.hands, [
    { type: "trust", pickerId: actor.id, trustedId, lost, kept },
  ]);
}

function prediction(card: CardFace, context: RoundContext): Outcome {
  const zakken = scoringNumber(card.effect, "zakken");
  const win = scoringNumber(card.effect, "win");
  if (zakken === null || win === null) {
    return unresolved("This card does not store the guess scores. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Choose who loses points on the next card.", context.phone, context.hands);
  }
  const targetId = text(move.payload, "target");
  if (!targetId) {
    return waiting("Choose a player.", context.phone, context.hands);
  }
  return done("The guess is scored from the next card.", [], context.phone, context.hands, [
    { type: "prediction", pickerId: actor.id, targetId, zakken, win },
  ]);
}

function alliance(card: CardFace, context: RoundContext): Outcome {
  const bothGain = scoringNumber(card.effect, "both_gain");
  const oneLoses = scoringNumber(card.effect, "one_loses");
  const bothLose = scoringNumber(card.effect, "both_lose");
  if (bothGain === null || oneLoses === null || bothLose === null) {
    return unresolved("This card does not store the alliance scores. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Choose an ally for the next card.", context.phone, context.hands);
  }
  const partnerId = text(move.payload, "target");
  if (!partnerId || partnerId === actor.id) {
    return waiting("Choose another player.", context.phone, context.hands);
  }
  return done("The alliance is scored from the next card.", [], context.phone, context.hands, [
    { type: "alliance", pickerId: actor.id, partnerId, bothGain, oneLoses, bothLose },
  ]);
}

function rolePick(card: CardFace, context: RoundContext): Outcome {
  const sheep = scoringNumber(card.effect, "sheep");
  const shepherd = scoringNumber(card.effect, "shepherd") ?? scoringNumber(card.effect, "shepard");
  const wolf = scoringNumber(card.effect, "wolf");
  const disagreement = scoringNumber(card.effect, "no_agreement");
  if (sheep === null || shepherd === null || wolf === null || disagreement === null) {
    return unresolved("This card does not store the role scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 3) {
    return unresolved("This card needs three active players. No score is written.", context.phone, context.hands);
  }
  const roles = new Map<string, string>();
  for (const actor of context.actors) {
    const move = moveFor(context.moves, actor.id);
    if (!move) {
      return waiting("Waiting for every role.", context.phone, context.hands);
    }
    if (flag(move.payload, "stop")) {
      return done("A player stopped. This card scores 0 for everyone.", context.actors.map((seat) => ({
        participantId: seat.id,
        points: scoringNumber(card.effect, "stop") ?? 0,
        reason: "stop",
      })), context.phone, context.hands);
    }
    const role = text(move.payload, "role").toLowerCase();
    const agreed = flag(move.payload, "agree");
    if (!["sheep", "shepherd", "herder", "wolf"].includes(role) || !agreed) {
      return done(
        "The group did not agree.",
        context.actors.map((seat) => ({ participantId: seat.id, points: disagreement, reason: "no_agreement" })),
        context.phone,
        context.hands,
      );
    }
    roles.set(actor.id, role === "herder" ? "shepherd" : role);
  }
  const pointsFor = (role: string) => (role === "sheep" ? sheep : role === "wolf" ? wolf : shepherd);
  return done(
    "The roles stand.",
    context.actors.map((seat) => ({
      participantId: seat.id,
      points: pointsFor(roles.get(seat.id) ?? "sheep"),
      reason: roles.get(seat.id) ?? "sheep",
    })),
    context.phone,
    context.hands,
  );
}

function secretMark(card: CardFace, context: RoundContext): Outcome {
  const marked = scoringNumber(card.effect, "marked");
  const blocked = scoringNumber(card.effect, "wolf_blocked");
  const protect = scoringNumber(card.effect, "protect_other");
  const open = scoringNumber(card.effect, "wolf_open");
  if (marked === null || blocked === null || protect === null || open === null) {
    return unresolved("This card does not store the mark scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 4) {
    return unresolved("This card needs four active players. No score is written.", context.phone, context.hands);
  }
  const wolf = context.actors[0];
  const sheep = context.actors.slice(1);
  const wolfMove = moveFor(context.moves, wolf.id);
  if (!wolfMove) {
    return waiting("The wolf has not marked a player.", context.phone, context.hands);
  }
  const target = text(wolfMove.payload, "target");
  if (!sheep.some((seat) => seat.id === target)) {
    return waiting("Mark one of the other players.", context.phone, context.hands);
  }
  const protects = new Map<string, string>();
  for (const seat of sheep) {
    const move = moveFor(context.moves, seat.id);
    if (!move) {
      return waiting("Waiting for the sheep.", context.phone, context.hands);
    }
    const choice = text(move.payload, "target");
    if (!sheep.some((person) => person.id === choice)) {
      return waiting("Each sheep protects one sheep.", context.phone, context.hands);
    }
    protects.set(seat.id, choice);
  }
  const protectedByOther = [...protects.entries()].some(([from, choice]) => choice === target && from !== target);
  const deltas: Delta[] = [{ participantId: target, points: marked, reason: "marked" }];
  deltas.push({
    participantId: wolf.id,
    points: protectedByOther ? blocked : open,
    reason: protectedByOther ? "blocked" : "open",
  });
  for (const [from, choice] of protects) {
    if (choice !== from) {
      deltas.push({ participantId: from, points: protect, reason: "protect" });
    }
  }
  return done("The mark is scored.", deltas, context.phone, context.hands);
}

function bluff(card: CardFace, context: RoundContext): Outcome {
  const hit = scoringNumber(card.effect, "hit");
  const miss = scoringNumber(card.effect, "miss");
  if (hit === null || miss === null) {
    return unresolved("This card does not store the choice scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 2) {
    return unresolved("This card needs two active players. No score is written.", context.phone, context.hands);
  }
  const holder = context.actors[0];
  const guesser = context.actors[1];
  const held = moveFor(context.moves, holder.id);
  const guess = moveFor(context.moves, guesser.id);
  if (!held) {
    return waiting("Name two cards and mark one as correct.", context.phone, context.hands);
  }
  const first = text(held.payload, "first");
  const second = text(held.payload, "second");
  const correct = text(held.payload, "correct");
  if (!first || !second || (correct !== first && correct !== second)) {
    return waiting("Mark one of the two named cards.", context.phone, context.hands);
  }
  if (!guess) {
    return waiting("Waiting for the guess.", context.phone, context.hands);
  }
  const pick = text(guess.payload, "choice");
  const matched = pick === correct;
  return done(
    matched ? "The guess matches the marked card." : "The guess does not match the marked card.",
    [
      { participantId: guesser.id, points: matched ? hit : miss, reason: matched ? "hit" : "miss" },
      { participantId: holder.id, points: matched ? miss : hit, reason: matched ? "miss" : "hit" },
    ],
    context.phone,
    context.hands,
  );
}

function trade(card: CardFace, context: RoundContext): Outcome {
  const convinced = scoringNumber(card.effect, "convinced");
  const refused = scoringNumber(card.effect, "not_convinced");
  if (convinced === null || refused === null) {
    return unresolved("This card does not store the trade scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 2) {
    return unresolved("This card needs two active players. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  const partner = context.actors[1];
  const offer = moveFor(context.moves, actor.id);
  if (!offer) {
    return waiting("Choose one card from each hand.", context.phone, context.hands);
  }
  const own = text(offer.payload, "own");
  const theirs = text(offer.payload, "theirs");
  const hands = { ...context.hands, [actor.id]: [...(context.hands[actor.id] ?? [])], [partner.id]: [...(context.hands[partner.id] ?? [])] };
  if (!hands[actor.id]?.includes(own) || !hands[partner.id]?.includes(theirs)) {
    return unresolved("A named card is not in the dealt hand. No score is written.", context.phone, context.hands);
  }
  const reply = moveFor(context.moves, partner.id);
  if (!reply) {
    return waiting("Waiting for the other player to keep or trade.", context.phone, context.hands);
  }
  const swap = text(reply.payload, "choice") === "swap";
  if (swap) {
    hands[actor.id] = hands[actor.id].map((cardId) => (cardId === own ? theirs : cardId));
    hands[partner.id] = hands[partner.id].map((cardId) => (cardId === theirs ? own : cardId));
  }
  return done(
    swap ? "The cards were traded." : "The card was kept.",
    [{ participantId: actor.id, points: swap ? convinced : refused, reason: swap ? "convinced" : "not_convinced" }],
    context.phone,
    hands,
  );
}

function passAround(card: CardFace, context: RoundContext): Outcome {
  const returned = scoringNumber(card.effect, "returned");
  const elsewhere = scoringNumber(card.effect, "elsewhere");
  if (returned === null || elsewhere === null) {
    return unresolved("This card does not store the pass scores. No score is written.", context.phone, context.hands);
  }
  const actor = context.actors[0];
  if (!actor) {
    return unresolved("This card needs an active player. No score is written.", context.phone, context.hands);
  }
  const hands = Object.fromEntries(Object.entries(context.hands).map(([id, cards]) => [id, [...cards]]));
  const opening = moveFor(context.moves, actor.id);
  if (!opening) {
    return waiting("Choose a card from your hand and a player.", context.phone, context.hands);
  }
  const cardId = text(opening.payload, "card");
  let holder = text(opening.payload, "target");
  if (!hands[actor.id]?.includes(cardId) || !holder || holder === actor.id) {
    return waiting("Choose one of your cards and another player.", context.phone, context.hands);
  }
  hands[actor.id] = hands[actor.id].filter((id) => id !== cardId);
  const passes = context.moves.filter((move) => text(move.payload, "pass_to"));
  for (const pass of passes) {
    const next = text(pass.payload, "pass_to");
    if (pass.participantId === holder && next) {
      holder = next;
    }
  }
  const expired = context.deadlineAt !== null && context.now >= context.deadlineAt;
  const stayed = context.moves.some((move) => move.participantId === holder && flag(move.payload, "stay"));
  if (!expired && !stayed) {
    return waiting("The card can still be passed.", context.phone, hands);
  }
  hands[holder] = [...(hands[holder] ?? []), cardId];
  const back = holder === actor.id;
  return done(
    back ? "The card returned." : "The card stopped with someone else.",
    [{ participantId: actor.id, points: back ? returned : elsewhere, reason: back ? "returned" : "elsewhere" }],
    context.phone,
    hands,
  );
}

function forehead(card: CardFace, context: RoundContext): Outcome {
  const right = scoringNumber(card.effect, "right");
  const wrong = scoringNumber(card.effect, "wrong");
  const mislead = scoringNumber(card.effect, "mislead");
  if (right === null || wrong === null || mislead === null) {
    return unresolved("This card does not store the forehead scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 4 || context.actors.some((seat) => !context.forehead[seat.id])) {
    return unresolved("This card needs four forehead cards dealt by the server. No score is written.", context.phone, context.hands);
  }
  const guesses = new Map<string, string>();
  for (const seat of context.actors) {
    const move = moveFor(context.moves, seat.id);
    if (!move || !text(move.payload, "choice")) {
      return waiting("Waiting for every guess.", context.phone, context.hands);
    }
    guesses.set(seat.id, text(move.payload, "choice"));
  }
  const deltas: Delta[] = [];
  for (const seat of context.actors) {
    const matched = guesses.get(seat.id) === context.forehead[seat.id];
    deltas.push({ participantId: seat.id, points: matched ? right : wrong, reason: matched ? "right" : "wrong" });
  }
  for (const move of context.moves) {
    const target = text(move.payload, "recommend_for");
    const recommended = text(move.payload, "recommend");
    if (!target || !recommended || target === move.participantId) {
      continue;
    }
    const followed = guesses.get(target) === recommended;
    const incorrect = recommended !== context.forehead[target];
    if (followed && incorrect) {
      deltas.push({ participantId: move.participantId, points: mislead, reason: "mislead" });
    }
  }
  return done("The forehead cards are scored.", deltas, context.phone, context.hands);
}

function assignedReplay(card: CardFace, context: RoundContext, poolIds: string[]): Outcome {
  const actor = context.actors[0];
  const move = actor ? moveFor(context.moves, actor.id) : undefined;
  if (!actor || !move) {
    return waiting("Assign a published card, or refuse.", context.phone, context.hands);
  }
  if (flag(move.payload, "refuse") || flag(move.payload, "stop")) {
    const target = text(move.payload, "target");
    const deltas = [{ participantId: actor.id, points: scoringNumber(card.effect, "refusal") ?? 0, reason: "refusal" }];
    if (target) {
      deltas.push({ participantId: target, points: 0, reason: "refusal" });
    }
    return done("The assignment was refused. Both score 0 on this card.", deltas, context.phone, context.hands);
  }
  const target = text(move.payload, "target");
  const cardId = text(move.payload, "card");
  if (!target || target === actor.id || !poolIds.includes(cardId)) {
    return waiting("Choose another player and a published card.", context.phone, context.hands);
  }
  const loses = scoringNumber(card.effect, "assigned_loses");
  const wins = scoringNumber(card.effect, "assigned_wins");
  if (loses === null || wins === null) {
    return unresolved("This card does not store the assignment scores. No score is written.", context.phone, context.hands);
  }
  return done("The assigned card is the next draw.", [], context.phone, context.hands, [
    { type: "assigned", assignerId: actor.id, assignedId: target, cardId, loses, wins },
  ]);
}

function fiction(card: CardFace, context: RoundContext): Outcome {
  const wrong = scoringNumber(card.effect, "guess_wrong");
  const right = scoringNumber(card.effect, "guess_right");
  if (wrong === null || right === null) {
    return unresolved("This card does not store the guess scores. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length < 2) {
    return unresolved("This card needs two active players. No score is written.", context.phone, context.hands);
  }
  const teller = context.actors[0];
  const guesser = context.actors[1];
  const told = moveFor(context.moves, teller.id);
  const guess = moveFor(context.moves, guesser.id);
  if (!told || !guess) {
    return waiting("Waiting for the story flag and the guess.", context.phone, context.hands);
  }
  if (flag(told.payload, "pass") || flag(guess.payload, "pass")) {
    return done("A player passed. This card scores 0.", [
      { participantId: teller.id, points: scoringNumber(card.effect, "pass") ?? 0, reason: "pass" },
      { participantId: guesser.id, points: scoringNumber(card.effect, "pass") ?? 0, reason: "pass" },
    ], context.phone, context.hands);
  }
  if (typeof told.payload.weather !== "boolean" || typeof guess.payload.guess !== "boolean") {
    return waiting("Mark whether the story has one weather detail, and guess true or false.", context.phone, context.hands);
  }
  const matched = told.payload.weather === guess.payload.guess;
  return done(
    matched ? "The guess matches the story flag." : "The guess does not match the story flag.",
    [{ participantId: teller.id, points: matched ? right : wrong, reason: matched ? "guess_right" : "guess_wrong" }],
    context.phone,
    context.hands,
  );
}

function teamwork(card: CardFace, context: RoundContext): Outcome {
  const success = scoringNumber(card.effect, "success");
  const miss = scoringNumber(card.effect, "miss") ?? 0;
  if (success === null) {
    return unresolved("This card does not store a success score. No score is written.", context.phone, context.hands);
  }
  if (context.actors.length === 0) {
    return unresolved("This card needs active players. No score is written.", context.phone, context.hands);
  }
  if (context.actors.some((seat) => !moveFor(context.moves, seat.id))) {
    return waiting("Waiting for the group.", context.phone, context.hands);
  }
  const answer = card.secret.answer;
  if (typeof answer === "string" && answer.trim()) {
    const locked = context.actors.map((seat) => text(moveFor(context.moves, seat.id)?.payload ?? {}, "text"));
    const same = locked.every((value) => value === locked[0]);
    const matched = same && answersMatch(locked[0] ?? "", answer);
    return done(
      matched ? "The locked answer matches the card." : "The locked answer does not match the card.",
      context.actors.map((seat) => ({ participantId: seat.id, points: matched ? success : miss, reason: matched ? "match" : "miss" })),
      context.phone,
      context.hands,
    );
  }
  if (typeof card.secret.sample_target === "string") {
    const guesser = context.actors[context.actors.length - 1];
    const given = text(moveFor(context.moves, guesser.id)?.payload ?? {}, "text");
    const matched = answersMatch(given, card.secret.sample_target);
    return done(
      matched ? "The guess matches the card." : "The guess does not match the card.",
      context.actors.map((seat) => ({ participantId: seat.id, points: matched ? success : miss, reason: matched ? "match" : "miss" })),
      context.phone,
      context.hands,
    );
  }
  if (/no secret correct color/i.test(card.prompt)) {
    const colors = context.actors.map((seat) => text(moveFor(context.moves, seat.id)?.payload ?? {}, "choice").toLowerCase());
    const matched = colors.every((color) => color && color === colors[0]);
    return done(
      matched ? "The colors match." : "The colors do not match.",
      context.actors.map((seat) => ({ participantId: seat.id, points: matched ? success : miss, reason: matched ? "match" : "miss" })),
      context.phone,
      context.hands,
    );
  }
  if (/at least three players also picked/i.test(card.prompt)) {
    const picks = context.actors.map((seat) => text(moveFor(context.moves, seat.id)?.payload ?? {}, "choice"));
    const counts = new Map<string, number>();
    for (const pick of picks) {
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    return done(
      "The numbers are scored.",
      context.actors.map((seat, index) => {
        const count = counts.get(picks[index] ?? "") ?? 0;
        return { participantId: seat.id, points: count >= 3 ? success : 0, reason: count >= 3 ? "match" : "miss" };
      }),
      context.phone,
      context.hands,
    );
  }
  return unresolved(
    "The owner has not supplied the figure, sentence, list, path, or labels for this card. No score is written.",
    context.phone,
    context.hands,
  );
}

function physical(card: CardFace, context: RoundContext): Outcome {
  const success = scoringNumber(card.effect, "success");
  const miss = scoringNumber(card.effect, "miss") ?? 0;
  const pass = scoringNumber(card.effect, "pass") ?? 0;
  if (success === null) {
    return unresolved("This card does not store a success score. No score is written.", context.phone, context.hands);
  }
  const prompt = card.prompt;
  const phone = {
    ...context.phone,
    taps: { ...context.phone.taps },
    holdStart: { ...context.phone.holdStart },
    stillStart: { ...context.phone.stillStart },
    stillTapped: { ...context.phone.stillTapped },
  };
  const task =
    /hold a button for 5 seconds/i.test(prompt) ? "hold" :
    /do not tap for 20 seconds/i.test(prompt) ? "still" :
    /tap a target three times/i.test(prompt) ? "taps" :
    /drag 8 tokens/i.test(prompt) ? "tokens" :
    /pass a token in seat order/i.test(prompt) ? "passes" :
    /places one cup/i.test(prompt) ? "cups" :
    "";
  if (!task) {
    return unresolved(
      "The phone task on this card depends on a diagram or sequence that is not stored. No score is written.",
      phone,
      context.hands,
    );
  }
  if (context.actors.length === 0) {
    return unresolved("This card needs an active player. No score is written.", phone, context.hands);
  }
  for (const move of context.moves) {
    if (task === "taps" || task === "tokens") {
      phone.taps[move.participantId] = (phone.taps[move.participantId] ?? 0) + (flag(move.payload, "tap") ? 1 : 0);
    }
    if (task === "hold" && flag(move.payload, "hold_start")) {
      phone.holdStart[move.participantId] = move.at ?? context.now;
    }
    if (task === "still" && flag(move.payload, "still_start") && phone.stillStart[move.participantId] === undefined) {
      phone.stillStart[move.participantId] = move.at ?? context.now;
    }
    if (task === "still" && flag(move.payload, "tap")) {
      phone.stillTapped[move.participantId] = true;
    }
    if (task === "passes" && flag(move.payload, "pass_token")) {
      phone.passes += 1;
    }
    if (task === "cups" && flag(move.payload, "place")) {
      phone.cups += 1;
    }
  }
  const deltas: Delta[] = [];
  for (const seat of context.actors) {
    const move = moveFor(context.moves, seat.id);
    if (move && flag(move.payload, "pass")) {
      deltas.push({ participantId: seat.id, points: pass, reason: "pass" });
      continue;
    }
    if (task === "hold") {
      const end = context.moves.find((item) => item.participantId === seat.id && flag(item.payload, "hold_end"));
      const start = phone.holdStart[seat.id];
      if (!end || start === undefined) {
        return waiting("Hold the button.", phone, context.hands);
      }
      const elapsed = context.now - start;
      deltas.push({ participantId: seat.id, points: elapsed >= 5000 ? success : miss, reason: elapsed >= 5000 ? "success" : "miss" });
    }
    if (task === "still") {
      const start = phone.stillStart[seat.id];
      if (start === undefined) {
        return waiting("Start the still timer.", phone, context.hands);
      }
      if (phone.stillTapped[seat.id]) {
        deltas.push({ participantId: seat.id, points: miss, reason: "miss" });
      } else if (context.now - start >= 20000) {
        deltas.push({ participantId: seat.id, points: success, reason: "success" });
      } else {
        return waiting("Stay still.", phone, context.hands);
      }
    }
    if (task === "taps" || task === "tokens") {
      const need = task === "taps" ? 3 : 8;
      const count = phone.taps[seat.id] ?? 0;
      if (count < need) {
        return waiting(task === "taps" ? "Tap the target." : "Move the tokens.", phone, context.hands);
      }
      deltas.push({ participantId: seat.id, points: success, reason: "success" });
    }
  }
  if (task === "passes") {
    if (phone.passes < 10) {
      return waiting("Pass the token in seat order.", phone, context.hands);
    }
    return done(
      "The passes are complete.",
      context.actors.map((seat) => ({ participantId: seat.id, points: success, reason: "success" })),
      phone,
      context.hands,
    );
  }
  if (task === "cups") {
    if (phone.cups < 6) {
      return waiting("Place the next cup in turn.", phone, context.hands);
    }
    return done(
      "The cups are placed.",
      context.actors.map((seat) => ({ participantId: seat.id, points: success, reason: "success" })),
      phone,
      context.hands,
    );
  }
  return done("The phone task is scored.", deltas, phone, context.hands);
}

export function resolveCard(card: CardFace, context: RoundContext, poolIds: string[] = []): Outcome {
  const kind = kindOf(card);
  if (kind === "puzzle") {
    return puzzle(card, context);
  }
  if (kind === "door_pattern") {
    return door(card, context);
  }
  if (kind === "number_target") {
    return numberTarget(context);
  }
  if (kind === "point_gift") {
    return pointGift(card, context);
  }
  if (kind === "transfer") {
    return transfer(card, context);
  }
  if (kind === "trust") {
    return trust(card, context);
  }
  if (kind === "prediction") {
    return prediction(card, context);
  }
  if (kind === "alliance") {
    return alliance(card, context);
  }
  if (kind === "role_pick") {
    return rolePick(card, context);
  }
  if (kind === "secret_mark") {
    return secretMark(card, context);
  }
  if (kind === "bluff") {
    return bluff(card, context);
  }
  if (kind === "trade") {
    return trade(card, context);
  }
  if (kind === "pass_around") {
    return passAround(card, context);
  }
  if (kind === "forehead") {
    return forehead(card, context);
  }
  if (kind === "assigned_replay") {
    return assignedReplay(card, context, poolIds);
  }
  if (kind === "fiction_guess") {
    return fiction(card, context);
  }
  if (kind === "teamwork") {
    return teamwork(card, context);
  }
  if (kind === "physical_or_phone") {
    return physical(card, context);
  }
  return unresolved("This card has no resolver. No score is written.", context.phone, context.hands);
}

export type PublicPlay = {
  kind: string;
  title: string;
  prompt: string;
  question: string;
  input: string;
  choices: string[];
  privateNote: string;
  message: string;
};

const PUBLIC_EFFECT = ["kind", "player_count", "rounds", "timer_seconds", "scoring", "hints", "question", "physical"] as const;

export function publicEffect(effect: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const key of PUBLIC_EFFECT) {
    if (key in effect) {
      copy[key] = effect[key];
    }
  }
  return copy;
}

export function publicPlay(card: CardFace, youId: string | null, actors: Seat[]): PublicPlay {
  const effect = publicEffect(card.effect);
  const kind = typeof effect.kind === "string" ? effect.kind : "";
  const question = typeof effect.question === "string" ? effect.question : "";
  let input = "text";
  let choices: string[] = [];
  let privateNote = "";
  if (kind === "door_pattern") {
    input = "choice";
    choices = ["north", "east", "south", "west"];
  } else if (kind === "number_target") {
    input = "number";
  } else if (kind === "point_gift" || kind === "transfer" || kind === "trust" || kind === "prediction" || kind === "alliance") {
    input = "player";
  } else if (kind === "role_pick") {
    input = "role";
    choices = ["sheep", "shepherd", "wolf"];
  } else if (kind === "secret_mark") {
    input = "player";
  } else if (kind === "bluff") {
    input = youId === actors[0]?.id ? "bluff" : "choice";
  } else if (kind === "trade") {
    input = youId === actors[0]?.id ? "trade" : "choice";
    choices = ["keep", "swap"];
  } else if (kind === "pass_around") {
    input = "pass";
  } else if (kind === "forehead") {
    input = "choice";
  } else if (kind === "assigned_replay") {
    input = "assign";
  } else if (kind === "fiction_guess") {
    input = youId === actors[0]?.id ? "weather" : "guess";
  } else if (kind === "teamwork" && /no secret correct color/i.test(card.prompt)) {
    input = "choice";
    choices = ["red", "yellow", "green", "blue"];
  } else if (kind === "teamwork" && /at least three players also picked/i.test(card.prompt)) {
    input = "choice";
    choices = ["1", "2", "3", "4", "5"];
  } else if (kind === "physical_or_phone") {
    if (/hold a button/i.test(card.prompt)) input = "hold";
    else if (/do not tap/i.test(card.prompt)) input = "still";
    else if (/tap a target/i.test(card.prompt)) input = "tap";
    else if (/drag 8 tokens/i.test(card.prompt)) input = "tap";
    else if (/pass a token/i.test(card.prompt)) input = "token";
    else if (/places one cup/i.test(card.prompt)) input = "cup";
    else input = "unresolved";
  } else if (kind === "number_target" || kind === "placeholder" || kind === "empty" || kind === "note") {
    input = "unresolved";
  }
  if (typeof card.secret.sample_target === "string" && youId && youId !== actors[actors.length - 1]?.id) {
    privateNote = `Your clue: ${card.secret.sample_target}`;
  }
  if (typeof card.secret.sample === "string" && youId) {
    const parts = card.secret.sample.split(/ on one phone and /i);
    if (parts.length === 2) {
      const index = actors.findIndex((seat) => seat.id === youId);
      privateNote = index === 0 ? parts[0] : index === 1 ? parts[1] : "";
    }
  }
  if (kind === "number_target" || kind === "placeholder" || kind === "empty" || kind === "note") {
    input = "unresolved";
  }
  if (kind === "puzzle" && (typeof card.secret.answer !== "string" || !card.secret.answer.trim())) {
    input = "unresolved";
  }
  if (
    kind === "teamwork" &&
    typeof card.secret.answer !== "string" &&
    typeof card.secret.sample_target !== "string" &&
    !/no secret correct color/i.test(card.prompt) &&
    !/at least three players also picked/i.test(card.prompt)
  ) {
    input = "unresolved";
  }
  return {
    kind,
    title: card.title,
    prompt: card.prompt,
    question,
    input,
    choices,
    privateNote,
    message: "",
  };
}

export function dealHands(cardIds: string[], seatIds: string[], size: number, rng: () => number = Math.random) {
  const hands: Record<string, string[]> = {};
  for (const seatId of seatIds) {
    const bag = [...cardIds];
    const hand: string[] = [];
    while (hand.length < size && bag.length > 0) {
      const index = Math.min(bag.length - 1, Math.floor(rng() * bag.length));
      hand.push(bag.splice(index, 1)[0]);
    }
    hands[seatId] = hand;
  }
  return hands;
}

export function leaksSecret(value: unknown, secret: Record<string, unknown>) {
  const answer = secret.answer;
  if (typeof answer !== "string" || answer.length < 2) {
    return false;
  }
  return JSON.stringify(value).toLowerCase().includes(answer.toLowerCase());
}
