import type { GameDefinition, Suit } from "./types";
import { RANK_NAME, SUIT_NAME, SUIT_SYMBOL } from "./types";

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value == null) return fallback;
  return value as T;
}

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

const SECRET_KEYS = new Set([
  "correctOptionId",
  "acceptedAnswers",
  "keywordGroups",
  "sequence",
  "doors",
  "aliases",
  "mustEqual",
  "answerReveal",
  "wolf",
  "fragments",
  "hint",
  "equation",
]);

export function publicDefinition(definition: GameDefinition) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(definition)) {
    if (!SECRET_KEYS.has(key)) copy[key] = value;
  }
  return copy;
}

export function cardTitle(suit: string, rank: string) {
  const symbol = SUIT_SYMBOL[suit as Suit] ?? "";
  const rankName = RANK_NAME[rank] ?? rank;
  const suitName = SUIT_NAME[suit as Suit] ?? suit.toUpperCase();
  return `${symbol} ${rankName} OF ${suitName}`;
}

export const DEFAULT_THEME = {
  bg: "#090909",
  panel: "#121212",
  fg: "#f4f1ea",
  red: "#c4161c",
  muted: "#9a958c",
  displayFont: "Oswald",
  bodyFont: "Outfit",
  glitch: true,
  scanlines: true,
  background: "",
};

export const DEFAULT_SETTINGS = {
  benchThreshold: -20,
  benchingEnabled: true,
  benchLocksPlay: false,
  awardCardOn: "success",
  maxPlayers: 16,
  registrationSeconds: 20,
  countdownSeconds: 5,
  soundEnabled: true,
  handSize: 4,
  theme: DEFAULT_THEME,
  suits: {
    spades: "Physical, kept safe. Memory, observation, and optional seated movement. Difficulty changes the clock, never the risk.",
    hearts: "Trust, bluffing, and choices. No secrets, no humiliation, no real-world consequence.",
    diamonds: "Logic, patterns, numbers, and deduction.",
    clubs: "A shared answer. Someone at the table is holding the piece you need.",
  },
};

export function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function cleanImage(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Image was not a file.");
  if (value.length > 180000) throw new Error("Image must stay under 150KB.");
  if (/^https:\/\/[^\s]+$/.test(value)) return value;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value.replace(/\s/g, "");
  throw new Error("Use a PNG, JPEG, WEBP, or GIF.");
}
