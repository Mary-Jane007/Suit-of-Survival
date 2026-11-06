import assert from "node:assert/strict";
import test from "node:test";

import {
  appendChange,
  clearsFor,
  collectionStanding,
  rankByPoints,
  readCollectionRule,
  ruleSentence,
  victoriesFor,
} from "./progression.ts";

const diamonds = { suit: "diamonds", clearsRequired: 5, clearMinimum: 0 };

test("a profile sentence comes from the stored collection rule", () => {
  const stored = readCollectionRule({ suit: "diamonds", clears_required: 5, clear_minimum: 0 });
  assert.deepEqual(stored, diamonds);
  assert.equal(ruleSentence(diamonds), "5 clears in diamonds. A clear is a point change of zero or higher on one card.");
  const edited = readCollectionRule({ suit: "diamonds", clears_required: 3, clear_minimum: 1 });
  assert.ok(edited);
  assert.equal(collectionStanding(1, edited).sentence, "3 clears in diamonds. A clear is a point change of 1 or higher on one card.");
  assert.equal(collectionStanding(1, edited).complete, false);
  assert.equal(collectionStanding(3, edited).complete, true);
});

test("a clear is the stored point change for one draw, and a zero still counts until the rule changes", () => {
  const suits = new Map([
    ["card-a", "diamonds"],
    ["card-b", "hearts"],
  ]);
  const history = appendChange(
    appendChange([], { card_id: "card-a", draw: 1, points: 1, reason: "clear" }),
    { card_id: "card-a", draw: 1, points: -1, reason: "out" },
  );
  const withZero = appendChange(history, { card_id: "card-b", draw: 2, points: 0, reason: "miss" });
  assert.equal(clearsFor(withZero, suits, diamonds).length, 1);
  assert.equal(clearsFor(withZero, suits, { suit: "hearts", clearsRequired: 5, clearMinimum: 0 }).length, 1);
  assert.equal(clearsFor(withZero, suits, { suit: "hearts", clearsRequired: 5, clearMinimum: 1 }).length, 0);
});

test("rankings and victories use the stored points only", () => {
  const scores = [
    { participantId: "b", points: 4 },
    { participantId: "a", points: 9 },
    { participantId: "c", points: 9 },
  ];
  assert.deepEqual(
    rankByPoints(scores).map((row) => row.participantId),
    ["a", "c", "b"],
  );
  const mine = new Set(["a"]);
  assert.equal(victoriesFor([{ scores }], mine), 0);
  assert.equal(victoriesFor([{ scores: [{ participantId: "a", points: 3 }, { participantId: "b", points: 1 }] }], mine), 1);
});
