import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntime,
  doorLayout,
  hostAct,
  outcomes,
  submit,
  tick,
  view,
} from "./engine";
import { queenCommand } from "./queen";
import type { CardName, PlayerRef } from "./types";

const cards: CardName[] = [
  { id: "c1", label: "Two of Diamonds", suit: "diamonds", rank: "2" },
  { id: "c2", label: "Four of Hearts", suit: "hearts", rank: "4" },
  { id: "c3", label: "Ace of Clubs", suit: "clubs", rank: "A" },
  { id: "c4", label: "King of Spades", suit: "spades", rank: "K" },
  { id: "c5", label: "Five of Diamonds", suit: "diamonds", rank: "5" },
  { id: "c6", label: "Seven of Hearts", suit: "hearts", rank: "7" },
];

function players(ids: string[]): PlayerRef[] {
  return ids.map((id) => ({ id, username: id.toUpperCase(), playing: true }));
}

test("door movement matches the Notion key and stays hidden", () => {
  const doors = {
    walls: ["north", "east", "south", "west"],
    start: { north: "life", east: "end", south: "life", west: "end" } as Record<string, "life" | "end">,
    lifeShift: -1,
    endShift: 1,
    rounds: 8,
    lifePoints: 1,
    endPoints: -1,
  };
  assert.equal(doorLayout(doors, 0).north, "life");
  assert.equal(doorLayout(doors, 1).north, "end");
  assert.equal(doorLayout(doors, 1).east, "life");
  assert.equal(doorLayout(doors, 2).north, "life");
  const rt = createRuntime(
    { format: "pattern_doors", doors, timerSeconds: 30, prompt: "Choose a door." },
    players(["ada"]),
    1_000,
    "door-seed",
    cards,
    "ada",
  );
  const seen = JSON.stringify(view(rt, "ada", false, 1_000));
  assert.equal(seen.includes("layouts"), false);
  assert.equal(seen.includes("endShift"), false);
  let state = rt;
  for (let round = 0; round < 8; round++) {
    const layout = doorLayout(doors, round);
    const wall = Object.entries(layout).find(([, kind]) => kind === "life")?.[0] ?? "north";
    const next = submit(state, "ada", { choice: wall }, 1_000 + round);
    assert.equal(next.ok, true);
    state = next.runtime;
    if (state.phase === "feedback") state = tick(state, Number(state.extra.feedbackUntil) + 1);
  }
  assert.equal(state.phase, "complete");
  assert.equal(outcomes(state)[0].delta, 8);
  assert.equal(outcomes(state)[0].success, true);
});

test("balance scale uses the mean times 0.8", () => {
  let rt = createRuntime(
    {
      format: "number_contest",
      timerSeconds: 30,
      contest: { min: 0, max: 100, factor: 0.8, winPoints: 2, losePoints: -2, rounds: 1 },
      prompt: "Choose.",
    },
    players(["ada", "bea"]),
    5_000,
    "scale",
    cards,
  );
  rt = submit(rt, "ada", { number: 40 }, 5_000).runtime;
  rt = submit(rt, "bea", { number: 100 }, 5_000).runtime;
  const ada = outcomes(rt).find((row) => row.userId === "ada");
  const bea = outcomes(rt).find((row) => row.userId === "bea");
  assert.equal(ada?.delta, 2);
  assert.equal(bea?.delta, -2);
  assert.equal((rt.extra.lastBoard as { target: number }).target, 56);
});

test("the box and the light-switch choices score on the server", () => {
  let rt = createRuntime(
    {
      format: "multiple_choice",
      correctOptionId: "b",
      successPoints: 10,
      failPoints: 0,
      options: [
        { id: "a", label: "Box A" },
        { id: "b", label: "Box B" },
        { id: "c", label: "Box C" },
      ],
      timerSeconds: 30,
    },
    players(["ada"]),
    1,
    "box",
    cards,
  );
  rt = submit(rt, "ada", { choice: "b" }, 1).runtime;
  assert.equal(outcomes(rt)[0].delta, 10);
  const leaked = JSON.stringify(view(rt, "ada", false, 1));
  assert.equal(leaked.includes("correctOptionId"), false);
});

