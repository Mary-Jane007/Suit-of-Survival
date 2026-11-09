"use client";

import { useEffect, useState } from "react";
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

let ctx: AudioContext | null = null;
let token = 0;
let pending: string[] | null = null;
let node: AudioBufferSourceNode | null = null;
const cache = new Map<string, AudioBuffer>();

function context() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

function flush() {
  if (!ctx || ctx.state !== "running" || !pending) return;
  const urls = pending;
  pending = null;
  void playChain(urls);
}

export function unlockSound() {
  const audio = context();
  if (!audio) return;
  if (audio.state !== "running") void audio.resume().then(flush);
  if (audio.state === "running") flush();
}

async function load(url: string) {
  const audio = context();
  if (!audio) throw new Error("no audio");
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  const buf = await audio.decodeAudioData(await res.arrayBuffer());
  cache.set(url, buf);
  return buf;
}

function playOne(url: string, mine: number) {
  const audio = context();
  return new Promise<void>((resolve) => {
    if (!audio || mine !== token) {
      resolve();
      return;
    }
    load(url)
      .then((buf) => {
        if (mine !== token || audio.state !== "running") {
          resolve();
          return;
        }
        const src = audio.createBufferSource();
        src.buffer = buf;
        src.connect(audio.destination);
        node = src;
        src.onended = () => resolve();
        src.start();
      })
      .catch(() => resolve());
  });
}

export async function playChain(urls: string[]) {
  const audio = ctx;
  if (!audio || audio.state !== "running") {
    pending = urls;
    return;
  }
  try { node?.stop(); } catch { /* already ended */ }
  const mine = ++token;
  for (const url of urls) {
    if (mine !== token) return;
    await playOne(url, mine);
  }
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

export function TableSound({ room, mode }: { room: Hear; mode: "phone" | "screen" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!room.sound || mode !== "screen") return;
    const arm = () => {
      unlockSound();
      setArmed(true);
    };
    window.addEventListener("pointerdown", arm);
    return () => window.removeEventListener("pointerdown", arm);
  }, [room.sound, mode]);

  useEffect(() => {
    if (!room.sound || mode !== "screen") return;
    const cues = phaseCues(room.phase, room.slug, room.tone);
    if (!cues) return;
    const key = `${room.code}:${room.slug ?? "table"}:${room.phase === "countdown" || room.phase === "results" ? room.phase : "open"}:${room.tone ?? ""}`;
    if (heard(key)) return;
    void playChain(cues);
    markHeard(key);
  }, [room.sound, room.code, room.phase, room.slug, room.tone, mode]);

  useEffect(() => {
    if (!room.sound || mode !== "screen" || room.phase !== "playing" || room.paused || room.deadline == null) return;
    const left = room.deadline - room.now;
    const key = `${room.code}:${room.slug ?? "table"}:${room.round}:ten`;
    if (left > 10000 || left <= 500 || heard(key)) return;
    void playChain([TEN_SECONDS]);
    markHeard(key);
  }, [room.sound, room.code, room.phase, room.paused, room.deadline, room.now, room.slug, room.round, mode]);

  if (!room.sound || mode !== "screen" || armed) return null;
  return (
    <button className="sound-arm" type="button" onClick={() => { unlockSound(); setArmed(true); }}>
      Tap for sound
    </button>
  );
}

export function playAnswerLocked() {
  pending = [ANSWER_LOCKED];
  unlockSound();
}
