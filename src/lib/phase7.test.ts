import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assignActors,
  dealHands,
  emptyPhone,
  isPlayerFacing,
  leaksSecret,
  pickCard,
  publicEffect,
  publicPlay,
  resolveCard,
  statusAfterElimination,
  voteChoice,
  type CardFace,
  type RoundContext,
} from "./engine/play.ts";
import { playingSeats } from "./engine/table.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

type StoredCard = CardFace & { publishable: boolean };

const UNSAFE_EXPORT = /\b(dood|death|gegeten|straf|forceer|punishment)\b/i;
const PRIVATE_PRESSURE = /raden als het waar|waar of niet|tell (?:us|me) (?:a |your )?secret|your real life|is it true/i;

function readCards(sql: string): StoredCard[] {
  const pattern =
    /insert into public\.cards \([\s\S]*?\) values \(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*\$sos\$([\s\S]*?)\$sos\$,\s*\$sos\$([\s\S]*?)\$sos\$,\s*\$sos\$([\s\S]*?)\$sos\$::jsonb,\s*\$sos\$([\s\S]*?)\$sos\$::jsonb,\s*\d+,\s*'([^']+)',\s*(true|false),/g;
  const cards: StoredCard[] = [];
  for (const match of sql.matchAll(pattern)) {
    cards.push({
      id: match[1],
      suit: match[3],
      rank: match[4],
      title: match[5],
      prompt: match[6],
      effect: JSON.parse(match[7]) as Record<string, unknown>,
      secret: JSON.parse(match[8]) as Record<string, unknown>,
      source: match[9],
      publishable: match[10] === "true",
    });
  }
  return cards;
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

function facing(card: CardFace) {
  const view = publicPlay(card, null, []);
  return {
    title: view.title,
    prompt: view.prompt,
    question: view.question,
    privateNote: view.privateNote,
    effect: publicEffect(card.effect),
  };
}

