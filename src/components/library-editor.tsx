"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <div className="dock">
        <button className="btn" type="submit">Save</button>
      </div>
      {saved ? <p>Saved. The white page reads these rules.</p> : null}
      <p className="error">{error}</p>
    </form>
  );
}
