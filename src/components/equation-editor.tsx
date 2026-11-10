"use client";

import { useState } from "react";
import type { EquationAbility, EquationRound, EquationSettings } from "@/lib/types";

export function EquationFields({ equation, onChange }: { equation: EquationSettings; onChange: (next: EquationSettings) => void }) {
  const [preview, setPreview] = useState("");
  const [sample, setSample] = useState("");
  const [roundIndex, setRoundIndex] = useState(0);
  const [shifted, setShifted] = useState(false);

  function patch(next: EquationSettings) {
    onChange(next);
  }

  function updateRound(index: number, round: EquationRound) {
    patch({ ...equation, rounds: equation.rounds.map((item, itemIndex) => itemIndex === index ? round : item) });
  }

  async function tryPuzzle() {
    const round = equation.rounds[roundIndex];
    const parts = round?.kind === "parts" ? sample.split(",").map((part) => part.trim()) : [];
    const res = await fetch("/api/owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "preview-equation",
        equation,
        roundIndex,
        shifted,
        sample: { text: sample, code: sample, parts, explanation: sample },
      }),
    });
    const body = await res.json();
    if (!res.ok) return setPreview(body.error || "Could not check that answer.");
    setPreview(`${body.note} ${body.explainCorrect ? "Explanation bonus." : ""} Official answer: ${body.answer}. ${body.explanation}`);
  }

  return (
    <div className="stack">
      <p>The Perfect Equation. The next game uses what you save. A game already running keeps the version it started with.</p>
      <div className="grid-2">
        <label>Completion bonus<input type="number" value={equation.completionBonus} onChange={(event) => patch({ ...equation, completionBonus: Number(event.target.value) })} /></label>
        <label>Minimum score<input type="number" value={equation.minimumScore} onChange={(event) => patch({ ...equation, minimumScore: Number(event.target.value) })} /></label>
        <label>Allowed misses<input type="number" value={equation.allowedMistakes} onChange={(event) => patch({ ...equation, allowedMistakes: Number(event.target.value) })} /></label>
        <label>Win
          <select value={equation.winMode} onChange={(event) => patch({ ...equation, winMode: event.target.value as EquationSettings["winMode"] })}>
            <option value="highest">Highest score</option>
            <option value="complete">Every round correct</option>
            <option value="minimum">Reach the minimum</option>
            <option value="both">Every round and the minimum</option>
          </select>
        </label>
      </div>
      <label><input type="checkbox" checked={equation.correction} onChange={(event) => patch({ ...equation, correction: event.target.checked })} /> Allow a correction before the answer locks</label>
      <label><input type="checkbox" checked={equation.eliminate} onChange={(event) => patch({ ...equation, eliminate: event.target.checked })} /> Stop scoring after the allowed misses. Players can still leave.</label>
      <p className="meta">The time under the card is the sum of these round timers.</p>
      {equation.rounds.map((round, index) => (
        <details key={`${round.id}-${index}`} className="panel" open={index === 0}>
          <summary>{index + 1}. {round.name}</summary>
          <RoundFields round={round} onChange={(next) => updateRound(index, next)} onRemove={() => patch({ ...equation, rounds: equation.rounds.filter((_, itemIndex) => itemIndex !== index) })} />
        </details>
      ))}
      <button className="ghost" type="button" onClick={() => patch({ ...equation, rounds: [...equation.rounds, blankRound(equation.rounds.length + 1)] })}>Add a round</button>
      <p>Special abilities. Each one uses the changed condition written on the open round.</p>
      {equation.abilities.map((ability, index) => (
        <AbilityFields key={`${ability.id}-${index}`} ability={ability} onChange={(next) => patch({ ...equation, abilities: equation.abilities.map((item, itemIndex) => itemIndex === index ? next : item) })} />
      ))}
      <button className="ghost" type="button" onClick={() => patch({ ...equation, abilities: [...equation.abilities, { id: `ability-${equation.abilities.length + 1}`, name: "New condition", announcement: "One condition has been altered. Reconsider your calculations.", enabled: true }] })}>Add an ability</button>
      {(["registration", "intro", "round5", "ability", "final", "success", "failure"] as const).map((key) => (
        <label className="write" key={key}>Iris · {key}
          <textarea value={equation.dialogue[key]} onChange={(event) => patch({ ...equation, dialogue: { ...equation.dialogue, [key]: event.target.value } })} />
        </label>
      ))}
      <div className="grid-2">
        <label>Preview round
          <select value={roundIndex} onChange={(event) => setRoundIndex(Number(event.target.value))}>
            {equation.rounds.map((round, index) => <option key={round.id} value={index}>{index + 1}. {round.name}</option>)}
          </select>
        </label>
        <label>Trial answer<input value={sample} onChange={(event) => setSample(event.target.value)} placeholder="42, or 7, 2, 5, 14" /></label>
      </div>
      <label><input type="checkbox" checked={shifted} onChange={(event) => setShifted(event.target.checked)} /> Use the changed condition</label>
      <button className="ghost" type="button" onClick={tryPuzzle}>Check this puzzle</button>
      {preview ? <p>{preview}</p> : null}
    </div>
  );
}

