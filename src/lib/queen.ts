import type { GameDefinition, PlayInput, PlayView, PlayerRef, QueenSettings, Runtime } from "./types";

export type QueenCommand = {
  command?: string;
  playerId?: string;
  playerA?: string;
  playerB?: string;
  locationId?: string;
  side?: string;
  mode?: string;
  text?: string;
  ability?: string;
};

type Touch = { playerId: string; locationId: string; side: "left" | "right" };

type Question = {
  prompt: string;
  options: { id: string; label: string }[];
  order: boolean;
  pool: { id: string; label: string }[];
  targets: string[];
  expect: Record<string, string[]>;
};

const ROUND_NAMES = ["The First Touch", "Distraction", "The Order", "The Deception", "The Final Recall"];
const BANKS = [
  ["self"],
  ["side", "self"],
  ["who-first", "who-last", "order-prefix"],
  ["who-first", "other"],
  ["self", "side", "who-last", "same", "other"],
];

const DEFAULTS: QueenSettings = {
  locations: [
    { id: "shoulder", label: "Shoulder" },
    { id: "upper-arm", label: "Upper arm" },
    { id: "forearm", label: "Forearm" },
  ],
  movements: [
    "Raise your left arm.",
    "Raise your right arm.",
    "Turn around once.",
    "Touch your left shoulder.",
    "Touch your right shoulder.",
    "Clap twice.",
    "Switch places with another player.",
    "Take one step to the left.",
    "Take one step to the right.",
  ],
  movementCount: 5,
  questionsPerRound: [1, 2, 2, 2, 3],
  allowedMistakes: 2,
  continueAfterElimination: true,
  memorizeSeconds: 20,
  difficultyLabel: "Extreme",
  abilities: { deception: true, recall: true, exchange: true },
  dialogue: {
    registration: "Your memory is your only defense.",
    start: "Pay attention. Every detail matters. Nothing will be repeated.",
    round2: "Movement creates distraction. Your memory must remain intact.",
    deception: "Are you certain that your memory serves you well?",
    final: "Five rounds. One final test. Remember everything.",
    success: "Your memory has proven sufficient. You have successfully completed the game.",
    failure: "The Queen has prevailed. The challenge has ended.",
  },
};

export function defaultQueenSettings(): QueenSettings {
  return structuredClone(DEFAULTS);
}

export function queenSettings(def: GameDefinition): QueenSettings {
  return cleanQueenSettings(def.queen ?? {});
}

export function cleanQueenSettings(input: unknown): QueenSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const locations = cleanLocations(raw.locations);
  const movements = cleanLines(raw.movements, DEFAULTS.movements, 80);
  const dialogueRaw = raw.dialogue && typeof raw.dialogue === "object" ? (raw.dialogue as Record<string, unknown>) : {};
  const abilitiesRaw = raw.abilities && typeof raw.abilities === "object" ? (raw.abilities as Record<string, unknown>) : {};
  const counts = Array.isArray(raw.questionsPerRound) ? raw.questionsPerRound : DEFAULTS.questionsPerRound;
  return {
    locations,
    movements,
    movementCount: clamp(raw.movementCount, 1, 8, DEFAULTS.movementCount),
    questionsPerRound: [0, 1, 2, 3, 4].map((index) => clamp(counts[index], 1, 5, DEFAULTS.questionsPerRound[index] ?? 1)),
    allowedMistakes: clamp(raw.allowedMistakes, 0, 10, DEFAULTS.allowedMistakes),
    continueAfterElimination: raw.continueAfterElimination !== false,
    memorizeSeconds: clamp(raw.memorizeSeconds, 5, 180, DEFAULTS.memorizeSeconds),
    difficultyLabel: clip(raw.difficultyLabel, 40) || DEFAULTS.difficultyLabel,
    abilities: {
      deception: abilitiesRaw.deception !== false,
      recall: abilitiesRaw.recall !== false,
      exchange: abilitiesRaw.exchange !== false,
    },
    dialogue: {
      registration: clip(dialogueRaw.registration, 240) || DEFAULTS.dialogue.registration,
      start: clip(dialogueRaw.start, 240) || DEFAULTS.dialogue.start,
      round2: clip(dialogueRaw.round2, 240) || DEFAULTS.dialogue.round2,
      deception: clip(dialogueRaw.deception, 240) || DEFAULTS.dialogue.deception,
      final: clip(dialogueRaw.final, 240) || DEFAULTS.dialogue.final,
      success: clip(dialogueRaw.success, 240) || DEFAULTS.dialogue.success,
      failure: clip(dialogueRaw.failure, 240) || DEFAULTS.dialogue.failure,
    },
  };
}

