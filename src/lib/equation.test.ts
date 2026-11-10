import assert from "node:assert/strict";
import test from "node:test";
import { createRuntime, hostAct, outcomes, submit, tick, view } from "./engine";
import { defaultEquationSettings, equationCommand, previewEquation } from "./equation";
import type { CardName, EquationSettings, PlayerRef } from "./types";

const cards: CardName[] = [{ id: "c1", label: "Six of Diamonds", suit: "diamonds", rank: "6" }];

function people(ids: string[]): PlayerRef[] {
  return ids.map((id) => ({ id, username: id[0].toUpperCase() + id.slice(1), playing: true }));
}

function start(settings: EquationSettings = defaultEquationSettings(), ids = ["ada", "bea"]) {
  return createRuntime({ format: "perfect_equation", equation: settings, rounds: settings.rounds.length, timerSeconds: 1080 }, people(ids), 1_000_000, "equation", cards);
}

test("every equation has one verified answer, and the changed condition has another", () => {
  const settings = defaultEquationSettings();
  assert.equal(previewEquation(settings, 0, { text: "42" }).correct, true);
  assert.equal(previewEquation(settings, 0, { text: "forty two" }).correct, true);
  assert.equal(previewEquation(settings, 0, { text: "41" }).correct, false);
  assert.equal(previewEquation(settings, 0, { text: "42" }, true).correct, false);
  assert.equal(previewEquation(settings, 0, { text: "44" }, true).correct, true);
  assert.equal(previewEquation(settings, 1, { text: "a", explanation: "twice the sum of the digits" }).correct, true);
  assert.equal(previewEquation(settings, 1, { text: "a", explanation: "twice the sum of the digits" }).explainCorrect, true);
  assert.equal(previewEquation(settings, 1, { text: "48 = 24" }).correct, true);
  assert.equal(previewEquation(settings, 1, { text: "b" }).correct, false);
  assert.equal(previewEquation(settings, 1, { text: "b", explanation: "3 + 9 plus 8" }, true).correct, true);
  assert.equal(previewEquation(settings, 2, { parts: ["7", "2", "5", "14"] }).correct, true);
  assert.equal(previewEquation(settings, 2, { parts: ["7", "2", "5", "15"] }).correct, false);
  assert.equal(previewEquation(settings, 2, { parts: ["7", "2", "5", "70"] }, true).correct, true);
  assert.equal(previewEquation(settings, 3, { text: "4", explanation: "exactly four are false" }).correct, true);
  assert.equal(previewEquation(settings, 3, { text: "statement 4" }).correct, true);
  assert.equal(previewEquation(settings, 3, { text: "1" }).correct, false);
  assert.equal(previewEquation(settings, 3, { text: "1", explanation: "exactly one is true" }, true).correct, true);
  assert.equal(previewEquation(settings, 4, { code: "7243" }).correct, true);
  assert.equal(previewEquation(settings, 4, { code: "7 2 4 3" }).correct, true);
  assert.equal(previewEquation(settings, 4, { code: "7244" }).correct, false);
  assert.equal(previewEquation(settings, 4, { code: "7244" }, true).correct, true);
  assert.equal(previewEquation(settings, 5, { text: "11", explanation: "N is 50 and only divisible by 5" }).correct, true);
  assert.equal(previewEquation(settings, 5, { text: "11", explanation: "N is 50 and only divisible by 5" }).explainCorrect, true);
  assert.equal(previewEquation(settings, 5, { text: "13" }).correct, false);
  assert.equal(previewEquation(settings, 5, { text: "13" }, true).correct, true);
  assert.match(previewEquation(settings, 0, { text: "42" }).explanation, /42/);
});

