const PUBLIC_KEYS = [
  "kind",
  "player_count",
  "rounds",
  "timer_seconds",
  "scoring",
  "hints",
  "question",
  "physical",
] as const;

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function publicEffect(value: unknown) {
  const source = asObject(value);
  const effect: Record<string, unknown> = {};
  for (const key of PUBLIC_KEYS) {
    if (key in source) {
      effect[key] = source[key];
    }
  }
  return effect;
}

export function effectNumber(effect: Record<string, unknown>, key: string) {
  const value = effect[key];
  return typeof value === "number" ? String(value) : "";
}

export function scoringText(effect: Record<string, unknown>) {
  const scoring = effect.scoring;
  if (!scoring || typeof scoring !== "object") {
    return "";
  }
  return JSON.stringify(scoring, null, 2);
}

export function hintsText(effect: Record<string, unknown>) {
  return Array.isArray(effect.hints) ? effect.hints.filter((hint) => typeof hint === "string").join("\n") : "";
}

export function secretAnswer(secret: unknown) {
  const answer = asObject(secret).answer;
  return typeof answer === "string" ? answer : "";
}
