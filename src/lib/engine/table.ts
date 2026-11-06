function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export type Audience = "board" | "phone" | "room";

const BEAT_MS: Record<string, number> = {
  start: 4000,
  rules: 6000,
  draw: 4000,
  success: 4000,
};

export function playingSeats<T extends { role: string; status: string }>(seats: T[], mode: string) {
  return seats.filter((seat) => {
    if (seat.status !== "active" || seat.role === "board") {
      return false;
    }
    if (mode === "real_life" && seat.role === "host") {
      return false;
    }
    return true;
  });
}

export function shiftDeadline(deadline: string | null, deltaMs: number, now: number) {
  const base = deadline ? Date.parse(deadline) : now;
  const origin = Number.isFinite(base) ? base : now;
  return new Date(Math.max(now, origin + deltaMs)).toISOString();
}

export function remainingSeconds(deadline: string | null, now: number) {
  if (!deadline) {
    return null;
  }
  const ms = Date.parse(deadline) - now;
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.max(0, Math.ceil(ms / 1000));
}

export function hintText(effect: Record<string, unknown>) {
  const hints = effect.hints;
  if (!Array.isArray(hints)) {
    return null;
  }
  const lines = hints.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return lines.length > 0 ? lines.join("\n") : null;
}

export function releasedHint(hint: string | null, revealed: boolean) {
  if (!revealed || !hint) {
    return null;
  }
  return hint;
}

export function releasedAnswer(answer: string | null, revealed: boolean, audience: Audience, isHost: boolean) {
  if (!revealed || !answer) {
    return null;
  }
  if (audience === "phone") {
    return null;
  }
  if (audience === "room" && !isHost) {
    return null;
  }
  return answer;
}

export function physicalCopy(effect: Record<string, unknown>) {
  const physical = asObject(effect.physical);
  return {
    optional: physical.optional === true,
    phone: typeof physical.phone === "string" && physical.phone.trim() ? physical.phone.trim() : null,
  };
}

export function beatTrigger(beat: string) {
  if (beat === "start") return "started";
  if (beat === "rules") return "rules";
  if (beat === "draw") return "card_drawn";
  if (beat === "pause") return "paused";
  if (beat === "success") return "success";
  if (beat === "game_over") return "game_over";
  return null;
}

function stepBeat(beat: string, until: number | null, now: number) {
  if (beat === "pause" || beat === "game_over" || beat === "play" || beat === "") {
    return { beat, until };
  }
  if (until === null || now < until) {
    return { beat, until };
  }
  if (beat === "start") return { beat: "rules", until: now + BEAT_MS.rules };
  if (beat === "rules") return { beat: "draw", until: now + BEAT_MS.draw };
  if (beat === "draw") return { beat: "play", until: null };
  if (beat === "success") return { beat: "draw", until: now + BEAT_MS.draw };
  return { beat: "play", until: null };
}

export function advanceBeat(beat: string, until: number | null, now: number) {
  let current = beat;
  let end = until;
  for (let guard = 0; guard < 6; guard += 1) {
    const next = stepBeat(current, end, now);
    if (next.beat === current && next.until === end) {
      return next;
    }
    current = next.beat;
    end = next.until;
  }
  return { beat: current, until: end };
}

export const SKIP_MESSAGE = "The host skipped this card. No score is written.";
