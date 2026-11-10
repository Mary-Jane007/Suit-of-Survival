import { answerMatches } from "./answers";
import type { EquationAbility, EquationRound, EquationSettings, EquationVariant, PlayView, PlayerRef, Runtime } from "./types";

type Attempt = {
  text: string;
  parts: string[];
  puzzles: string[];
  code: string;
  explanation: string;
  tries: number;
  locked: boolean;
};

type Verdict = { correct: boolean; explainCorrect: boolean; puzzles: boolean[] };

const FEEDBACK_MS = 15000;

export function defaultEquationSettings(): EquationSettings {
  return {
    completionBonus: 15,
    allowedMistakes: 6,
    eliminate: false,
    correction: false,
    winMode: "highest",
    minimumScore: 40,
    abilities: [
      {
        id: "variable",
        name: "The Variable Has Changed",
        announcement: "You believe you understand the problem. But one condition has been altered. Reconsider your calculations.",
        enabled: true,
      },
    ],
    dialogue: {
      registration: "Three to eight players. Everyone receives the same equations. Your phone keeps your answer private.",
      intro: "WELCOME TO THE PERFECT EQUATION. Numbers do not lie. But your interpretation of them might.",
      round5: "THE CODE. You have found the pieces. Now prove that you understand how they fit together.",
      ability: "ONE VARIABLE HAS CHANGED. Your previous calculations may no longer be correct. Reconsider your assumptions.",
      final: "THE FINAL EQUATION. Six challenges. One final answer. Every decision has brought you here.",
      success: "CALCULATION COMPLETE. The answer was always there. Only those who understood the pattern could find it.",
      failure: "YOUR CALCULATIONS WERE INSUFFICIENT. The challenge has ended.",
    },
    rounds: [
      round({
        id: "sequence",
        name: "The Sequence",
        difficulty: "Moderate",
        seconds: 90,
        prompt: "2 – 6 – 12 – 20 – 30 – ?\n\nWhat number comes next?",
        accepted: ["42", "forty two", "forty-two"],
        explanation: "The gaps are 4, 6, 8, 10 and then 12. 30 + 12 = 42. The same list is 1×2, 2×3, 3×4, 4×5, 5×6 and 6×7.",
        kind: "number",
        variant: variant({
          condition: "New condition: the next gap is 14, not 12.",
          accepted: ["44", "forty four", "forty-four"],
          explanation: "The new gap is 14. 30 + 14 = 44.",
        }),
      }),
      round({
        id: "false-equation",
        name: "The False Equation",
        difficulty: "Difficult",
        seconds: 150,
        askExplanation: true,
        prompt: "Rule: the right side is twice the sum of the digits on the left. Which equation follows the rule?",
        kind: "choice",
        options: [
          { id: "a", label: "48 = 24" },
          { id: "b", label: "39 = 20" },
          { id: "c", label: "57 = 26" },
        ],
        accepted: ["a", "48 = 24", "48=24"],
        explainAccepted: ["sum of the digits", "twice the sum", "4 + 8", "4+8", "double the sum"],
        explanation: "4 + 8 = 12, and 12 × 2 = 24. 39 and 57 do not follow the rule.",
        variant: variant({
          condition: "New condition: the right side is the sum of the digits, plus 8.",
          accepted: ["b", "39 = 20", "39=20"],
          explainAccepted: ["plus 8", "sum of the digits", "3 + 9", "3+9"],
          explanation: "3 + 9 = 12, and 12 + 8 = 20. Only 39 = 20 follows the new rule.",
        }),
      }),
      round({
        id: "missing-variable",
        name: "The Missing Variable",
        difficulty: "Difficult",
        seconds: 180,
        kind: "parts",
        prompt: "Solve the chain. Each value is used on the next line.\nA + 5 = 12\nA × B = 14\nB + C = A\nThen give A + B + C.",
        parts: [
          { prompt: "A", accepted: ["7"] },
          { prompt: "B", accepted: ["2"] },
          { prompt: "C", accepted: ["5"] },
          { prompt: "A + B + C", accepted: ["14"] },
        ],
        explanation: "A = 7. B = 2. C = 5. The sum is 14.",
        variant: variant({
          condition: "New condition: the last line is A × B × C, not the sum.",
          parts: [[], [], [], ["70"]],
          explanation: "A, B and C stay 7, 2 and 5. Their product is 70.",
        }),
      }),
      round({
        id: "impossible-choice",
        name: "The Impossible Choice",
        difficulty: "Very difficult",
        seconds: 180,
        askExplanation: true,
        kind: "choice",
        prompt: "Exactly one statement is true.\n1. Exactly one statement is false.\n2. Exactly two statements are false.\n3. Exactly three statements are false.\n4. Exactly four statements are false.\n5. Exactly five statements are false.\n\nWhich statement is true?",
        options: [
          { id: "1", label: "Statement 1" },
          { id: "2", label: "Statement 2" },
          { id: "3", label: "Statement 3" },
          { id: "4", label: "Statement 4" },
          { id: "5", label: "Statement 5" },
        ],
        accepted: ["4", "statement 4", "exactly four"],
        explainAccepted: ["exactly four", "four are false", "the other four"],
        explanation: "If statement 4 is true, the other four are false. That is exactly four false statements. Every other statement disagrees with that count.",
        variant: variant({
          condition: "New condition: count how many statements are true, not how many are false.",
          accepted: ["1", "statement 1", "exactly one"],
          explainAccepted: ["exactly one", "only one is true", "one statement is true"],
          explanation: "The statements now disagree about how many are true. Only “exactly one is true” can stand on its own.",
        }),
      }),
      round({
        id: "code",
        name: "The Code",
        difficulty: "Extreme",
        seconds: 240,
        kind: "code",
        prompt: "Three puzzles build a four-digit code. The first answer is the first digit. The second answer's two digits are the middle. The third answer is the last digit.",
        puzzles: [
          { prompt: "15 − 8 = ?", accepted: ["7"], reveal: "7" },
          { prompt: "4 × 6 = ?", accepted: ["24"], reveal: "24" },
          { prompt: "9 ÷ 3 = ?", accepted: ["3"], reveal: "3" },
        ],
        code: "7243",
        accepted: ["7243", "7 2 4 3"],
        explanation: "7, then 24, then 3. The code is 7243.",
        variant: variant({
          condition: "New condition: the third puzzle is now 12 ÷ 3.",
          puzzles: [
            { prompt: "15 − 8 = ?", accepted: ["7"], reveal: "7" },
            { prompt: "4 × 6 = ?", accepted: ["24"], reveal: "24" },
            { prompt: "12 ÷ 3 = ?", accepted: ["4"], reveal: "4" },
          ],
          code: "7244",
          accepted: ["7244", "7 2 4 4"],
          explanation: "The last digit is now 4. The code is 7244.",
        }),
      }),
      round({
        id: "final",
        name: "The Perfect Equation",
        difficulty: "Extreme",
        seconds: 240,
        askExplanation: true,
        kind: "number",
        prompt: "Clue A. 5, 8, 14, 23, 35, ? Call this number N.\nClue B. How many of these are true? N is prime. N is divisible by 5. N is odd. Call this count M.\nClue C. The final answer is N ÷ 5 − M × 3 + 4.",
        accepted: ["11"],
        explainAccepted: ["35 + 15", "50", "only one", "divisible by 5"],
        explanation: "The gaps grow by 3, so 35 + 15 = 50. Only “divisible by 5” is true, so M = 1. 50 ÷ 5 − 3 + 4 = 11.",
        variant: variant({
          condition: "New condition: Clue C now ends with + 6, not + 4.",
          accepted: ["13"],
          explainAccepted: ["plus 6", "+ 6", "50"],
          explanation: "N is still 50 and M is still 1. 50 ÷ 5 − 3 + 6 = 13.",
        }),
      }),
    ],
  };
}