function answerLeaks(card: CardFace) {
  const answer = card.secret.answer;
  if (typeof answer !== "string" || answer.trim().length < 2) {
    return false;
  }
  const view = publicPlay(card, "viewer", [{ id: "viewer", status: "active" }]);
  const effect = publicEffect(card.effect);
  const quiet = { privateNote: view.privateNote, hints: effect.hints, title: view.title };
  if (leaksSecret(quiet, card.secret)) {
    return true;
  }
  const needle = answer.trim().toLowerCase();
  const prompt = card.prompt.toLowerCase();
  const question = view.question.toLowerCase();
  if ((question === needle || prompt.trim() === needle) && needle.length > 0) {
    return true;
  }
  if (question.includes(needle) && !prompt.includes(needle)) {
    return true;
  }
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:answer|antwoord|oplossing)\\s*[:=]\\s*${escaped}`, "i").test(`${card.prompt}\n${view.question}`);
}

const cards = readCards(readFileSync(join(root, "supabase/migrations/20261106200100_phase3_content.sql"), "utf8"));
const playable = cards.filter((card) => isPlayerFacing(card));

test("the stored deck parses, and a draw uses a playable card", () => {
  assert.ok(cards.length >= 52);
  assert.ok(playable.length > 0);
  const pool = playable.map((card) => ({ id: card.id, suit: card.suit, rank: card.rank, source: card.source }));
  const first = pickCard(pool, [], null, () => 0);
  assert.ok(first.id);
  assert.equal(playable.some((card) => card.id === first.id), true);
  const again = pickCard(pool, [first.id ?? ""], null, () => 0);
  assert.notEqual(again.id, first.id);
  const assigned = pickCard(pool, [first.id ?? ""], first.id, () => 0);
  assert.equal(assigned.id, first.id);
});

test("a client score does not change a puzzle, a vote, or a later correction", () => {
  const puzzle = playable.find((card) => card.effect.kind === "puzzle" && card.secret.answer === "48");
  assert.ok(puzzle);
  const poisoned = voteChoice({ text: "48", points: 100, score: 100, result: "win", secret: "no", answer: "no" });
  assert.deepEqual(poisoned, { text: "48" });
  const scored = resolveCard(puzzle, context({ moves: [{ participantId: "a", payload: poisoned, at: 1 }] }));
  assert.equal(scored.deltas[0]?.points, 5);
  assert.equal(scored.deltas[0]?.reason, "match");

  const corrected = resolveCard(
    puzzle,
    context({
      moves: [
        { participantId: "a", payload: voteChoice({ text: "16", points: 100 }), at: 1 },
        { participantId: "a", payload: voteChoice({ text: "48", score: 9 }), at: 2 },
      ],
    }),
  );
  assert.deepEqual(corrected.deltas, [{ participantId: "a", points: 5, reason: "match" }]);

  const roles = playable.find((card) => card.suit === "hearts" && card.rank === "4");
  assert.equal(roles?.effect.kind, "role_pick");
  const voters = ["a", "b", "c"].map((id, index) => ({
    participantId: id,
    payload: voteChoice({
      role: ["sheep", "shepherd", "wolf"][index],
      agree: true,
      points: 40,
      score: 40,
    }),
    at: 1,
  }));
  const vote = resolveCard(
    roles as CardFace,
    context({
      actors: voters.map((row) => ({ id: row.participantId, status: "active" })),
      moves: voters,
    }),
  );
  assert.deepEqual(
    vote.deltas.map((delta) => delta.points),
    [-10, 2, 10],
  );
  assert.equal(vote.deltas.some((delta) => delta.points === 40), false);
});

test("a player who stops stays stopped, and elimination is a status", () => {
  const puzzle = playable.find((card) => card.effect.kind === "puzzle" && card.secret.answer === "48");
  assert.ok(puzzle);
  const stopped = resolveCard(puzzle, context({ actors: [{ id: "a", status: "stopped" }] }));
  assert.equal(stopped.complete, true);
  assert.deepEqual(stopped.deltas, [{ participantId: "a", points: 0, reason: "stop" }]);

  const roles = playable.find((card) => card.effect.kind === "role_pick");
  assert.ok(roles);
  const group = resolveCard(
    roles,
    context({
      actors: [
        { id: "a", status: "stopped" },
        { id: "b", status: "active" },
        { id: "c", status: "active" },
      ],
    }),
  );
  assert.deepEqual(
    group.deltas.map((delta) => delta.points),
    [0, 0, 0],
  );
  assert.equal(group.deltas.every((delta) => delta.reason === "stop"), true);

  const seats = [
    { id: "a", status: "stopped", points: 0, role: "player" },
    { id: "b", status: "active", points: 1, role: "player" },
    { id: "c", status: "active", points: 4, role: "phone" },
    { id: "board", status: "active", points: 0, role: "board" },
  ];
  const field = playingSeats(seats, "real_life");
  assert.deepEqual(field.map((seat) => seat.id), ["b", "c"]);
  const after = statusAfterElimination(field, true);
  assert.equal(after.find((seat) => seat.id === "b")?.status, "eliminated");
  assert.equal(after.find((seat) => seat.id === "c")?.status, "active");
  assert.equal(seats.find((seat) => seat.id === "a")?.status, "stopped");
  assert.equal(seats.find((seat) => seat.id === "board")?.status, "active");
  assert.deepEqual(statusAfterElimination(field, false).map((seat) => seat.status), ["active", "active"]);
  assert.deepEqual(assignActors(after, 1, 1).map((seat) => seat.id), ["c"]);
});

test("hands are dealt once, and a trade moves the card", () => {
  const hands = dealHands(["c1", "c2", "c3", "c4"], ["a", "b"], 2, () => 0);
  assert.deepEqual(hands.a, ["c1", "c3"]);
  assert.deepEqual(hands.b, ["c2", "c4"]);
  const traded = resolveCard(
    {
      id: "trade",
      suit: "hearts",
      rank: "9",
      title: "Trade",
      prompt: "Trade one card.",
      source: "proposal",
      effect: { kind: "trade", scoring: { convinced: 5, not_convinced: 0 } },
      secret: {},
    },
    context({
      actors: [
        { id: "a", status: "active" },
        { id: "b", status: "active" },
      ],
      hands,
      moves: [
        { participantId: "a", payload: voteChoice({ own: "c1", theirs: "c2", points: 80 }), at: 1 },
        { participantId: "b", payload: voteChoice({ choice: "swap", score: 80 }), at: 2 },
      ],
    }),
  );
  assert.deepEqual(traded.hands.a, ["c2", "c3"]);
  assert.deepEqual(traded.hands.b, ["c1", "c4"]);
  assert.deepEqual(traded.deltas, [{ participantId: "a", points: 5, reason: "convinced" }]);
});

test("one board seat and two phone seats finish a published puzzle on the server", () => {
  const puzzle = playable.find((card) => card.effect.kind === "puzzle" && card.secret.answer === "48");
  assert.ok(puzzle);
  const seats = [
    { id: "table", role: "board", status: "active" },
    { id: "host", role: "host", status: "active" },
    { id: "phone-a", role: "phone", status: "active" },
    { id: "phone-b", role: "phone", status: "active" },
  ];
  const players = playingSeats(seats, "real_life");
  assert.deepEqual(players.map((seat) => seat.id), ["phone-a", "phone-b"]);
  const actors = assignActors(players, 1, 1);
  const outcome = resolveCard(
    puzzle,
    context({
      actors,
      moves: [{ participantId: actors[0].id, payload: voteChoice({ text: "48", points: 100 }), at: 1 }],
    }),
  );
  assert.deepEqual(outcome.deltas, [{ participantId: "phone-a", points: 5, reason: "match" }]);
  const shown = publicPlay(puzzle, "phone-a", actors);
  assert.equal(JSON.stringify(shown).includes("48") ? puzzle.prompt.includes("48") : true, true);
  assert.equal(leaksSecret({ prompt: shown.prompt, note: shown.privateNote }, { answer: "7354" }), false);
});

test("hidden answers and unpublished unsafe lines are not player-facing", () => {
  const schema = readFileSync(join(root, "supabase/migrations/20261106200000_phase3_schema.sql"), "utf8");
  const view = schema.slice(schema.indexOf("create or replace view public.library_cards"), schema.indexOf("grant select on public.library_cards"));
  assert.match(view, /publishable = true/);
  assert.match(view, /in_play/);
  assert.equal(view.includes("secret"), false);
  const policy = schema.slice(schema.indexOf("create policy cards_select_published"), schema.indexOf("grant select on public.representatives"));
  assert.match(policy, /publishable = true/);
  assert.match(schema, /revoke select \(secret\)/);

  for (const card of playable) {
    assert.equal(answerLeaks(card), false, `${card.suit} ${card.rank} ${card.title}`);
    const effect = facing(card).effect;
    assert.equal("child_page" in effect, false, card.title);
    assert.equal("owner_note" in effect, false, card.title);
    assert.equal("safety" in effect, false, card.title);
  }

  const held = cards.filter((card) => !isPlayerFacing(card) && UNSAFE_EXPORT.test(`${card.prompt}\n${JSON.stringify(card.effect)}`));
  assert.ok(held.length >= 4);
  for (const hidden of held) {
    assert.equal(isPlayerFacing(hidden), false);
    for (const card of playable) {
      assert.equal(facing(card).prompt.includes(hidden.prompt), false, hidden.title);
    }
  }
});

test("hearts stay free of humiliation and private-disclosure pressure, and the queen is fiction", () => {
  const hearts = playable.filter((card) => card.suit === "hearts");
  assert.ok(hearts.length > 0);
  for (const card of hearts) {
    const copy = facing(card).prompt;
    assert.equal(PRIVATE_PRESSURE.test(copy), false, card.title);
    assert.equal(/humiliat/i.test(copy), false, card.title);
    assert.equal(/\b(gegeten|straf|forceer|dood)\b/i.test(copy), false, card.title);
  }
  const queens = hearts.filter((card) => card.rank === "Q");
  assert.equal(queens.length, 1);
  assert.match(queens[0].prompt, /fiction/i);
  assert.match(queens[0].prompt, /exactly one invented detail about the weather/i);
  assert.match(queens[0].prompt, /not a player's life/i);
  const exportQueen = cards.find((card) => card.suit === "hearts" && card.rank === "Q" && card.source === "export");
  assert.ok(exportQueen);
  assert.equal(isPlayerFacing(exportQueen), false);
  assert.match(exportQueen.prompt, /raden als het waar/);
});

test("the 2 of diamonds cipher stays out of play", () => {
  const cipher = cards.find((card) => card.suit === "diamonds" && card.rank === "2");
  assert.ok(cipher);
  assert.equal(cipher.publishable, false);
  assert.equal(cipher.effect.in_play, false);
  assert.deepEqual(cipher.secret, {});
  assert.match(cipher.prompt, /-9-2-1-5-8-2/);
  assert.equal(isPlayerFacing(cipher), false);
  assert.equal(
    playable.some((card) => card.prompt.includes("-9-2-1-5-8-2")),
    false,
  );
  const pool = playable.map((card) => ({ id: card.id, suit: card.suit, rank: card.rank, source: card.source }));
  assert.equal(
    pool.some((card) => card.id === cipher.id),
    false,
  );
  const drawn = pickCard(pool, [], cipher.id, () => 0);
  assert.equal(drawn.id, null);
});
