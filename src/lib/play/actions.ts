"use server";

import { advancePlay, restartTable, revealCard, setPlayStatus, shiftTimer, skipCard, startPlay, stopPlaying, submitMove } from "@/lib/play/service";
import type { ActionState } from "@/lib/types";

async function run(work: () => Promise<{ error?: string; ok?: boolean }>): Promise<ActionState> {
  try {
    const result = await work();
    if (result.error) {
      return { error: result.error };
    }
    return { message: "Saved." };
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "The room did not accept that." };
  }
}

export async function startRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => startPlay(String(formData.get("room") ?? "")));
}

export async function pauseRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => setPlayStatus(String(formData.get("room") ?? ""), "paused"));
}

export async function resumeRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => setPlayStatus(String(formData.get("room") ?? ""), "live"));
}

export async function endRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => setPlayStatus(String(formData.get("room") ?? ""), "ended"));
}

export async function advanceRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => advancePlay(String(formData.get("room") ?? "")));
}

export async function stopRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => stopPlaying(String(formData.get("room") ?? "")));
}

export async function extendTimer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => shiftTimer(String(formData.get("room") ?? ""), 30_000));
}

export async function shortenTimer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => shiftTimer(String(formData.get("room") ?? ""), -15_000));
}

export async function skipRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => skipCard(String(formData.get("room") ?? "")));
}

export async function revealHint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => revealCard(String(formData.get("room") ?? ""), "hint"));
}

export async function revealAnswer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => revealCard(String(formData.get("room") ?? ""), "answer"));
}

export async function restartRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(() => restartTable(String(formData.get("room") ?? "")));
}

export async function answerRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "room") {
      fields[key] = value;
    }
  }
  return run(() => submitMove(String(formData.get("room") ?? ""), fields));
}