export function equationSettings(definition: { equation?: EquationSettings } | null | undefined) {
  return cleanEquationSettings(definition?.equation ?? defaultEquationSettings());
}

export function cleanEquationSettings(value: unknown): EquationSettings {
  const base = defaultEquationSettings();
  const raw = value && typeof value === "object" ? (value as Partial<EquationSettings>) : {};
  const rounds = Array.isArray(raw.rounds) ? raw.rounds.map(cleanRound).filter((item) => item.prompt || item.name) : base.rounds;
  const abilities = Array.isArray(raw.abilities) ? raw.abilities.map(cleanAbility).filter((item) => item.name) : base.abilities;
  const dialogue = { ...base.dialogue, ...(raw.dialogue ?? {}) };
  return {
    completionBonus: clamp(raw.completionBonus, 0, 100, base.completionBonus),
    allowedMistakes: clamp(raw.allowedMistakes, 0, 20, base.allowedMistakes),
    eliminate: raw.eliminate === true,
    correction: raw.correction === true,
    winMode: raw.winMode === "complete" || raw.winMode === "minimum" || raw.winMode === "both" ? raw.winMode : "highest",
    minimumScore: clamp(raw.minimumScore, 0, 500, base.minimumScore),
    abilities: abilities.length ? abilities : base.abilities,
    dialogue: {
      registration: clip(dialogue.registration, 400, base.dialogue.registration),
      intro: clip(dialogue.intro, 400, base.dialogue.intro),
      round5: clip(dialogue.round5, 400, base.dialogue.round5),
      ability: clip(dialogue.ability, 400, base.dialogue.ability),
      final: clip(dialogue.final, 400, base.dialogue.final),
      success: clip(dialogue.success, 400, base.dialogue.success),
      failure: clip(dialogue.failure, 400, base.dialogue.failure),
    },
    rounds: rounds.length ? rounds : base.rounds,
  };
}