export function initQueen(rt: Runtime, rand: () => number) {
  const active = playing(rt);
  rt.deadline = null;
  rt.extra.step = "assign";
  rt.extra.submissions = {};
  rt.extra.notes = {};
  rt.extra.mistakes = {};
  rt.extra.eliminated = {};
  rt.extra.abilitiesUsed = { deception: false, recall: false, exchange: false };
  rt.extra.deception = "";
  rt.extra.movement = [];
  rt.extra.questionIndex = 0;
  rt.extra.plan = [];
  if (active.length < 2) {
    close(rt, "fail", "The Queen needs challengers.");
    return;
  }
  const queen = active[Math.floor(rand() * active.length)];
  rt.secret.queenId = queen.id;
  rt.secret.sequence = [];
  rt.secret.mode = "touch";
  rt.secret.question = null;
  rt.log.push("A Queen has been chosen.");
}

export function queenCommand(runtime: Runtime, userId: string, owner: boolean, command: QueenCommand, now: number) {
  const rt = structuredClone(runtime);
  if (rt.format !== "queens_touch") return fail(runtime, "This is not the Queen's challenge.");
  if (rt.phase === "complete") return fail(runtime, "This challenge is already over.");
  if (!canRule(rt, userId, owner)) return fail(runtime, "Only the Queen can do that.");
  const error = applyCommand(rt, command, now);
  if (error) return fail(runtime, error);
  return { ok: true as const, runtime: rt };
}

export function queenSubmit(rt: Runtime, player: PlayerRef, payload: { choice?: string; order?: string[] }, now: number): string | null {
  if (rt.phase !== "live") return "This challenge is not accepting answers.";
  if (rt.pausedRemaining !== null) return "The challenge is paused.";
  if (step(rt) !== "question") return "There is no question open.";
  const question = currentQuestion(rt);
  if (!question) return "There is no question open.";
  if (!question.targets.includes(player.id)) return "This question is not yours.";
  const submissions = bag(rt);
  if (submissions[player.id]) return "You already answered this question.";
  if (question.order) {
    const order = payload.order ?? [];
    const expected = new Set(question.pool.map((item) => item.id));
    if (order.length !== question.pool.length || new Set(order).size !== order.length || order.some((id) => !expected.has(id))) {
      return "Place every player once.";
    }
    submissions[player.id] = { order };
  } else {
    const choice = String(payload.choice ?? "");
    if (!question.options.some((option) => option.id === choice)) return "Choose one of the answers.";
    submissions[player.id] = { choice };
  }
  if (question.targets.every((id) => submissions[id])) grade(rt, now);
  return null;
}

export function queenTick(rt: Runtime, now: number) {
  if (rt.phase === "complete" || rt.pausedRemaining !== null) return;
  if (rt.phase === "feedback") {
    if (now >= Number(rt.extra.feedbackUntil ?? 0)) advanceAfterGrade(rt, now);
    return;
  }
  if (rt.deadline === null || now < rt.deadline) return;
  const current = step(rt);
  if (current === "memorize") beginRound(rt, now);
  else if (current === "movement" || current === "deception") beginQuestions(rt, now);
  else if (current === "question") grade(rt, now);
}

export function queenHost(rt: Runtime, type: "skip" | "end", now: number) {
  if (type === "end") {
    closeEarly(rt);
    return;
  }
  if (rt.phase === "feedback") advanceAfterGrade(rt, now);
  else if (step(rt) === "question") grade(rt, now);
  else if (step(rt) === "memorize") beginRound(rt, now);
  else if (step(rt) === "movement" || step(rt) === "deception") beginQuestions(rt, now);
}

