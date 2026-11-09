import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";

process.env.DATABASE_URL = "";
process.env.ALLOW_LOCAL_OWNER = "1";
process.env.SOS_DATA_DIR = mkdtempSync(`${tmpdir()}/sos-`);

test("two phones and a host clear The Box without trusting the client", async () => {
  const { signUp, login, createSession, joinRoom, act, library } = await import("./room");
  const { accountFromToken } = await import("./auth");
  const ownerSignup = await signUp({ username: "Warden", password: "table-key-1", avatar: "crest" });
  assert.equal(ownerSignup.role, "owner");
  const owner = await accountFromToken(ownerSignup.token);
  assert.ok(owner);
  const adaSignup = await signUp({ username: "Ada", password: "ada-secret", avatar: "ring" });
  const beaSignup = await signUp({ username: "Bea", password: "bea-secret", avatar: "veil" });
  assert.equal(adaSignup.role, "player");
  assert.equal(beaSignup.role, "player");
  const ada = (await accountFromToken(adaSignup.token))!;
  const bea = (await accountFromToken(beaSignup.token))!;
  const refused = await createSession(ada, {}).catch((error: Error) => error);
  assert.equal(refused instanceof Error, true);
  const games = (await library()) as { id: string; name: string }[];
  assert.equal(games.length, 52);
  assert.ok(games.some((game) => game.name === "The Queen's Touch"));
  const box = games.find((game) => game.name === "The Box");
  assert.ok(box);
  const { manage } = await import("./owner");
  const detail = (await library(box.id)) as unknown as Record<string, string>;
  const refusedWrite = await manage(ada, "save-writing", { id: box.id, name: "The Box", rules: "Stolen." }).catch((error: Error) => error);
  assert.equal(refusedWrite instanceof Error, true);
  const writing = {
    id: box.id,
    name: detail.name,
    description: detail.description,
    rulesOriginal: detail.rules_original,
    instructions: detail.instructions,
    objective: detail.objective,
    win: detail.win_condition,
    fail: detail.fail_condition,
    scoring: detail.scoring_summary,
    materials: detail.materials,
    safety: detail.safety_note,
  };
  await manage(owner, "save-writing", { ...writing, rules: "A rule written in the library.", minPlayers: 3, maxPlayers: 6, timerSeconds: 45 });
  const written = (await library(box.id)) as unknown as { rules: string; min_players: number; max_players: number; timer_seconds: number };
  assert.equal(written.rules, "A rule written in the library.");
  assert.equal(Number(written.min_players), 3);
  assert.equal(Number(written.max_players), 6);
  assert.equal(Number(written.timer_seconds), 45);
  await manage(owner, "save-writing", { ...writing, rules: detail.rules, minPlayers: Number(detail.min_players), maxPlayers: Number(detail.max_players), timerSeconds: Number(detail.timer_seconds) });
  const restored = (await library(box.id)) as unknown as { min_players: number; max_players: number; timer_seconds: number };
  assert.equal(Number(restored.min_players), Number(detail.min_players));
  assert.equal(Number(restored.max_players), Number(detail.max_players));
  assert.equal(Number(restored.timer_seconds), Number(detail.timer_seconds));
  await manage(owner, "save-writing", { ...writing, rules: detail.rules, answers: "Box B\nthe middle box" });
  const hidden = JSON.stringify(await library(box.id));
  assert.equal(hidden.includes("middle box"), false);
  const ownerCopy = (await library(box.id, { secrets: true })) as unknown as { definition: { acceptedAnswers?: string[] } };
  assert.deepEqual(ownerCopy.definition.acceptedAnswers, ["Box B", "the middle box"]);
  await manage(owner, "save-writing", { ...writing, rules: detail.rules, answers: "" });
  const code = await createSession(owner, { playStyle: "arena", drawMode: "manual", preventDuplicates: true });
  await joinRoom(ada, code);
  await joinRoom(bea, code);
  await act(owner, code, { type: "draw_manual", gameId: box.id });
  await act(owner, code, { type: "advance" });
  await act(owner, code, { type: "advance" });
  await act(owner, code, { type: "advance" });
  await act(ada, code, { type: "enter" });
  await act(bea, code, { type: "enter" });
  let room = await act(owner, code, { type: "advance" });
  assert.equal(room.session.phase, "playing");
  assert.equal(JSON.stringify(room.play).includes("correctOptionId"), false);
  room = await act(ada, code, { type: "submit", payload: { choice: "b", delta: 999 } });
  room = await act(bea, code, { type: "submit", payload: { choice: "a", delta: 999 } });
  assert.equal(room.session.phase, "results");
  const result = room.result as { rows: { username: string; delta: number; success: boolean }[] } | null;
  assert.ok(result);
  const adaRow = result.rows.find((row) => row.username === "Ada");
  const beaRow = result.rows.find((row) => row.username === "Bea");
  assert.ok(adaRow);
  assert.ok(beaRow);
  assert.equal(adaRow.delta, 10);
  assert.equal(beaRow.delta, 0);
  assert.equal(adaRow.success, true);
  const again = await joinRoom(ada, code);
  assert.ok(again.you);
  assert.equal(again.you.score, 10);
  const { profile } = await import("./room");
  const adaProfile = await profile(ada);
  assert.equal(adaProfile.collection.length, 1);
  const returned = await login({ username: "Ada", password: "ada-secret" });
  const adaAgain = await accountFromToken(returned.token);
  assert.equal(adaAgain?.id, ada.id);
  const saved = await profile(adaAgain!);
  assert.equal(saved.collection.length, 1);
  assert.equal(saved.totals.score, "10");
  const cheat = await signUp({ username: "Ada", password: "another-password" }).catch((error: Error) => error);
  assert.equal(cheat instanceof Error, true);
  const wrong = await login({ username: "Ada", password: "wrong-password" }).catch((error: Error) => error);
  assert.equal(wrong instanceof Error, true);
});