export function previewEquation(settings: EquationSettings, roundIndex: number, sample: Partial<Attempt>, shifted = false) {
  const round = cleanEquationSettings(settings).rounds[roundIndex];
  if (!round) return { correct: false, explainCorrect: false, answer: "", explanation: "", note: "That round does not exist." };
  const verdict = judge(round, blankAttempt(sample), shifted);
  return {
    correct: verdict.correct,
    explainCorrect: verdict.explainCorrect,
    answer: shownAnswer(round, shifted),
    explanation: shownExplanation(round, shifted),
    note: verdict.correct ? "Correct." : "Not this time.",
  };
}

export function initEquation(rt: Runtime) {
  const settings = equationSettings(rt.config);
  rt.rounds = settings.rounds.length;
  rt.round = 0;
  rt.phase = "live";
  rt.extra = {
    gameStarted: rt.startedAt,
    clears: {},
    mistakes: {},
    out: {},
    shifted: false,
    abilityUsed: "",
  };
  openRound(rt, 0, rt.startedAt);
}

export function equationSubmit(rt: Runtime, player: PlayerRef, payload: { text?: string; number?: number; choice?: string; parts?: string[]; puzzles?: string[]; code?: string; explanation?: string; puzzleIndex?: number; puzzleText?: string; lock?: boolean }, now: number) {
  if (rt.format !== "perfect_equation") return "This is not The Perfect Equation.";
  if (rt.phase !== "live") return "This round is not accepting answers.";
  if (rt.pausedRemaining !== null) return "The challenge is paused.";
  const settings = equationSettings(rt.config);
  if (isOut(rt, player.id)) return "You are watching the remaining rounds. Your score stays as it is.";
  const round = currentRound(rt, settings);
  const bag = attempts(rt);
  const prior = bag[player.id] ?? emptyAttempt();
  const limit = settings.correction ? Math.max(1, round.attempts) : 1;
  const next = { ...prior, parts: [...prior.parts], puzzles: [...prior.puzzles] };
  if (round.kind === "code" && payload.puzzleIndex !== undefined) {
    if (prior.locked) return "That answer is locked.";
    const index = Number(payload.puzzleIndex);
    const puzzles = livePuzzles(round, shifted(rt));
    if (!Number.isInteger(index) || index < 0 || !puzzles[index]) return "That puzzle is not on this card.";
    next.puzzles[index] = String(payload.puzzleText ?? "").trim().slice(0, 40);
  } else {
    if (prior.locked || prior.tries >= limit) return "That answer is locked.";
    next.text = String(payload.text ?? payload.choice ?? (payload.number !== undefined ? payload.number : "")).trim();
    next.parts = (payload.parts ?? next.parts).map((part) => String(part ?? "").trim());
    next.code = String(payload.code ?? next.code).trim();
    next.explanation = String(payload.explanation ?? next.explanation).trim();
    if (payload.puzzles) next.puzzles = payload.puzzles.map((part) => String(part ?? "").trim());
    next.tries += 1;
    next.locked = !settings.correction || next.tries >= limit || payload.lock === true;
  }
  if (next.text.length > 500 || next.explanation.length > 500 || next.code.length > 12) return "That answer is too long.";
  bag[player.id] = next;
  rt.submissions[String(rt.round)] = bag as unknown as Record<string, Record<string, unknown>>;
  if (playing(rt).every((person) => (bag[person.id]?.locked || isOut(rt, person.id)))) closeRound(rt, now);
  return null;
}