export function queenView(rt: Runtime, userId: string | null, isHost: boolean, now: number, revealQueen: boolean): PlayView {
  const settings = queenSettings(rt.config);
  const queenId = String(rt.secret.queenId ?? "");
  const ruler = revealQueen && (userId === queenId || isHost);
  const youAreQueen = revealQueen && userId === queenId;
  const active = playing(rt);
  const submissions = bag(rt);
  const question = currentQuestion(rt);
  const required = question?.targets ?? [];
  const paused = rt.pausedRemaining !== null;
  const notes = (rt.extra.notes as Record<string, string>) ?? {};
  const roundName = ROUND_NAMES[Math.min(rt.round, ROUND_NAMES.length - 1)] ?? "The Queen";
  const board: Record<string, unknown> = {
    game: "queens_touch",
    role: ruler ? "queen" : "challenger",
    youAreQueen,
    step: step(rt),
    roundName,
    deception: String(rt.extra.deception ?? ""),
    movement: step(rt) === "movement" ? (rt.extra.movement as string[]) ?? [] : [],
    mark: revealQueen ? privateMark(rt, userId) : "",
    answered: required.filter((id) => submissions[id]).length,
    needed: required.length,
  };
  if (ruler) {
    const sequence = (rt.secret.sequence as Touch[]) ?? [];
    board.mode = String(rt.secret.mode ?? "touch");
    board.locations = settings.locations;
    board.challengers = challengers(rt).map((player) => ({
      id: player.id,
      name: player.username,
      assigned: sequence.some((touch) => touch.playerId === player.id),
    }));
    board.sequence = sequence.map((touch, index) => ({
      order: index + 1,
      name: active.find((player) => player.id === touch.playerId)?.username ?? "Player",
      place: placeLabel(settings, touch),
    }));
    board.abilities = {
      deception: abilityState(rt, "deception"),
      recall: abilityState(rt, "recall"),
      exchange: abilityState(rt, "exchange"),
    };
    board.answers = required.map((id) => ({
      name: active.find((player) => player.id === id)?.username ?? "Player",
      text: answerText(settings, question, submissions[id]),
      note: notes[id] ?? "",
    }));
    board.scores = challengers(rt).map((player) => ({
      name: player.username,
      score: rt.scores[player.id] ?? 0,
      mistakes: Number(((rt.extra.mistakes as Record<string, number>) ?? {})[player.id] ?? 0),
    }));
  }
  const prompt = ruler ? queenPrompt(rt, roundName) : challengerPrompt(rt, userId, roundName);
  const input = ruler ? ({ kind: "wait", message: "The sequence stays on this phone." } as PlayInput) : challengerInput(rt, userId);
  return {
    format: rt.format,
    round: rt.round + 1,
    rounds: rt.rounds,
    phase: rt.phase,
    deadline: paused ? now + Number(rt.pausedRemaining ?? 0) : rt.deadline,
    paused,
    prompt,
    subprompt: youAreQueen ? "You are the Queen of Spades." : step(rt) === "assign" ? "A Queen has been chosen." : roundName,
    input,
    submitted: Boolean(userId && submissions[userId]),
    feedback: rt.phase === "feedback" ? notes[userId ?? ""] || rt.feedback : rt.feedback,
    progress: required.map((id) => ({
      id,
      name: active.find((player) => player.id === id)?.username ?? "Player",
      done: Boolean(submissions[id]) || rt.phase !== "live",
    })),
    hint: null,
    revealed: null,
    board,
    yourScore: userId ? rt.scores[userId] ?? 0 : 0,
    hostPanel: null,
  };
}

function applyCommand(rt: Runtime, command: QueenCommand, now: number): string | null {
  const name = String(command.command ?? "");
  if (rt.pausedRemaining !== null && name !== "resume" && name !== "end") return "The challenge is paused.";
  if (name === "mode") return setMode(rt, String(command.mode ?? ""));
  if (name === "assign") return assign(rt, command);
  if (name === "undo") return undo(rt);
  if (name === "lock") return lockSequence(rt, now);
  if (name === "begin" || name === "next") return advance(rt, now);
  if (name === "movement") return startMovement(rt, now);
  if (name === "ability") return ability(rt, command, now);
  if (name === "pause") {
    if (rt.deadline !== null) rt.pausedRemaining = Math.max(0, rt.deadline - now);
    rt.deadline = null;
    say(rt, "PAUSED", "THE CLOCK IS HELD", "Nothing is due while the room is paused.");
    return null;
  }
  if (name === "resume") {
    const remaining = Number(rt.pausedRemaining ?? 0);
    rt.pausedRemaining = null;
    if (remaining > 0) rt.deadline = now + remaining;
    say(rt, "RESUMED", "THE CLOCK RETURNS", "Continue.");
    return null;
  }
  if (name === "end") {
    closeEarly(rt);
    return null;
  }
  return "Unknown Queen control.";
}

