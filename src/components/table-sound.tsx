"use client";

import { useEffect } from "react";
import { ANSWER_LOCKED, TEN_SECONDS, phaseCues } from "@/lib/cues";

type Hear = {
  sound: boolean;
  code: string;
  phase: string;
  paused: boolean;
  now: number;
  deadline: number | null;
  slug: string | null;
  tone: string | null;
  round: number;
};

let token = 0;
let current: HTMLAudioElement | null = null;
const started = new Set<string>();

export function primeSound() {
  const el = new Audio("/sounds/silence.mp3");
  void el.play().catch(() => {});
}

export async function playChain(urls: string[]) {
  const mine = ++token;
  try { current?.pause(); } catch { /* already ended */ }
  for (const url of urls) {
    if (mine !== token) return true;
    const el = new Audio(url);
    current = el;
    try {
      await el.play();
    } catch {
      return false;
    }
    await new Promise<void>((resolve) => {
      el.onended = () => resolve();
      el.onerror = () => resolve();
      el.onpause = () => { if (mine !== token) resolve(); };
    });
  }
  return true;
}

function heard(key: string) {
  const raw = sessionStorage.getItem("sos-heard") ?? "";
  return raw.split("|").includes(key);
}

function markHeard(key: string) {
  const prev = (sessionStorage.getItem("sos-heard") ?? "").split("|").filter(Boolean);
  prev.push(key);
  sessionStorage.setItem("sos-heard", prev.slice(-48).join("|"));
}

function begin(key: string, urls: string[]) {
  if (heard(key) || started.has(key)) return;
  started.add(key);
  void playChain(urls).then((ok) => {
    if (ok) markHeard(key);
    else started.delete(key);
  });
}

export function TableSound({ room, mode }: { room: Hear; mode: "phone" | "screen" }) {
  useEffect(() => {
    if (!room.sound || mode !== "screen") return;
    const cues = phaseCues(room.phase, room.slug, room.tone);
    if (!cues) return;
    const key = `${room.code}:${room.slug ?? "table"}:${room.phase === "countdown" || room.phase === "results" ? room.phase : "open"}:${room.tone ?? ""}`;
    begin(key, cues);
  }, [room.sound, room.code, room.phase, room.slug, room.tone, room.now, mode]);

  useEffect(() => {
    if (!room.sound || mode !== "screen" || room.phase !== "playing" || room.paused || room.deadline == null) return;
    const left = room.deadline - room.now;
    if (left > 10000 || left <= 500) return;
    begin(`${room.code}:${room.slug ?? "table"}:${room.round}:ten`, [TEN_SECONDS]);
  }, [room.sound, room.code, room.phase, room.paused, room.deadline, room.now, room.slug, room.round, mode]);

  return null;
}

export function playAnswerLocked() {
  void playChain([ANSWER_LOCKED]);
}