export function equationTick(rt: Runtime, now: number) {
  if (rt.phase === "complete" || rt.pausedRemaining !== null) return;
  if (rt.phase === "feedback") {
    const until = Number(rt.extra.feedbackUntil ?? 0);
    if (until && now >= until) advance(rt, now);
    return;
  }
  if (rt.deadline !== null && now >= rt.deadline) closeRound(rt, now);
}

export function equationHost(rt: Runtime, type: "skip" | "end", now: number) {
  if (type === "end") {
    finishGame(rt, now, true);
    return;
  }
  closeRound(rt, now);
  advance(rt, now);
}

export function equationCommand(rt: Runtime, isOwner: boolean, action: Record<string, unknown>, now: number): { ok: true; runtime: Runtime } | { ok: false; error: string; runtime: Runtime } {
  if (!isOwner) return { ok: false, error: "Only the owner can change the equation.", runtime: rt };
  const command = String(action.command ?? "");
  if (command === "shift") {
    const settings = equationSettings(rt.config);
    if (rt.phase !== "live") return { ok: false, error: "The variable can change only while a puzzle is open.", runtime: rt };
    if (rt.extra.abilityUsed) return { ok: false, error: "The variable has already changed.", runtime: rt };
    const ability = settings.abilities.find((item) => item.id === String(action.abilityId ?? item.id) && item.enabled) ?? settings.abilities.find((item) => item.enabled);
    const round = currentRound(rt, settings);
    if (!ability || !round.variant.condition) return { ok: false, error: "This round has no changed condition.", runtime: rt };
    rt.extra.abilityUsed = ability.id;
    rt.extra.shifted = true;
    rt.extra.shiftRound = rt.round;
    rt.submissions[String(rt.round)] = {};
    const left = Math.max(20000, (rt.deadline ?? now) - now);
    rt.deadline = now + left;
    rt.extra.banner = { kicker: ability.name.toUpperCase(), title: round.name, body: `${ability.announcement}\n\n${round.variant.condition}` };
    rt.log.push("One variable changed.");
    return { ok: true, runtime: rt };
  }
  if (command === "grade") {
    if (rt.phase !== "feedback") return { ok: false, error: "Explanations can be graded after the round closes.", runtime: rt };
    const id = String(action.playerId ?? "");
    const notes = (rt.extra.notes ?? {}) as Record<string, { explain?: boolean; manual?: boolean }>;
    if (!notes[id]?.manual) return { ok: false, error: "That explanation is not waiting.", runtime: rt };
    notes[id].explain = action.correct === true;
    notes[id].manual = false;
    rt.extra.notes = notes;
    if (action.correct === true) {
      const settings = equationSettings(rt.config);
      const round = settings.rounds[Number(rt.extra.closedRound ?? rt.round)] ?? currentRound(rt, settings);
      rt.scores[id] = (rt.scores[id] ?? 0) + round.explanationPoints;
    }
    if (!Object.values(notes).some((note) => note.manual)) rt.extra.feedbackUntil = now + 2000;
    return { ok: true, runtime: rt };
  }
  if (command === "next") {
    if (rt.phase !== "feedback") return { ok: false, error: "This round is still open.", runtime: rt };
    advance(rt, now);
    return { ok: true, runtime: rt };
  }
  return { ok: false, error: "Unknown equation control.", runtime: rt };
}

