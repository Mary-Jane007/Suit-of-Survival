import assert from "node:assert/strict";
import test from "node:test";
import { phaseCues } from "./cues";

test("a card opens with the chime and that card's presenter", () => {
  const cues = phaseCues("detected", "diamonds-5", null);
  assert.deepEqual(cues, [
    "/preview-sounds/game-detected.mp3",
    "/preview-sounds/game-starts.mp3",
    "/sounds/voice/diamonds-5-welcome.mp3",
    "/sounds/voice/diamonds-5-rules.mp3",
  ]);
  assert.equal(phaseCues("rules", "diamonds-5", null)?.length, 4);
  assert.equal(phaseCues("detected", "../secret", null), null);
});

test("the countdown, a clear, and a miss use the cues that were heard", () => {
  assert.deepEqual(phaseCues("countdown", "diamonds-5", null), ["/preview-sounds/countdown.mp3"]);
  assert.equal(phaseCues("results", "diamonds-5", "success")?.[0], "/preview-sounds/cleared.mp3");
  assert.equal(phaseCues("results", "diamonds-5", "game_over")?.[0], "/preview-sounds/not-completed.mp3");
  assert.equal(phaseCues("results", "diamonds-5", "final_results"), null);
  assert.equal(phaseCues("playing", "diamonds-5", null), null);
});