function RoundFields({ round, onChange, onRemove }: { round: EquationRound; onChange: (round: EquationRound) => void; onRemove: () => void }) {
  return (
    <div className="stack">
      <div className="grid-2">
        <label>Name<input value={round.name} onChange={(event) => onChange({ ...round, name: event.target.value })} /></label>
        <label>Difficulty<input value={round.difficulty} onChange={(event) => onChange({ ...round, difficulty: event.target.value })} /></label>
        <label>Seconds<input type="number" value={round.seconds} onChange={(event) => onChange({ ...round, seconds: Number(event.target.value) })} /></label>
        <label>Points<input type="number" value={round.points} onChange={(event) => onChange({ ...round, points: Number(event.target.value) })} /></label>
        <label>Explanation points<input type="number" value={round.explanationPoints} onChange={(event) => onChange({ ...round, explanationPoints: Number(event.target.value) })} /></label>
        <label>Attempts<input type="number" min={1} max={5} value={round.attempts} onChange={(event) => onChange({ ...round, attempts: Number(event.target.value) })} /></label>
        <label>Kind
          <select value={round.kind} onChange={(event) => onChange({ ...round, kind: event.target.value as EquationRound["kind"] })}>
            <option value="number">Number</option>
            <option value="text">Written</option>
            <option value="choice">Choice</option>
            <option value="parts">Several parts</option>
            <option value="code">Code</option>
          </select>
        </label>
      </div>
      <label className="write">Puzzle<textarea className="writing" value={round.prompt} onChange={(event) => onChange({ ...round, prompt: event.target.value })} /></label>
      <label className="write">Accepted answers, one per line<textarea value={round.accepted.join("\n")} onChange={(event) => onChange({ ...round, accepted: event.target.value.split("\n") })} /></label>
      <label className="write">Explanation<textarea value={round.explanation} onChange={(event) => onChange({ ...round, explanation: event.target.value })} /></label>
      <label><input type="checkbox" checked={round.askExplanation} onChange={(event) => onChange({ ...round, askExplanation: event.target.checked })} /> Ask for an explanation</label>
      <label>Explanation grading
        <select value={round.gradeExplanation} onChange={(event) => onChange({ ...round, gradeExplanation: event.target.value === "manual" ? "manual" : "auto" })}>
          <option value="auto">Match the accepted reasons</option>
          <option value="manual">The owner grades it</option>
        </select>
      </label>
      <label className="write">Accepted reasons, one per line<textarea value={round.explainAccepted.join("\n")} onChange={(event) => onChange({ ...round, explainAccepted: event.target.value.split("\n") })} /></label>
      {round.kind === "choice" ? (
        <label className="write">Options, id | label
          <textarea value={round.options.map((option) => `${option.id} | ${option.label}`).join("\n")} onChange={(event) => onChange({ ...round, options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
            const [id, label] = line.split("|");
            return { id: (id || String(index + 1)).trim(), label: (label || id || "Option").trim() };
          }) })} />
        </label>
      ) : null}
      {round.kind === "parts" ? (
        <label className="write">Parts, prompt | answer
          <textarea value={round.parts.map((part) => `${part.prompt} | ${part.accepted.join(", ")}`).join("\n")} onChange={(event) => onChange({ ...round, parts: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const [prompt, answer] = line.split("|");
            return { prompt: (prompt || "Part").trim(), accepted: (answer || "").split(",").map((item) => item.trim()).filter(Boolean) };
          }) })} />
        </label>
      ) : null}
      {round.kind === "code" ? (
        <>
          <label>Code<input value={round.code} onChange={(event) => onChange({ ...round, code: event.target.value })} /></label>
          <label className="write">Puzzles, prompt | answer | digits
            <textarea value={round.puzzles.map((puzzle) => `${puzzle.prompt} | ${puzzle.accepted.join(", ")} | ${puzzle.reveal}`).join("\n")} onChange={(event) => onChange({ ...round, puzzles: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
              const [prompt, answer, reveal] = line.split("|");
              return { prompt: (prompt || "Puzzle").trim(), accepted: (answer || "").split(",").map((item) => item.trim()).filter(Boolean), reveal: (reveal || "").trim() };
            }) })} />
          </label>
        </>
      ) : null}
      <label className="write">Changed condition<textarea value={round.variant.condition} onChange={(event) => onChange({ ...round, variant: { ...round.variant, condition: event.target.value } })} /></label>
      <label className="write">Changed answers, one per line<textarea value={round.variant.accepted.join("\n")} onChange={(event) => onChange({ ...round, variant: { ...round.variant, accepted: event.target.value.split("\n") } })} /></label>
      <label className="write">Changed explanation<textarea value={round.variant.explanation} onChange={(event) => onChange({ ...round, variant: { ...round.variant, explanation: event.target.value } })} /></label>
      {round.kind === "code" ? <label>Changed code<input value={round.variant.code} onChange={(event) => onChange({ ...round, variant: { ...round.variant, code: event.target.value } })} /></label> : null}
      {round.kind === "parts" ? (
        <label className="write">Changed part answers, one line per part. A blank line keeps the original.
          <textarea value={round.variant.parts.map((part) => part.join(", ")).join("\n")} onChange={(event) => onChange({ ...round, variant: { ...round.variant, parts: event.target.value.split("\n").map((line) => line.split(",").map((item) => item.trim()).filter(Boolean)) } })} />
        </label>
      ) : null}
      {round.kind === "code" ? (
        <label className="write">Changed puzzles, prompt | answer | digits
          <textarea value={round.variant.puzzles.map((puzzle) => `${puzzle.prompt} | ${puzzle.accepted.join(", ")} | ${puzzle.reveal}`).join("\n")} onChange={(event) => onChange({ ...round, variant: { ...round.variant, puzzles: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const [prompt, answer, reveal] = line.split("|");
            return { prompt: (prompt || "").trim(), accepted: (answer || "").split(",").map((item) => item.trim()).filter(Boolean), reveal: (reveal || "").trim() };
          }) } })} />
        </label>
      ) : null}
      <button className="ghost" type="button" onClick={onRemove}>Remove this round</button>
    </div>
  );
}

function AbilityFields({ ability, onChange }: { ability: EquationAbility; onChange: (ability: EquationAbility) => void }) {
  return (
    <div className="stack">
      <label><input type="checkbox" checked={ability.enabled} onChange={(event) => onChange({ ...ability, enabled: event.target.checked })} /> {ability.name || "Ability"} is available</label>
      <label>Name<input value={ability.name} onChange={(event) => onChange({ ...ability, name: event.target.value })} /></label>
      <label className="write">Announcement<textarea value={ability.announcement} onChange={(event) => onChange({ ...ability, announcement: event.target.value })} /></label>
    </div>
  );
}

function blankRound(number: number): EquationRound {
  return {
    id: `round-${number}`,
    name: `Round ${number}`,
    difficulty: "Difficult",
    prompt: "",
    explanation: "",
    seconds: 120,
    points: 10,
    explanationPoints: 5,
    attempts: 1,
    kind: "number",
    options: [],
    accepted: [],
    askExplanation: false,
    gradeExplanation: "auto",
    explainAccepted: [],
    parts: [],
    puzzles: [],
    code: "",
    variant: { condition: "", accepted: [], explainAccepted: [], parts: [], puzzles: [], code: "", explanation: "" },
  };
}