export function equationView(rt: Runtime, userId: string | null, isOwner: boolean, now: number, showPrivate = true): PlayView {
  const settings = equationSettings(rt.config);
  const round = settings.rounds[Math.min(rt.round, settings.rounds.length - 1)] ?? settings.rounds[0];
  const live = rt.phase === "live" ? round : settings.rounds[Number(rt.extra.closedRound ?? rt.round)] ?? round;
  const useShift = Boolean(rt.extra.shifted && Number(rt.extra.shiftRound) === (rt.phase === "live" ? rt.round : Number(rt.extra.closedRound ?? -1)));
  const bag = rt.submissions[String(rt.phase === "live" ? rt.round : rt.extra.closedRound ?? rt.round)] ?? {};
  const mine = userId ? (bag[userId] as Attempt | undefined) : undefined;
  const people = playing(rt);
  const answered = people.filter((person) => bag[person.id]?.locked || (live.kind === "code" && bag[person.id]?.tries)).length;
  const reveal = rt.phase !== "live" ? shownAnswer(live, useShift) : "";
  const notes = (rt.extra.notes ?? {}) as Record<string, { correct?: boolean; explain?: boolean; manual?: boolean }>;
  const board: Record<string, unknown> = {
    game: "perfect_equation",
    roundName: live.name,
    difficulty: live.difficulty,
    round: (rt.phase === "live" ? rt.round : Number(rt.extra.closedRound ?? rt.round)) + 1,
    rounds: settings.rounds.length,
    answered,
    players: people.length,
    score: userId ? rt.scores[userId] ?? 0 : 0,
    scores: people.map((person) => ({ name: person.username, score: rt.scores[person.id] ?? 0 })),
    condition: useShift ? live.variant.condition : "",
    progress: people.map((person) => ({ name: person.username, done: Boolean(bag[person.id]?.locked) })),
    locked: Boolean(mine?.locked),
    yourNote: mine?.locked ? "Answer locked." : mine?.tries ? "You can still replace that answer." : "",
    reveal: rt.phase === "live" ? "" : reveal,
    explanation: rt.phase === "live" ? "" : shownExplanation(live, useShift),
    askExplanation: live.askExplanation,
    options: live.kind === "choice" ? live.options : [],
    parts: live.kind === "parts" ? live.parts.map((part) => part.prompt) : [],
    puzzles: live.kind === "code" ? livePuzzles(live, useShift).map((puzzle, index) => ({
      prompt: puzzle.prompt,
      reveal: showPrivate && mine && answerMatches(mine.puzzles[index] ?? "", puzzle.accepted) ? puzzle.reveal : "",
    })) : [],
    code: live.kind === "code",
    canShift: isOwner && rt.phase === "live" && !rt.extra.abilityUsed && Boolean(round.variant.condition),
    abilities: isOwner ? settings.abilities.filter((item) => item.enabled).map((item) => ({ id: item.id, name: item.name })) : [],
    grades: showPrivate && isOwner && rt.phase === "feedback"
      ? people.filter((person) => notes[person.id]?.manual).map((person) => ({ id: person.id, name: person.username, text: (bag[person.id] as Attempt | undefined)?.explanation ?? "" }))
      : [],
    roundResult: rt.phase === "feedback"
      ? people.map((person) => ({ name: person.username, correct: Boolean(notes[person.id]?.correct) }))
      : [],
  };
  const entered = Boolean(userId && people.some((person) => person.id === userId));
  const waiting = !entered || rt.phase !== "live" || Boolean(mine?.locked) || isOut(rt, userId ?? "");
  return {
    format: rt.format,
    round: board.round as number,
    rounds: settings.rounds.length,
    phase: rt.phase,
    deadline: rt.pausedRemaining !== null ? now + Number(rt.pausedRemaining) : rt.deadline,
    paused: rt.pausedRemaining !== null,
    prompt: live.prompt,
    subprompt: `Round ${board.round} of ${settings.rounds.length} · ${live.difficulty}`,
    input: waiting ? { kind: "wait", message: rt.phase === "feedback" ? "The round is closed." : mine?.locked ? "Answer locked." : "Watch the remaining rounds." } : inputFor(live),
    submitted: Boolean(mine?.locked),
    feedback: rt.feedback,
    progress: people.map((person) => ({ id: person.id, name: person.username, done: Boolean(bag[person.id]?.locked) })),
    hint: null,
    revealed: null,
    board,
    yourScore: userId ? rt.scores[userId] ?? 0 : 0,
    hostPanel: null,
  };
}

function inputFor(round: EquationRound): PlayView["input"] {
  if (round.kind === "choice") return { kind: "choice", options: round.options };
  if (round.kind === "number") return { kind: "number", min: -9999, max: 99999 };
  if (round.kind === "parts" || round.kind === "code") return { kind: "text", placeholder: "Use the fields below" };
  return { kind: "text", placeholder: "Write the answer" };
}