function setMode(rt: Runtime, mode: string): string | null {
  if (step(rt) !== "assign") return "The manner of the touch is already set.";
  if (!["touch", "shown", "digital"].includes(mode)) return "Choose a touch, a shown place, or a digital mark.";
  rt.secret.mode = mode;
  return null;
}

function assign(rt: Runtime, command: QueenCommand): string | null {
  if (step(rt) !== "assign") return "The sequence is already locked.";
  const settings = queenSettings(rt.config);
  const playerId = String(command.playerId ?? "");
  const locationId = String(command.locationId ?? "");
  const side = command.side === "right" ? "right" : command.side === "left" ? "left" : "";
  if (!challengers(rt).some((player) => player.id === playerId)) return "Choose a challenger.";
  if (!settings.locations.some((location) => location.id === locationId)) return "Choose a place.";
  if (!side) return "Choose left or right.";
  const sequence = (rt.secret.sequence as Touch[]) ?? [];
  if (sequence.some((touch) => touch.playerId === playerId)) return "That player already has a place. Undo to change the order.";
  sequence.push({ playerId, locationId, side });
  rt.secret.sequence = sequence;
  return null;
}

function undo(rt: Runtime): string | null {
  if (step(rt) !== "assign") return "The sequence is already locked.";
  const sequence = (rt.secret.sequence as Touch[]) ?? [];
  sequence.pop();
  rt.secret.sequence = sequence;
  return null;
}

function lockSequence(rt: Runtime, now: number): string | null {
  if (step(rt) !== "assign") return "The sequence is already locked.";
  const sequence = (rt.secret.sequence as Touch[]) ?? [];
  const needed = challengers(rt);
  if (sequence.length !== needed.length || needed.some((player) => !sequence.some((touch) => touch.playerId === player.id))) {
    return "Give every challenger a place. The order you record is the order of the touch.";
  }
  const settings = queenSettings(rt.config);
  rt.extra.step = "memorize";
  rt.startedAt = now;
  rt.deadline = now + settings.memorizeSeconds * 1000;
  say(rt, "GAME START", "THE QUEEN'S TOUCH", settings.dialogue.start);
  return null;
}

function advance(rt: Runtime, now: number): string | null {
  if (rt.phase === "feedback") {
    advanceAfterGrade(rt, now);
    return null;
  }
  const current = step(rt);
  if (current === "memorize") {
    beginRound(rt, now);
    return null;
  }
  if (current === "movement" || current === "deception") {
    beginQuestions(rt, now);
    return null;
  }
  if (current === "assign") return "Lock the sequence first.";
  return "The question is still open.";
}

function startMovement(rt: Runtime, now: number): string | null {
  if (step(rt) === "question" || step(rt) === "assign") return "Finish what is open before a movement.";
  openMovement(rt, now, false);
  return null;
}

function ability(rt: Runtime, command: QueenCommand, now: number): string | null {
  const name = String(command.ability ?? "");
  if (!["deception", "recall", "exchange"].includes(name)) return "Choose an ability.";
  const settings = queenSettings(rt.config);
  if (!settings.abilities[name as "deception" | "recall" | "exchange"]) return "That ability is turned off.";
  const used = (rt.extra.abilitiesUsed as Record<string, boolean>) ?? {};
  if (used[name]) return "That ability has already been used.";
  if (step(rt) === "assign" || step(rt) === "question" || rt.phase === "feedback") return "Wait until this beat closes.";
  if (name === "deception") {
    const text = clip(command.text, 240);
    if (!text) return "Write the misleading announcement.";
    used.deception = true;
    rt.extra.abilitiesUsed = used;
    rt.extra.deception = text;
    say(rt, "THE DECEPTION", "THE QUEEN SPEAKS", text);
    return null;
  }
  if (name === "recall") {
    used.recall = true;
    rt.extra.abilitiesUsed = used;
    rt.extra.abilityInsert = "order-all";
    openSpecial(rt, now, "order-all");
    say(rt, "THE RECALL", "THE ORDER", "The Queen asks for the order of the touch.");
    return null;
  }
  const a = String(command.playerA ?? "");
  const b = String(command.playerB ?? "");
  if (a === b || !challengers(rt).some((player) => player.id === a) || !challengers(rt).some((player) => player.id === b)) {
    return "Choose two challengers.";
  }
  used.exchange = true;
  rt.extra.abilitiesUsed = used;
  rt.extra.exchangePair = [a, b];
  openSpecial(rt, now, "exchange");
  say(rt, "THE EXCHANGE", "TRADE THE MEMORY", "Name the place given to the other player.");
  return null;
}