test("wolf mark is digital and protection only counts from someone else", () => {
  const rt0 = createRuntime(
    {
      format: "deduction_wolf",
      timerSeconds: 30,
      wolf: { targetPoints: -10, wolfCaught: -10, wolfClear: 10, protectOtherCost: -5 },
    },
    players(["a", "b", "c", "d"]),
    1,
    "wolf-seed",
    cards,
  );
  const wolf = String(rt0.secret.wolfId);
  const sheep = ["a", "b", "c", "d"].filter((id) => id !== wolf);
  const [target, protector, bystander] = sheep;
  let rt = submit(rt0, wolf, { playerId: target }, 1).runtime;
  rt = submit(rt, protector, { playerId: target }, 1).runtime;
  rt = submit(rt, bystander, { playerId: bystander }, 1).runtime;
  rt = submit(rt, target, { playerId: target }, 1).runtime;
  const rows = Object.fromEntries(outcomes(rt).map((row) => [row.userId, row]));
  assert.equal(rows[wolf].delta, -10);
  assert.equal(rows[target].delta, 0);
  assert.equal(rows[protector].delta, -5);
  assert.equal(rows[target].success, true);
  const sheepView = JSON.stringify(view(rt0, target, false, 1));
  assert.equal(sheepView.includes("wolfId"), false);
  assert.equal(sheepView.includes("You are the wolf"), false);
});

test("trust, guess, alliance and risk record server-side oaths", () => {
  let rt = createRuntime(
    { format: "pending_trust", pendingPoints: { hit: 5, miss: -5 }, timerSeconds: 20 },
    players(["ada", "bea"]),
    1,
    "trust",
    cards,
    "ada",
  );
  rt = submit(rt, "ada", { playerId: "bea" }, 1).runtime;
  assert.equal(rt.pending?.[0].kind, "trust");
  assert.equal(rt.pending?.[0].targetId, "bea");
  const wrong = submit(rt, "bea", { playerId: "ada" }, 1);
  assert.equal(wrong.ok, false);
});

test("consensus disagreement does not trust a client score", () => {
  let rt = createRuntime(
    {
      format: "role_consensus",
      timerSeconds: 20,
      disagreementPoints: -10,
      roles: [
        { id: "sheep", label: "Sheep", points: -10, blurb: "Safe." },
        { id: "wolf", label: "Wolf", points: 10, blurb: "Bold." },
      ],
    },
    players(["ada", "bea"]),
    1_000,
    "roles",
    cards,
  );
  rt = submit(rt, "ada", { role: "wolf" }, 1_000).runtime;
  rt = tick(rt, 30_000);
  assert.equal(rt.phase, "complete");
  assert.equal(outcomes(rt).every((row) => row.delta === -10), true);
});

test("sequence order is not embedded in piece ids", () => {
  const rt = createRuntime(
    {
      format: "sequence",
      sequence: ["red", "blue", "red"],
      sequenceLabels: { red: "Red", blue: "Blue" },
      stepMs: 1,
      timerSeconds: 30,
      successPoints: 5,
    },
    players(["ada"]),
    1_000,
    "memory",
    cards,
  );
  const seen = view(rt, "ada", false, 5_000);
  assert.equal(seen.input.kind, "order");
  if (seen.input.kind !== "order") return;
  const correct = rt.secret.order as string[];
  assert.equal(JSON.stringify(seen).includes("secret"), false);
  assert.equal(seen.input.pool.every((piece) => !/^piece-\d-/.test(piece.id)), true);
  const answered = submit(rt, "ada", { order: correct }, 5_000);
  assert.equal(outcomes(answered.runtime)[0].delta, 5);
});

test("host judgment is the only way a judged answer scores", () => {
  let rt = createRuntime(
    { format: "host_judge", successPoints: 5, failPoints: 0, timerSeconds: 30, prompt: "Decode." },
    players(["ada"]),
    1,
    "decode",
    cards,
  );
  rt = submit(rt, "ada", { text: "curiosity" }, 1).runtime;
  assert.equal(rt.phase, "live");
  const cheated = submit(rt, "ada", { text: "5" }, 1);
  assert.equal(cheated.ok, false);
  rt = hostAct(rt, { type: "mark", userId: "ada", correct: true }).runtime;
  rt = hostAct(rt, { type: "resolve" }).runtime;
  assert.equal(outcomes(rt)[0].delta, 5);
  assert.equal(outcomes(rt)[0].success, true);
});