function closeRound(rt: Runtime, now: number) {
  if (rt.phase !== "live") return;
  const settings = equationSettings(rt.config);
  const round = currentRound(rt, settings);
  const bag = attempts(rt);
  const useShift = Boolean(rt.extra.shifted && rt.extra.shiftRound === rt.round);
  const notes: Record<string, { correct: boolean; explain: boolean; manual: boolean }> = {};
  let manual = false;
  for (const person of playing(rt)) {
    if (isOut(rt, person.id)) {
      notes[person.id] = { correct: false, explain: false, manual: false };
      continue;
    }
    const attempt = bag[person.id] ?? emptyAttempt();
    const verdict = judge(round, attempt, useShift);
    notes[person.id] = { correct: verdict.correct, explain: verdict.explainCorrect, manual: Boolean(verdict.correct && round.askExplanation && round.gradeExplanation === "manual" && attempt.explanation) };
    if (notes[person.id].manual) manual = true;
    const clears = clearsOf(rt, person.id);
    clears[rt.round] = verdict.correct;
    rt.extra.clears = { ...(rt.extra.clears as object), [person.id]: clears };
    if (!verdict.correct) rt.extra.mistakes = { ...(rt.extra.mistakes as object), [person.id]: mistakes(rt, person.id) + 1 };
    let delta = verdict.correct ? round.points : 0;
    if (verdict.explainCorrect && round.gradeExplanation === "auto") delta += round.explanationPoints;
    rt.scores[person.id] = (rt.scores[person.id] ?? 0) + delta;
    if (settings.eliminate && mistakes(rt, person.id) > settings.allowedMistakes) rt.extra.out = { ...(rt.extra.out as object), [person.id]: true };
  }
  rt.extra.notes = notes;
  rt.extra.closedRound = rt.round;
  rt.phase = "feedback";
  rt.deadline = null;
  rt.feedback = manual ? "The representative is reading the explanations." : "The round is closed.";
  rt.extra.feedbackUntil = manual ? 0 : now + FEEDBACK_MS;
  rt.extra.banner = { kicker: "ROUND CLOSED", title: round.name, body: manual ? "Explanations are being read." : "Scores are on the screen. The answer is now visible." };
}

function advance(rt: Runtime, now: number) {
  const settings = equationSettings(rt.config);
  const next = Number(rt.extra.closedRound ?? rt.round) + 1;
  if (next >= settings.rounds.length) {
    finishGame(rt, now, false);
    return;
  }
  rt.extra.shifted = false;
  openRound(rt, next, now);
}

function openRound(rt: Runtime, index: number, now: number) {
  const settings = equationSettings(rt.config);
  const round = settings.rounds[index];
  rt.round = index;
  rt.phase = "live";
  rt.feedback = null;
  rt.startedAt = now;
  rt.deadline = now + Math.max(5, round.seconds) * 1000;
  rt.submissions[String(index)] = {};
  const speech = index === 4 ? settings.dialogue.round5 : index === settings.rounds.length - 1 ? settings.dialogue.final : round.name;
  rt.extra.banner = { kicker: `ROUND ${index + 1}`, title: round.name, body: speech };
}

function finishGame(rt: Runtime, now: number, closedEarly: boolean) {
  const settings = equationSettings(rt.config);
  const people = playing(rt);
  for (const person of people) {
    const clears = clearsOf(rt, person.id);
    const complete = settings.rounds.every((_, index) => clears[index]);
    if (complete) rt.scores[person.id] = (rt.scores[person.id] ?? 0) + settings.completionBonus;
  }
  const finalScores = people.map((person) => rt.scores[person.id] ?? 0);
  const best = Math.max(0, ...finalScores);
  for (const person of people) {
    const score = rt.scores[person.id] ?? 0;
    const clears = clearsOf(rt, person.id);
    const complete = settings.rounds.every((_, index) => clears[index]);
    const won =
      settings.winMode === "complete" ? complete
      : settings.winMode === "minimum" ? score >= settings.minimumScore
      : settings.winMode === "both" ? complete && score >= settings.minimumScore
      : score > 0 && score === best;
    rt.success[person.id] = won;
    const done = clears.filter(Boolean).length;
    rt.reasons[person.id] = won ? `Correct. ${done} of ${settings.rounds.length} rounds.` : `Not this time. ${done} of ${settings.rounds.length} rounds.`;
  }
  const winners = people.filter((person) => rt.success[person.id]).map((person) => person.username);
  const elapsed = Math.max(0, Math.round((now - Number(rt.extra.gameStarted ?? now)) / 1000));
  const ranking = [...people].sort((a, b) => (rt.scores[b.id] ?? 0) - (rt.scores[a.id] ?? 0)).map((person) => `${person.username} ${rt.scores[person.id] ?? 0}`).join(", ");
  rt.phase = "complete";
  rt.deadline = null;
  rt.completeTone = winners.length ? "success" : "fail";
  const speech = winners.length ? settings.dialogue.success : settings.dialogue.failure;
  rt.summary = `${speech} ${winners.length ? `Winners: ${winners.join(", ")}.` : ""} ${ranking}. ${elapsed} seconds.`;
  rt.feedback = rt.summary;
  rt.extra.banner = { kicker: winners.length ? "CALCULATION COMPLETE" : "GAME OVER", title: winners[0] ?? "The Perfect Equation", body: rt.summary };
  void closedEarly;
}