function beginRound(rt: Runtime, now: number) {
  rt.round = 0;
  rt.extra.deception = "";
  beginQuestions(rt, now);
}

function beginQuestions(rt: Runtime, now: number) {
  const settings = queenSettings(rt.config);
  const bank = BANKS[Math.min(rt.round, BANKS.length - 1)] ?? BANKS[0];
  const count = settings.questionsPerRound[rt.round] ?? 1;
  rt.extra.plan = bank.slice(0, Math.max(1, Math.min(bank.length, count)));
  rt.extra.questionIndex = 0;
  rt.extra.movement = [];
  if (rt.round === 1) say(rt, "ROUND 2", "DISTRACTION", settings.dialogue.round2);
  if (rt.round === 4) say(rt, "FINAL ROUND", "THE FINAL RECALL", settings.dialogue.final);
  openIndexed(rt, now);
}

function openIndexed(rt: Runtime, now: number) {
  const plan = (rt.extra.plan as string[]) ?? [];
  const index = Number(rt.extra.questionIndex ?? 0);
  const kind = plan[index];
  if (!kind) {
    afterRound(rt, now);
    return;
  }
  rt.extra.questionSource = "plan";
  rt.secret.question = makeQuestion(rt, kind);
  armQuestion(rt, now);
}

function openSpecial(rt: Runtime, now: number, kind: string) {
  rt.extra.questionSource = "ability";
  rt.secret.question = makeQuestion(rt, kind);
  armQuestion(rt, now);
}

function armQuestion(rt: Runtime, now: number) {
  rt.phase = "live";
  rt.extra.step = "question";
  rt.extra.submissions = {};
  rt.extra.notes = {};
  rt.feedback = null;
  rt.startedAt = now;
  const timer = Math.max(5, Number(rt.config.timerSeconds ?? 30));
  rt.deadline = now + timer * 1000;
  const question = currentQuestion(rt);
  if (question) say(rt, ROUND_NAMES[Math.min(rt.round, ROUND_NAMES.length - 1)] ?? "THE QUEEN", `ROUND ${rt.round + 1}`, question.prompt);
}

function grade(rt: Runtime, now: number) {
  const question = currentQuestion(rt);
  if (!question) return;
  const settings = queenSettings(rt.config);
  const submissions = bag(rt);
  const notes: Record<string, string> = {};
  const mistakes = (rt.extra.mistakes as Record<string, number>) ?? {};
  const eliminated = (rt.extra.eliminated as Record<string, boolean>) ?? {};
  const win = number(rt.config.successPoints, 5);
  const lose = number(rt.config.failPoints, -2);
  for (const id of question.targets) {
    const payload = submissions[id];
    const ok = payload ? matches(question, id, payload) : false;
    rt.scores[id] = (rt.scores[id] ?? 0) + (ok ? win : lose);
    mistakes[id] = (mistakes[id] ?? 0) + (ok ? 0 : 1);
    if (!ok && mistakes[id] > settings.allowedMistakes) {
      eliminated[id] = true;
      notes[id] = settings.continueAfterElimination
        ? "Not this time. The phone has marked you out, and you may keep answering."
        : "Not this time. The phone has marked you out. Stay in the room.";
    } else notes[id] = ok ? "Correct." : payload ? "Not this time." : "No answer in time.";
  }
  rt.extra.mistakes = mistakes;
  rt.extra.eliminated = eliminated;
  rt.extra.notes = notes;
  rt.phase = "feedback";
  rt.extra.step = "feedback";
  rt.extra.feedbackUntil = now + 2500;
  rt.deadline = null;
  rt.feedback = "Answers are locked.";
}

function advanceAfterGrade(rt: Runtime, now: number) {
  rt.phase = "live";
  rt.feedback = null;
  if (rt.extra.questionSource === "ability") {
    rt.extra.questionSource = "plan";
    beginQuestions(rt, now);
    return;
  }
  rt.extra.questionIndex = Number(rt.extra.questionIndex ?? 0) + 1;
  openIndexed(rt, now);
}

function afterRound(rt: Runtime, now: number) {
  if (rt.round >= rt.rounds - 1) {
    closeQueen(rt, false);
    return;
  }
  rt.round += 1;
  rt.secret.question = null;
  if (rt.round === 3) openDeception(rt);
  else openMovement(rt, now, true);
}

