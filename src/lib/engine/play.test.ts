import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPending,
  assignActors,
  dealHands,
  digitalElimination,
  emptyPhone,
  pickCard,
  publicPlay,
  resolveCard,
  sanitizeMove,
  type CardFace,
  type RoundContext,
} from "./play.ts";

function card(partial: Partial<CardFace> & Pick<CardFace, "effect">): CardFace {
  return {
    id: "card-1",
    suit: "diamonds",
    rank: "6",
    title: "Odd one",
    prompt: "Which number does not belong: 4, 9, 16, 25, 36, 48, 64?",
    source: "proposal",
    secret: { answer: "48" },
    ...partial,
  };
}

function context(partial: Partial<RoundContext> = {}): RoundContext {
  return {
    actors: [{ id: "a", status: "active" }],
    moves: [],
    inner: 1,
    innerCount: 1,
    now: 1_000,
    deadlineAt: null,
    hands: {},
    forehead: {},
    phone: emptyPhone(),
    ...partial,
  };
}

test("a puzzle score comes from the card, and a client score is ignored", () => {
  const face = card({ effect: { kind: "puzzle", scoring: { success: 5, miss: 0 } } });
  const poisoned = sanitizeMove({ text: "48", points: 100, score: 100, result: "win" });
  assert.deepEqual(poisoned, { text: "48" });
  const outcome = resolveCard(face, context({ moves: [{ participantId: "a", payload: poisoned }] }));
  assert.equal(outcome.resolvable, true);
  assert.deepEqual(outcome.deltas, [{ participantId: "a", points: 5, reason: "match" }]);
  const miss = resolveCard(face, context({ moves: [{ participantId: "a", payload: { text: "16" } }] }));
  assert.deepEqual(miss.deltas, [{ participantId: "a", points: 0, reason: "miss" }]);
});

test("the public puzzle view does not include a hidden answer that is not already in the prompt", () => {
  const face = card({
    title: "Sum code",
    prompt: "Four digits. The first digit is 7.",
    effect: { kind: "puzzle", question: "Four digits.", scoring: { success: 5 } },
    secret: { answer: "7354" },
  });
  const view = publicPlay(face, "a", [{ id: "a", status: "active" }]);
  assert.equal(JSON.stringify(view).includes("7354"), false);
  assert.equal(JSON.stringify(view).includes("answer"), false);
});

test("a puzzle with no stored answer writes no score", () => {
  const face = card({
    title: "Decode",
    effect: { kind: "puzzle", scoring: { success: 5 } },
    secret: {},
  });
  const outcome = resolveCard(face, context({ moves: [{ participantId: "a", payload: { text: "invented" } }] }));
  assert.equal(outcome.resolvable, false);
  assert.deepEqual(outcome.deltas, []);
});

test("draws skip a dealt card unless an assignment names it", () => {
  const pool = [
    { id: "one", suit: "diamonds", rank: "6", source: "proposal" },
    { id: "two", suit: "diamonds", rank: "8", source: "proposal" },
    { id: "old", suit: "diamonds", rank: "6", source: "export" },
  ];
  const next = pickCard(pool, ["one"], null, () => 0);
  assert.equal(next.id, "two");
  const assigned = pickCard(pool, ["one"], "one", () => 0);
  assert.equal(assigned.id, "one");
});

test("door rounds follow the published rotation and do not invent a tenth round", () => {
  const face = card({
    effect: { kind: "door_pattern", rounds: 8, scoring: { clear: 1, out: -1 } },
    secret: {},
  });
  const north = resolveCard(face, context({ inner: 1, innerCount: 8, moves: [{ participantId: "a", payload: { choice: "north" } }] }));
  assert.equal(north.complete, false);
  assert.deepEqual(north.deltas, [{ participantId: "a", points: 1, reason: "clear" }]);
  const east = resolveCard(face, context({ inner: 2, innerCount: 8, moves: [{ participantId: "a", payload: { choice: "east" } }] }));
  assert.equal(east.deltas[0]?.points, 1);
  const last = resolveCard(face, context({ inner: 8, innerCount: 8, moves: [{ participantId: "a", payload: { choice: "north" } }] }));
  assert.equal(last.complete, true);
  assert.equal(last.deltas[0]?.points, -1);
});

test("an undefined number target writes no score", () => {
  const face = card({
    effect: { kind: "number_target", scoring: { closest: 2, others: -2 } },
    secret: {},
  });
  const outcome = resolveCard(face, context({ moves: [{ participantId: "a", payload: { text: "40" } }] }));
  assert.equal(outcome.resolvable, false);
  assert.deepEqual(outcome.deltas, []);
});

test("trust uses the next card and the stored numbers", () => {
  const extra = applyPending(
    [{ type: "trust", pickerId: "a", trustedId: "b", lost: -5, kept: 5 }],
    [{ participantId: "a", points: -10, reason: "taken" }],
    ["b"],
  );
  assert.deepEqual(extra, [{ participantId: "a", points: -5, reason: "betrayed" }]);
});

test("a teamwork card without its figure writes no score", () => {
  const face = card({
    effect: { kind: "teamwork", scoring: { success: 5, miss: 0 } },
    secret: { note: "The owner supplies the figure." },
    prompt: "Rebuild the figure.",
  });
  const outcome = resolveCard(face, context({ moves: [{ participantId: "a", payload: { text: "square" } }] }));
  assert.equal(outcome.resolvable, false);
  assert.deepEqual(outcome.deltas, []);
});

test("digital elimination stays off unless enabled, and a tie eliminates no one", () => {
  const players = [
    { id: "a", status: "active", points: 1 },
    { id: "b", status: "active", points: 1 },
    { id: "c", status: "stopped", points: 0 },
  ];
  assert.deepEqual(digitalElimination(players, false), []);
  assert.deepEqual(digitalElimination(players, true), []);
  assert.deepEqual(digitalElimination([{ id: "a", status: "active", points: 2 }, { id: "b", status: "active", points: 0 }], true), ["b"]);
});

test("two seated players can be dealt hands without sharing the active card", () => {
  const hands = dealHands(["c1", "c2", "c3", "c4"], ["a", "b"], 2, () => 0);
  assert.equal(hands.a.length, 2);
  assert.equal(hands.b.length, 2);
  assert.equal(assignActors([{ id: "a", status: "active" }, { id: "b", status: "active" }], 1, 1)[0]?.id, "a");
});
