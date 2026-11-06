import assert from "node:assert/strict";
import test from "node:test";

import { assignActors, emptyPhone, resolveCard, sanitizeMove, type CardFace, type RoundContext } from "./play.ts";
import {
  SKIP_MESSAGE,
  advanceBeat,
  beatTrigger,
  physicalCopy,
  playingSeats,
  releasedAnswer,
  releasedHint,
  shiftDeadline,
} from "./table.ts";

function puzzle(): CardFace {
  return {
    id: "odd-one",
    suit: "diamonds",
    rank: "6",
    title: "Odd one",
    prompt: "Which number does not belong?",
    source: "proposal",
    effect: { kind: "puzzle", scoring: { success: 5, miss: 0 }, hints: ["It is not a square."] },
    secret: { answer: "48" },
  };
}

function context(partial: Partial<RoundContext>): RoundContext {
  return {
    actors: [],
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

test("a board and two phones finish a published puzzle on the server", () => {
  const seats = [
    { id: "table", role: "board", status: "active" },
    { id: "host", role: "host", status: "active" },
    { id: "phone-a", role: "phone", status: "active" },
    { id: "phone-b", role: "phone", status: "active" },
  ];
  const players = playingSeats(seats, "real_life");
  assert.deepEqual(players.map((seat) => seat.id), ["phone-a", "phone-b"]);
  const actors = assignActors(players, 1, 1);
  const move = sanitizeMove({ text: "48", points: 100, score: 100, result: "win" });
  const outcome = resolveCard(puzzle(), context({ actors, moves: [{ participantId: actors[0].id, payload: move }] }));
  assert.equal(outcome.resolvable, true);
  assert.deepEqual(outcome.deltas, [{ participantId: "phone-a", points: 5, reason: "match" }]);
  assert.equal(releasedAnswer("48", false, "board", false), null);
  assert.equal(releasedAnswer("48", true, "phone", false), null);
  assert.equal(releasedAnswer("48", true, "board", false), "48");
  assert.equal(releasedAnswer("48", true, "room", false), null);
  assert.equal(releasedAnswer("48", true, "room", true), "48");
  assert.equal(releasedHint("It is not a square.", false), null);
  assert.equal(releasedHint("It is not a square.", true), "It is not a square.");
});

test("a skipped card writes no score, and the timer only moves on the server clock", () => {
  assert.deepEqual({ message: SKIP_MESSAGE, deltas: [] }, { message: SKIP_MESSAGE, deltas: [] });
  const now = Date.parse("2026-11-06T12:00:00.000Z");
  const extended = shiftDeadline("2026-11-06T12:00:10.000Z", 30_000, now);
  assert.equal(extended, "2026-11-06T12:00:40.000Z");
  const shortened = shiftDeadline("2026-11-06T12:00:10.000Z", -15_000, now);
  assert.equal(shortened, "2026-11-06T12:00:00.000Z");
});

test("the board walks start, rules, draw, and success before the card stays up", () => {
  const start = Date.parse("2026-11-06T12:00:00.000Z");
  assert.equal(advanceBeat("start", start + 4000, start + 1000).beat, "start");
  assert.equal(advanceBeat("start", start + 4000, start + 4000).beat, "rules");
  const afterRules = advanceBeat("rules", start + 6000, start + 6000);
  assert.equal(afterRules.beat, "draw");
  assert.equal(advanceBeat("success", start, start).beat, "draw");
  assert.equal(beatTrigger("pause"), "paused");
  assert.equal(beatTrigger("game_over"), "game_over");
  assert.equal(beatTrigger("play"), null);
});

test("the phone alternative sits beside an optional physical task", () => {
  const copy = physicalCopy({
    physical: { optional: true, indoor: true, low_risk: true, phone: "Tap the pyramid diagram in order." },
  });
  assert.equal(copy.optional, true);
  assert.equal(copy.phone, "Tap the pyramid diagram in order.");
});