test("two players score the six rounds without seeing each other's answers", () => {
  let now = 1_000_000;
  let rt = start();
  const hidden = view(rt, "bea", false, now);
  const hiddenText = JSON.stringify(hidden);
  assert.equal(hiddenText.includes("42"), false);
  assert.equal(hiddenText.includes("accepted"), false);
  assert.equal(hidden.prompt.includes("2 – 6 – 12 – 20 – 30"), true);

  const first = submit(rt, "ada", { text: "forty two" }, now);
  assert.equal(first.ok, true);
  rt = first.runtime;
  const locked = submit(rt, "ada", { text: "41" }, now);
  assert.equal(locked.ok, false);
  const peer = JSON.stringify(view(rt, "bea", false, now));
  assert.equal(peer.includes("forty"), false);
  rt = submit(rt, "bea", { text: "40" }, now).runtime;
  assert.equal(rt.phase, "feedback");
  assert.equal(rt.scores.ada, 10);
  assert.equal(rt.scores.bea, 0);
  assert.equal(JSON.stringify(view(rt, "bea", false, now)).includes("forty"), false);

  const rounds = [
    [{ choice: "a", explanation: "twice the sum of the digits" }, { choice: "c" }],
    [{ parts: ["7", "2", "5", "14"] }, { parts: ["1", "1", "1", "1"] }],
    [{ text: "4", explanation: "exactly four are false" }, { text: "5" }],
    [{ code: "7243" }, { code: "1111" }],
    [{ text: "11", explanation: "N is 50 and only divisible by 5" }, { text: "12" }],
  ];
  for (const [ada, bea] of rounds) {
    now += 16000;
    rt = tick(rt, now);
    assert.equal(rt.phase, "live");
    rt = submit(rt, "ada", ada, now).runtime;
    rt = submit(rt, "bea", bea, now).runtime;
  }
  now += 16000;
  rt = tick(rt, now);
  assert.equal(rt.phase, "complete");
  const rows = outcomes(rt);
  assert.equal(rows.find((row) => row.userId === "ada")?.delta, 90);
  assert.equal(rows.find((row) => row.userId === "ada")?.success, true);
  assert.equal(rows.find((row) => row.userId === "bea")?.delta, 0);
  assert.equal(rows.find((row) => row.userId === "bea")?.success, false);
  assert.match(rt.summary ?? "", /Ada/);
  assert.match(rt.summary ?? "", /CALCULATION COMPLETE/);
});

test("the variable changes in public and can be used once", () => {
  let rt = start();
  const opened = equationCommand(rt, true, { command: "shift" }, 1_000_000);
  assert.equal(opened.ok, true);
  rt = opened.runtime;
  const board = view(rt, "ada", false, 1_000_000).board as { condition: string };
  assert.match(board.condition, /14/);
  rt = submit(rt, "ada", { text: "42" }, 1_000_000).runtime;
  rt = submit(rt, "bea", { text: "44" }, 1_000_000).runtime;
  assert.equal(rt.scores.ada, 0);
  assert.equal(rt.scores.bea, 10);
  const again = equationCommand(rt, true, { command: "shift" }, 1_010_000);
  assert.equal(again.ok, false);
  const stranger = equationCommand(start(), false, { command: "shift" }, 1_000_000);
  assert.equal(stranger.ok, false);
});

test("a code digit stays on the solver's phone and off the arena", () => {
  let now = 1_000_000;
  let rt = start();
  for (let round = 0; round < 4; round += 1) {
    rt = hostAct(rt, { type: "skip", now }).runtime;
    now += 1000;
  }
  assert.equal(rt.round, 4);
  rt = submit(rt, "ada", { puzzleIndex: 0, puzzleText: "7" }, now).runtime;
  const phone = view(rt, "ada", false, now, true).board as { puzzles: { reveal: string }[] };
  const arena = view(rt, "ada", true, now, false).board as { puzzles: { reveal: string }[] };
  const other = view(rt, "bea", false, now, true).board as { puzzles: { reveal: string }[] };
  assert.equal(phone.puzzles[0].reveal, "7");
  assert.equal(arena.puzzles[0].reveal, "");
  assert.equal(other.puzzles[0].reveal, "");
  assert.equal(JSON.stringify(arena).includes("7243"), false);
  rt = submit(rt, "ada", { code: "7243" }, now).runtime;
  assert.equal(submit(rt, "ada", { code: "0000" }, now).ok, false);
});

test("the clock closes an unanswered round at zero", () => {
  const rt = tick(start(), 1_000_000 + 90_000);
  assert.equal(rt.phase, "feedback");
  assert.equal(rt.scores.ada, 0);
  assert.equal(rt.scores.bea, 0);
  const shown = view(rt, "ada", false, 1_000_000 + 90_000);
  assert.equal(shown.board && (shown.board as { reveal: string }).reveal, "42");
});

test("a miss can stop further scoring without removing the player", () => {
  const settings = defaultEquationSettings();
  settings.eliminate = true;
  settings.allowedMistakes = 0;
  let rt = start(settings);
  rt = submit(rt, "ada", { text: "1" }, 1_000_000).runtime;
  rt = submit(rt, "bea", { text: "42" }, 1_000_000).runtime;
  rt = tick(rt, 1_016_000);
  const blocked = submit(rt, "ada", { text: "a" }, 1_008_000);
  assert.equal(blocked.ok, false);
  assert.equal(rt.players.some((player) => player.id === "ada"), true);
});