function openDeception(rt: Runtime) {
  const settings = queenSettings(rt.config);
  rt.extra.step = "deception";
  rt.extra.movement = [];
  rt.deadline = null;
  if (!rt.extra.deception) rt.extra.deception = settings.dialogue.deception;
  say(rt, "THE DECEPTION", "THE QUEEN SPEAKS", String(rt.extra.deception));
}

function openMovement(rt: Runtime, now: number, announceRound: boolean) {
  const settings = queenSettings(rt.config);
  const count = Math.min(settings.movementCount, settings.movements.length);
  const rand = hashSeed(`${rt.startedAt}:${rt.round}:move`);
  const pool = [...settings.movements];
  const chosen: string[] = [];
  while (chosen.length < count && pool.length) {
    const index = Math.floor(rand() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  rt.extra.step = "movement";
  rt.extra.movement = chosen;
  rt.deadline = now + Math.max(1, chosen.length) * 4000;
  if (announceRound && rt.round === 1) say(rt, "ROUND 2", "DISTRACTION", settings.dialogue.round2);
  else if (announceRound) say(rt, `ROUND ${rt.round + 1}`, ROUND_NAMES[rt.round] ?? "MOVEMENT", "Follow only what is comfortable. Your memory must remain intact.");
}

function closeQueen(rt: Runtime, early: boolean) {
  const settings = queenSettings(rt.config);
  const queenId = String(rt.secret.queenId ?? "");
  const mistakes = (rt.extra.mistakes as Record<string, number>) ?? {};
  const eliminated = (rt.extra.eliminated as Record<string, boolean>) ?? {};
  for (const player of challengers(rt)) {
    const ok = !early && eliminated[player.id] !== true && (mistakes[player.id] ?? 0) <= settings.allowedMistakes;
    rt.success[player.id] = ok;
    rt.scores[player.id] = rt.scores[player.id] ?? 0;
    rt.reasons[player.id] = ok ? "Your memory held." : early ? "The Queen closed the challenge." : "The Queen prevailed.";
  }
  if (queenId) {
    rt.success[queenId] = false;
    rt.scores[queenId] = rt.scores[queenId] ?? 0;
    rt.reasons[queenId] = "You were the Queen.";
  }
  const people = challengers(rt);
  const wins = people.filter((player) => rt.success[player.id]).length;
  const tone = people.length > 0 && wins === people.length ? "success" : wins === 0 ? "fail" : "mixed";
  const summary = tone === "fail" || early ? settings.dialogue.failure : tone === "mixed" ? `${settings.dialogue.success} Some memories did not hold.` : settings.dialogue.success;
  close(rt, tone, summary);
  say(rt, tone === "success" ? "SUCCESS" : "GAME OVER", "THE QUEEN'S TOUCH", summary);
}

function closeEarly(rt: Runtime) {
  closeQueen(rt, true);
}

function makeQuestion(rt: Runtime, kind: string): Question {
  const settings = queenSettings(rt.config);
  const sequence = (rt.secret.sequence as Touch[]) ?? [];
  const people = challengers(rt).filter((player) => eligible(rt, player.id) || kind === "exchange");
  const marks = settings.locations.flatMap((location) =>
    (["left", "right"] as const).map((side) => ({ id: `${location.id}:${side}`, label: `${side === "left" ? "Left" : "Right"} ${location.label.toLowerCase()}` })),
  );
  const names = people.map((player) => ({ id: player.id, label: player.username }));
  const targets = kind === "exchange" ? exchangeTargets(rt) : people.filter((player) => eligible(rt, player.id)).map((player) => player.id);
  const expect: Record<string, string[]> = {};
  let prompt = "Remember.";
  let options = marks;
  let order = false;
  let pool = names;
  if (kind === "self") {
    prompt = "Where did the Queen mark you?";
    for (const id of targets) expect[id] = [markOf(sequence, id)];
  } else if (kind === "side") {
    prompt = "Was it your left or your right side?";
    options = [
      { id: "left", label: "Left" },
      { id: "right", label: "Right" },
    ];
    for (const id of targets) expect[id] = [sequence.find((touch) => touch.playerId === id)?.side ?? ""];
  } else if (kind === "who-first" || kind === "who-last") {
    const touch = kind === "who-first" ? sequence[0] : sequence[sequence.length - 1];
    prompt = kind === "who-first" ? "Who was marked first?" : "Who was marked last?";
    options = challengers(rt).map((player) => ({ id: player.id, label: player.username }));
    for (const id of targets) expect[id] = [touch?.playerId ?? ""];
  } else if (kind === "order-prefix" || kind === "order-all") {
    const take = kind === "order-all" ? sequence : sequence.slice(0, Math.min(3, sequence.length));
    prompt = kind === "order-all" ? "Put the whole order of the touch." : "Put the first players in the order of the touch.";
    order = true;
    options = [];
    pool = take.map((touch) => ({ id: touch.playerId, label: nameOf(rt, touch.playerId) }));
    const ids = take.map((touch) => touch.playerId);
    for (const id of targets) expect[id] = ids;
  } else if (kind === "other") {
    const target = sequence[rt.round % Math.max(1, sequence.length)];
    prompt = `Where was ${nameOf(rt, target?.playerId ?? "")} marked?`;
    for (const id of targets) expect[id] = [markOf(sequence, target?.playerId ?? "")];
  } else if (kind === "same") {
    prompt = "Who was marked in the same place as you?";
    options = [...challengers(rt).map((player) => ({ id: player.id, label: player.username })), { id: "none", label: "No one" }];
    for (const id of targets) {
      const mine = markOf(sequence, id);
      const shares = sequence.filter((touch) => touch.playerId !== id && markOf(sequence, touch.playerId) === mine).map((touch) => touch.playerId);
      expect[id] = shares.length ? shares : ["none"];
    }
  } else if (kind === "exchange") {
    prompt = "Where was the other player marked?";
    const [a, b] = exchangeTargets(rt);
    expect[a] = [markOf(sequence, b)];
    expect[b] = [markOf(sequence, a)];
  }
  const rand = hashSeed(`${kind}:${rt.round}:${prompt}`);
  return { prompt, options: order ? [] : shuffle(options, rand), order, pool: order ? shuffle(pool, rand) : pool, targets, expect };
}

function challengerPrompt(rt: Runtime, userId: string | null, roundName: string) {
  if (rt.phase === "complete") return rt.summary || "The challenge is over.";
  if (userId && (rt.extra.eliminated as Record<string, boolean> | undefined)?.[userId] && !queenSettings(rt.config).continueAfterElimination && step(rt) === "question") {
    return "The phone has marked you out. This is only the score. Stay in the room.";
  }
  if (step(rt) === "assign") return "A Queen has been chosen. Wait for the touch.";
  if (step(rt) === "memorize") return queenSettings(rt.config).dialogue.start;
  if (step(rt) === "movement") return "Follow the screen only if you want. Keep the touch in mind.";
  if (step(rt) === "deception") return String(rt.extra.deception || queenSettings(rt.config).dialogue.deception);
  if (step(rt) === "question") return currentQuestion(rt)?.prompt || roundName;
  return rt.feedback || roundName;
}

function queenPrompt(rt: Runtime, roundName: string) {
  if (step(rt) === "assign") return "Record each place, in the order of the touch.";
  if (step(rt) === "memorize") return "The sequence is locked. Begin when the room is ready.";
  if (step(rt) === "movement") return "The screen is distracting them. Open the question when you are ready.";
  if (step(rt) === "deception") return "The announcement is live. Open the question when you are ready.";
  if (step(rt) === "question") return currentQuestion(rt)?.prompt || roundName;
  return rt.summary || roundName;
}

function challengerInput(rt: Runtime, userId: string | null): PlayInput {
  const question = currentQuestion(rt);
  if (step(rt) !== "question" || rt.phase !== "live" || !question || !userId || !question.targets.includes(userId)) {
    return { kind: "wait", message: step(rt) === "movement" ? "Watch the screen." : "Watch the Queen." };
  }
  if ((rt.extra.eliminated as Record<string, boolean> | undefined)?.[userId] && !queenSettings(rt.config).continueAfterElimination) {
    return { kind: "wait", message: "You are out of the score. Stay in the room." };
  }
  if (question.order) return { kind: "order", pool: question.pool };
  return { kind: "choice", options: question.options };
}

function privateMark(rt: Runtime, userId: string | null) {
  if (!userId || step(rt) !== "memorize") return "";
  const mode = String(rt.secret.mode ?? "touch");
  if (mode === "touch") return "";
  const touch = ((rt.secret.sequence as Touch[]) ?? []).find((item) => item.playerId === userId);
  if (!touch) return "";
  return placeLabel(queenSettings(rt.config), touch);
}

function placeLabel(settings: QueenSettings, touch: Touch) {
  const label = settings.locations.find((location) => location.id === touch.locationId)?.label ?? touch.locationId;
  return `${touch.side === "left" ? "Left" : "Right"} ${label.toLowerCase()}`;
}

function markOf(sequence: Touch[], playerId: string) {
  const touch = sequence.find((item) => item.playerId === playerId);
  return touch ? `${touch.locationId}:${touch.side}` : "";
}

function answerText(settings: QueenSettings, question: Question | null, payload: { choice?: string; order?: string[] } | undefined) {
  if (!payload) return "";
  if (payload.order?.length) return payload.order.join(" · ");
  const choice = String(payload.choice ?? "");
  const location = settings.locations.find((item) => choice.startsWith(`${item.id}:`));
  if (location && (choice.endsWith(":left") || choice.endsWith(":right"))) {
    return `${choice.endsWith(":left") ? "Left" : "Right"} ${location.label.toLowerCase()}`;
  }
  return question?.options.find((option) => option.id === choice)?.label ?? choice;
}

function matches(question: Question, userId: string, payload: { choice?: string; order?: string[] }) {
  const expect = question.expect[userId] ?? [];
  if (question.order) return (payload.order ?? []).join(",") === expect.join(",");
  return expect.includes(String(payload.choice ?? ""));
}

function exchangeTargets(rt: Runtime) {
  const pair = (rt.extra.exchangePair as string[]) ?? [];
  return [pair[0] ?? "", pair[1] ?? ""];
}

function eligible(rt: Runtime, id: string) {
  if ((rt.extra.eliminated as Record<string, boolean> | undefined)?.[id] && !queenSettings(rt.config).continueAfterElimination) return false;
  return id !== String(rt.secret.queenId ?? "");
}

function canRule(rt: Runtime, userId: string, owner: boolean) {
  return owner || userId === String(rt.secret.queenId ?? "");
}

function abilityState(rt: Runtime, name: "deception" | "recall" | "exchange") {
  const settings = queenSettings(rt.config);
  if (!settings.abilities[name]) return "off";
  return (rt.extra.abilitiesUsed as Record<string, boolean> | undefined)?.[name] ? "used" : "ready";
}

function say(rt: Runtime, kicker: string, title: string, body: string) {
  rt.extra.banner = { kicker, title, body };
}

function close(rt: Runtime, tone: "success" | "fail" | "mixed", summary: string) {
  rt.phase = "complete";
  rt.completeTone = tone;
  rt.summary = summary;
  rt.deadline = null;
  rt.feedback = summary;
  rt.extra.step = "results";
}

function currentQuestion(rt: Runtime) {
  return (rt.secret.question as Question | null) ?? null;
}

function step(rt: Runtime) {
  return String(rt.extra.step ?? "assign");
}

function bag(rt: Runtime) {
  const submissions = (rt.extra.submissions as Record<string, { choice?: string; order?: string[] }>) ?? {};
  rt.extra.submissions = submissions;
  return submissions;
}

function playing(rt: Runtime) {
  return rt.players.filter((player) => player.playing);
}

function challengers(rt: Runtime) {
  const queenId = String(rt.secret.queenId ?? "");
  return playing(rt).filter((player) => player.id !== queenId);
}

function nameOf(rt: Runtime, id: string) {
  return playing(rt).find((player) => player.id === id)?.username ?? "A player";
}

function hashSeed(seed: string) {
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

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanLines(value: unknown, fallback: string[], max: number) {
  if (!Array.isArray(value)) return [...fallback];
  const lines = value.map((line) => clip(line, 120)).filter(Boolean).slice(0, max);
  return lines.length ? lines : [...fallback];
}

function cleanLocations(value: unknown) {
  if (!Array.isArray(value)) return DEFAULTS.locations.map((location) => ({ ...location }));
  const locations = value
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const label = clip(row.label, 40);
      const id = clip(row.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      return label && id ? { id, label } : null;
    })
    .filter((item): item is { id: string; label: string } => Boolean(item))
    .slice(0, 8);
  const unique = new Map(locations.map((location) => [location.id, location]));
  return unique.size >= 2 ? [...unique.values()] : DEFAULTS.locations.map((location) => ({ ...location }));
}

function fail(runtime: Runtime, error: string) {
  return { ok: false as const, error, runtime };
}
