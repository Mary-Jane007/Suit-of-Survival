import assert from "node:assert/strict";
import test from "node:test";
import { answerIsRight, answerMatches } from "./answers";

test("a written answer can use different words and still be the same answer", () => {
  const accepted = ["Box B", "the middle box"];
  assert.equal(answerMatches("box b", accepted), true);
  assert.equal(answerMatches("It is in Box B.", accepted), true);
  assert.equal(answerMatches("b", accepted), true);
  assert.equal(answerMatches("the middle box please", accepted), true);
  assert.equal(answerMatches("box", accepted), false);
  assert.equal(answerMatches("box a", accepted), false);
  assert.equal(answerMatches("thirty three", ["33"]), true);
  assert.equal(answerMatches("4 8 2 6", ["4826"]), true);
  assert.equal(answerMatches("dimond", ["diamond"]), true);
  assert.equal(answerMatches("tide", ["time"]), false);
  assert.equal(answerMatches("", accepted), false);
});

test("a choice is right when its label is the library answer", () => {
  const definition = {
    options: [
      { id: "a", label: "Box A" },
      { id: "b", label: "Box B" },
    ],
    correctOptionId: "b",
    acceptedAnswers: ["the middle box"],
  };
  assert.equal(answerIsRight(definition, { text: "middle box" }), true);
  assert.equal(answerIsRight(definition, { choice: "b" }), false);
  assert.equal(answerIsRight({ ...definition, acceptedAnswers: ["Box B"] }, { choice: "b" }), true);
  assert.equal(answerIsRight({ options: definition.options, correctOptionId: "b" }, { choice: "b" }), true);
});
