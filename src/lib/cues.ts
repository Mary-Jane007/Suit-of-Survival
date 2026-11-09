const OPEN = new Set(["detected", "intro", "rules", "registration"]);

function voice(slug: string, kind: "welcome" | "rules") {
  return `/sounds/voice/${slug}-${kind}.mp3`;
}

export function phaseCues(phase: string, slug: string | null, tone: string | null): string[] | null {
  if (slug === "spades-q" && OPEN.has(phase)) return ["/preview-sounds/game-detected.mp3", "/preview-sounds/game-starts.mp3"];
  if (slug && OPEN.has(phase) && /^[a-z0-9-]+$/.test(slug)) {
    return ["/preview-sounds/game-detected.mp3", "/preview-sounds/game-starts.mp3", voice(slug, "welcome"), voice(slug, "rules")];
  }
  if (phase === "countdown") return ["/preview-sounds/countdown.mp3"];
  if (phase === "results" && tone === "success") return ["/preview-sounds/cleared.mp3", "/preview-sounds/presenter-cleared.mp3"];
  if (phase === "results" && tone === "game_over") return ["/preview-sounds/not-completed.mp3", "/preview-sounds/presenter-not-completed.mp3"];
  return null;
}

export const TEN_SECONDS = "/preview-sounds/ten-seconds.mp3";
export const ANSWER_LOCKED = "/preview-sounds/answer-locked.mp3";