function judge(round: EquationRound, attempt: Attempt, shifted: boolean): Verdict {
  const accepted = shifted && round.variant.accepted.length ? round.variant.accepted : round.accepted;
  const explainKeys = shifted && round.variant.explainAccepted.length ? round.variant.explainAccepted : round.explainAccepted;
  let correct = false;
  const puzzles = livePuzzles(round, shifted).map((puzzle, index) => answerMatches(attempt.puzzles[index] ?? "", puzzle.accepted));
  if (round.kind === "parts") {
    const parts = shifted && round.variant.parts.some((part) => part.length) ? round.variant.parts : round.parts.map((part) => part.accepted);
    correct = parts.length > 0 && parts.every((keys, index) => keys.length === 0 ? answerMatches(attempt.parts[index] ?? "", round.parts[index]?.accepted ?? []) : answerMatches(attempt.parts[index] ?? "", keys));
  } else if (round.kind === "code") {
    const code = shifted && round.variant.code ? round.variant.code : round.code;
    const keys = shifted && round.variant.accepted.length ? round.variant.accepted : [code, ...round.accepted];
    correct = answerMatches(attempt.code || attempt.text, keys);
  } else {
    correct = answerMatches(attempt.text, accepted);
  }
  const explainCorrect = Boolean(correct && round.askExplanation && attempt.explanation && answerMatches(attempt.explanation, explainKeys));
  return { correct, explainCorrect, puzzles };
}

function livePuzzles(round: EquationRound, shifted: boolean) {
  return shifted && round.variant.puzzles.length ? round.variant.puzzles : round.puzzles;
}

function shownAnswer(round: EquationRound, shifted: boolean) {
  if (round.kind === "code") return shifted && round.variant.code ? round.variant.code : round.code;
  if (round.kind === "parts") {
    const parts = shifted && round.variant.parts.some((part) => part.length) ? round.variant.parts : round.parts.map((part) => part.accepted);
    return parts.map((keys, index) => `${round.parts[index]?.prompt ?? `Part ${index + 1}`}: ${keys[0] ?? ""}`).join(" · ");
  }
  const keys = shifted && round.variant.accepted.length ? round.variant.accepted : round.accepted;
  return keys[0] ?? "";
}

function shownExplanation(round: EquationRound, shifted: boolean) {
  return shifted && round.variant.explanation ? round.variant.explanation : round.explanation;
}

function currentRound(rt: Runtime, settings: EquationSettings) {
  return settings.rounds[rt.round] ?? settings.rounds[0];
}

function shifted(rt: Runtime) {
  return Boolean(rt.extra.shifted && rt.extra.shiftRound === rt.round);
}

function attempts(rt: Runtime) {
  return (rt.submissions[String(rt.round)] ?? {}) as unknown as Record<string, Attempt>;
}

function emptyAttempt(): Attempt {
  return { text: "", parts: [], puzzles: [], code: "", explanation: "", tries: 0, locked: false };
}

function blankAttempt(sample: Partial<Attempt>): Attempt {
  return { ...emptyAttempt(), ...sample, parts: sample.parts ?? [], puzzles: sample.puzzles ?? [] };
}

function playing(rt: Runtime) {
  return rt.players.filter((player) => player.playing !== false);
}

function clearsOf(rt: Runtime, id: string) {
  return [...(((rt.extra.clears as Record<string, boolean[]> | undefined)?.[id]) ?? [])];
}

