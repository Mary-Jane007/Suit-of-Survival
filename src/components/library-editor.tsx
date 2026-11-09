"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QueenSettings } from "@/lib/types";

export type LibraryFields = {
  id: string;
  name: string;
  description: string;
  rules: string;
  rulesOriginal: string;
  instructions: string;
  objective: string;
  win: string;
  fail: string;
  scoring: string;
  materials: string;
  safety: string;
  queen: QueenSettings | null;
  minPlayers: number;
  maxPlayers: number;
  timerSeconds: number;
  rounds: number;
  successPoints: number;
  failPoints: number;
};

export function LibraryEditor({ game }: { game: LibraryFields }) {
  const router = useRouter();
  const [form, setForm] = useState(game);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function set(key: keyof LibraryFields, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setCount(key: "minPlayers" | "maxPlayers", raw: string) {
    setSaved(false);
    const parsed = Math.round(Number(raw));
    const next = Number.isFinite(parsed) ? Math.max(1, Math.min(16, parsed)) : 1;
    setForm((current) => {
      const draft = { ...current, [key]: next };
      if (draft.maxPlayers < draft.minPlayers) {
        if (key === "minPlayers") draft.maxPlayers = draft.minPlayers;
        else draft.minPlayers = draft.maxPlayers;
      }
      return draft;
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/owner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-writing", ...form, rulesOriginal: form.rulesOriginal }),
    });
    const body = await res.json();
    if (!res.ok) return setError(body.error || "Could not save.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={save}>
      <p>You can rewrite this card. Players only read it.</p>
      <label className="write">Name<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label className="write">Description<textarea value={form.description} onChange={(event) => set("description", event.target.value)} /></label>
      <label className="write">Rules<textarea className="writing" value={form.rules} onChange={(event) => set("rules", event.target.value)} /></label>
      <label className="write">Original notes<textarea className="writing" value={form.rulesOriginal} onChange={(event) => set("rulesOriginal", event.target.value)} /></label>
      <label className="write">Instructions<textarea value={form.instructions} onChange={(event) => set("instructions", event.target.value)} /></label>
      <label className="write">Objective<input value={form.objective} onChange={(event) => set("objective", event.target.value)} /></label>
      <label className="write">Clear<input value={form.win} onChange={(event) => set("win", event.target.value)} /></label>
      <label className="write">Miss<input value={form.fail} onChange={(event) => set("fail", event.target.value)} /></label>
      <label className="write">Scoring<input value={form.scoring} onChange={(event) => set("scoring", event.target.value)} /></label>
      <label className="write">Materials<input value={form.materials} onChange={(event) => set("materials", event.target.value)} /></label>
      <label className="write">Safety<textarea value={form.safety} onChange={(event) => set("safety", event.target.value)} /></label>
      <div className="grid-2">
        <label>Minimum players<input type="number" min={1} max={16} value={form.minPlayers} onChange={(event) => setCount("minPlayers", event.target.value)} /></label>
        <label>Maximum players<input type="number" min={1} max={16} value={form.maxPlayers} onChange={(event) => setCount("maxPlayers", event.target.value)} /></label>
      </div>
      <p className="meta">Shown under the card when it is drawn. Use the same number twice when the card needs an exact count.</p>
      {form.queen ? <QueenFields form={form} setForm={setForm} /> : null}
      <div className="dock">
        <button className="btn" type="submit">Save</button>
      </div>
      {saved ? <p>Saved. The white page reads these rules.</p> : null}
      <p className="error">{error}</p>
    </form>
  );
}

function QueenFields({ form, setForm }: { form: LibraryFields; setForm: (value: LibraryFields) => void }) {
  const queen = form.queen;
  if (!queen) return null;
  function patch(next: QueenSettings) {
    setForm({ ...form, queen: next });
  }
  const dialogue = queen.dialogue;
  return (
    <div className="stack">
      <p>Queen of Spades. These settings stay with the card.</p>
      <div className="grid-2">
        <label>Rounds<input type="number" value={form.rounds} onChange={(event) => setForm({ ...form, rounds: Number(event.target.value) })} /></label>
        <label>Seconds per question<input type="number" value={form.timerSeconds} onChange={(event) => setForm({ ...form, timerSeconds: Number(event.target.value) })} /></label>
        <label>Points for a correct answer<input type="number" value={form.successPoints} onChange={(event) => setForm({ ...form, successPoints: Number(event.target.value) })} /></label>
        <label>Points for a miss<input type="number" value={form.failPoints} onChange={(event) => setForm({ ...form, failPoints: Number(event.target.value) })} /></label>
        <label>Allowed mistakes<input type="number" value={queen.allowedMistakes} onChange={(event) => patch({ ...queen, allowedMistakes: Number(event.target.value) })} /></label>
        <label>Moves in a distraction<input type="number" value={queen.movementCount} onChange={(event) => patch({ ...queen, movementCount: Number(event.target.value) })} /></label>
      </div>
      <label>Difficulty<input value={queen.difficultyLabel} onChange={(event) => patch({ ...queen, difficultyLabel: event.target.value })} /></label>
      <label className="write">Questions per round, five numbers
        <input value={queen.questionsPerRound.join(", ")} onChange={(event) => patch({ ...queen, questionsPerRound: event.target.value.split(",").map((item) => Number(item.trim())) })} />
      </label>
      <label className="write">Touch places, one per line
        <textarea value={queen.locations.map((location) => location.label).join("\n")} onChange={(event) => patch({ ...queen, locations: event.target.value.split("\n").map((label) => label.trim()).filter(Boolean).map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label })) })} />
      </label>
      <label className="write">Movements, one per line
        <textarea className="writing" value={queen.movements.join("\n")} onChange={(event) => patch({ ...queen, movements: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} />
      </label>
      <label><input type="checkbox" checked={queen.abilities.deception} onChange={(event) => patch({ ...queen, abilities: { ...queen.abilities, deception: event.target.checked } })} /> The Deception</label>
      <label><input type="checkbox" checked={queen.abilities.recall} onChange={(event) => patch({ ...queen, abilities: { ...queen.abilities, recall: event.target.checked } })} /> The Recall</label>
      <label><input type="checkbox" checked={queen.abilities.exchange} onChange={(event) => patch({ ...queen, abilities: { ...queen.abilities, exchange: event.target.checked } })} /> The Exchange</label>
      <label><input type="checkbox" checked={queen.continueAfterElimination} onChange={(event) => patch({ ...queen, continueAfterElimination: event.target.checked })} /> Marked-out players may keep answering</label>
      {(["registration", "start", "round2", "deception", "final", "success", "failure"] as const).map((key) => (
        <label className="write" key={key}>{key}<textarea value={dialogue[key]} onChange={(event) => patch({ ...queen, dialogue: { ...dialogue, [key]: event.target.value } })} /></label>
      ))}
    </div>
  );
}