test("chain returns a penalty when the card comes home", () => {
  let rt = createRuntime(
    { format: "chain", timerSeconds: 30, chain: { returnedPoints: -10, passedPoints: 10 } },
    players(["ada", "bea"]),
    1_000,
    "chain",
    cards,
    "ada",
  );
  const bearer = view(rt, "ada", false, 1_000);
  assert.equal(bearer.input.kind, "choice");
  if (bearer.input.kind !== "choice") return;
  rt = submit(rt, "ada", { choice: bearer.input.options[0].id }, 1_000).runtime;
  rt = submit(rt, "ada", { playerId: "bea" }, 1_100).runtime;
  rt = submit(rt, "bea", { playerId: "ada" }, 1_200).runtime;
  rt = tick(rt, 40_000);
  assert.equal(outcomes(rt).find((row) => row.userId === "ada")?.delta, -10);
});

test("a disconnected clock still resolves from the server deadline", () => {
  let rt = createRuntime(
    {
      format: "keywords",
      keywordGroups: [["warm", "heat"], ["third", "untouched"]],
      successPoints: 8,
      timerSeconds: 10,
    },
    players(["ada"]),
    1_000,
    "keys",
    cards,
  );
  rt = tick(rt, 20_000);
  assert.equal(rt.phase, "complete");
  assert.equal(outcomes(rt)[0].success, false);
});

test("the Queen of Spades is chosen at random and the touch stays secret", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  let rt = createRuntime(
    { format: "queens_touch", timerSeconds: 30, rounds: 5, successPoints: 5, failPoints: -2 },
    players(ids),
    1_000,
    "queen-card",
    cards,
  );
  const queenId = String(rt.secret.queenId);
  assert.ok(ids.includes(queenId));
  const challengers = ids.filter((id) => id !== queenId);
  assert.equal(challengers.length, 7);
  for (const id of challengers) {
    const phone = view(rt, id, false, 1_000);
    assert.equal(phone.board?.youAreQueen, false);
    assert.equal(phone.board?.role, "challenger");
    assert.equal(JSON.stringify(phone).includes("forearm"), false);
  }
  const queenPhone = view(rt, queenId, false, 1_000);
  assert.equal(queenPhone.board?.youAreQueen, true);
  assert.equal(queenPhone.subprompt, "You are the Queen of Spades.");
  const screen = view(rt, queenId, true, 1_000, false);
  assert.equal(screen.board?.role, "challenger");
  assert.equal(JSON.stringify(screen).includes("sequence"), false);
  const stranger = queenCommand(rt, challengers[0], false, { command: "assign", playerId: challengers[1], locationId: "forearm", side: "left" }, 1_000);
  assert.equal(stranger.ok, false);
  const places = ["shoulder", "upper-arm", "forearm", "shoulder", "upper-arm", "forearm", "shoulder"];
  const sides = ["left", "right", "left", "right", "left", "right", "left"];
  for (let index = 0; index < challengers.length; index += 1) {
    const saved = queenCommand(rt, queenId, false, { command: "assign", playerId: challengers[index], locationId: places[index], side: sides[index] }, 1_000);
    assert.equal(saved.ok, true);
    rt = saved.runtime;
  }
  const locked = queenCommand(rt, queenId, false, { command: "lock" }, 2_000);
  assert.equal(locked.ok, true);
  rt = locked.runtime;
  const hidden = view(rt, challengers[0], false, 2_000);
  assert.equal(JSON.stringify(hidden).includes("forearm"), false);
  const shown = queenCommand(rt, queenId, true, { command: "begin" }, 2_000);
  assert.equal(shown.ok, true);
  rt = shown.runtime;
  assert.equal(view(rt, challengers[0], false, 2_000).prompt, "Where did the Queen mark you?");
  for (const id of challengers) {
    const answer = submit(rt, id, { choice: `${places[challengers.indexOf(id)]}:${sides[challengers.indexOf(id)]}` }, 2_100);
    assert.equal(answer.ok, true);
    rt = answer.runtime;
  }
  const again = submit(rt, challengers[0], { choice: "shoulder:left" }, 2_200);
  assert.equal(again.ok, false);
  assert.equal(rt.scores[challengers[0]], 5);
  rt = tick(rt, 5_000);
  assert.equal(String(rt.extra.step), "movement");
  const lied = queenCommand(rt, queenId, false, { command: "ability", ability: "deception", text: "The first mark was on the right forearm." }, 5_100);
  assert.equal(lied.ok, true);
  rt = lied.runtime;
  assert.equal(rt.extra.deception, "The first mark was on the right forearm.");
  assert.equal((rt.secret.sequence as { side: string }[])[0].side, sides[0]);
  const repeated = queenCommand(rt, queenId, false, { command: "ability", ability: "deception", text: "Again." }, 5_200);
  assert.equal(repeated.ok, false);
});