function mistakes(rt: Runtime, id: string) {
  return Number((rt.extra.mistakes as Record<string, number> | undefined)?.[id] ?? 0);
}

function isOut(rt: Runtime, id: string) {
  return Boolean((rt.extra.out as Record<string, boolean> | undefined)?.[id]);
}

function round(partial: Partial<EquationRound> & Pick<EquationRound, "id" | "name" | "prompt">): EquationRound {
  return cleanRound({ ...partial, variant: partial.variant ?? variant({}) });
}

function variant(partial: Partial<EquationVariant>): EquationVariant {
  return {
    condition: partial.condition ?? "",
    accepted: partial.accepted ?? [],
    explainAccepted: partial.explainAccepted ?? [],
    parts: partial.parts ?? [],
    puzzles: partial.puzzles ?? [],
    code: partial.code ?? "",
    explanation: partial.explanation ?? "",
  };
}

function cleanRound(value: unknown): EquationRound {
  const raw = value && typeof value === "object" ? (value as Partial<EquationRound>) : {};
  const kind = raw.kind === "text" || raw.kind === "choice" || raw.kind === "parts" || raw.kind === "code" ? raw.kind : "number";
  const variantRaw = raw.variant ?? variant({});
  return {
    id: clip(raw.id, 40, "round").toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "round",
    name: clip(raw.name, 80, "Round"),
    difficulty: clip(raw.difficulty, 40, "Difficult"),
    prompt: clip(raw.prompt, 2000, ""),
    explanation: clip(raw.explanation, 1000, ""),
    seconds: clamp(raw.seconds, 5, 3600, 120),
    points: clamp(raw.points, 0, 100, 10),
    explanationPoints: clamp(raw.explanationPoints, 0, 50, 5),
    attempts: clamp(raw.attempts, 1, 5, 1),
    kind,
    options: Array.isArray(raw.options) ? raw.options.slice(0, 8).map((option, index) => ({ id: clip(option?.id, 20, String(index + 1)), label: clip(option?.label, 200, "Option") })) : [],
    accepted: lines(raw.accepted),
    askExplanation: raw.askExplanation === true,
    gradeExplanation: raw.gradeExplanation === "manual" ? "manual" : "auto",
    explainAccepted: lines(raw.explainAccepted),
    parts: Array.isArray(raw.parts) ? raw.parts.slice(0, 8).map((part) => ({ prompt: clip(part?.prompt, 200, "Part"), accepted: lines(part?.accepted) })) : [],
    puzzles: Array.isArray(raw.puzzles) ? raw.puzzles.slice(0, 6).map((puzzle) => ({ prompt: clip(puzzle?.prompt, 200, "Puzzle"), accepted: lines(puzzle?.accepted), reveal: clip(puzzle?.reveal, 12, "") })) : [],
    code: clip(raw.code, 12, ""),
    variant: {
      condition: clip(variantRaw.condition, 400, ""),
      accepted: lines(variantRaw.accepted),
      explainAccepted: lines(variantRaw.explainAccepted),
      parts: Array.isArray(variantRaw.parts) ? variantRaw.parts.slice(0, 8).map((part) => lines(part)) : [],
      puzzles: Array.isArray(variantRaw.puzzles) ? variantRaw.puzzles.slice(0, 6).map((puzzle) => ({ prompt: clip(puzzle?.prompt, 200, ""), accepted: lines(puzzle?.accepted), reveal: clip(puzzle?.reveal, 12, "") })) : [],
      code: clip(variantRaw.code, 12, ""),
      explanation: clip(variantRaw.explanation, 1000, ""),
    },
  };
}

function cleanAbility(value: unknown): EquationAbility {
  const raw = value && typeof value === "object" ? (value as Partial<EquationAbility>) : {};
  return {
    id: clip(raw.id, 40, "ability").toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "ability",
    name: clip(raw.name, 80, "The Variable Has Changed"),
    announcement: clip(raw.announcement, 400, "One condition has been altered. Reconsider your calculations."),
    enabled: raw.enabled !== false,
  };
}

function lines(value: unknown) {
  const source = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  return source.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12);
}

function clip(value: unknown, max: number, fallback: string) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, max);
}

function clamp(value: unknown, low: number, high: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(low, Math.min(high, Math.round(number)));
}
