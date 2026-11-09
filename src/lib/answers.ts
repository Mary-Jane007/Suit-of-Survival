import type { GameDefinition } from "./types";

const QUESTION_FORMATS = new Set([
  "multiple_choice",
  "echo_choice",
  "keywords",
  "host_judge",
  "custom",
  "unanimous",
  "split_clue",
]);

const STOP = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "is", "it", "its", "this", "that",
  "with", "from", "by", "be", "as", "are", "was", "were", "your", "you", "my", "our", "their", "there",
  "here", "just", "only", "not", "but", "if", "so", "do", "does", "did", "what", "which", "who", "where",
  "when", "how", "answer", "please", "i", "we", "they",
]);

const GENERIC = new Set(["box", "key", "door", "line", "number", "word", "option", "choice", "card"]);

const WORD_VALUE: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export function isQuestionFormat(format: string) {
  return QUESTION_FORMATS.has(format);
}

export function cleanAcceptedAnswers(value: unknown) {
  const raw = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim().slice(0, 200);
    const key = normalize(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(trimmed);
    if (lines.length >= 20) break;
  }
  return lines;
}

export function acceptedFor(definition: GameDefinition) {
  const written = cleanAcceptedAnswers(definition.acceptedAnswers ?? []);
  if (written.length) return written;
  const option = definition.options?.find((item) => item.id === definition.correctOptionId);
  return cleanAcceptedAnswers([option?.label, definition.mustEqual, ...(definition.aliases ?? [])].filter(Boolean).join("\n"));
}

export function answerField(definition: GameDefinition) {
  const written = cleanAcceptedAnswers(definition.acceptedAnswers ?? []);
  if (written.length) return written.join("\n");
  return acceptedFor(definition).join("\n");
}

export function answerMatches(written: string, accepted: string[]) {
  const player = canon(written);
  if (!player) return false;
  return accepted.some((answer) => sameIdea(player, canon(answer)));
}

export function answerIsRight(definition: GameDefinition, payload: { choice?: string; text?: string }) {
  const accepted = acceptedFor(definition);
  const text = String(payload.text ?? "").trim();
  if (text && answerMatches(text, accepted)) return true;
  const choice = String(payload.choice ?? "");
  if (!choice) return false;
  const option = definition.options?.find((item) => item.id === choice);
  if (option && accepted.length && answerMatches(option.label, accepted)) return true;
  if (definition.acceptedAnswers?.length) return false;
  return choice === String(definition.correctOptionId ?? "");
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function canon(value: string) {
  let text = normalize(value);
  text = text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety) (one|two|three|four|five|six|seven|eight|nine)\b/g, (_, ten: string, one: string) => String((WORD_VALUE[ten] ?? 0) + (WORD_VALUE[one] ?? 0)));
  text = text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (word) => String(WORD_VALUE[word] ?? word));
  return text.replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return value.split(" ").filter(Boolean);
}

function significant(value: string) {
  return tokens(value).filter((token) => !STOP.has(token));
}

function sameIdea(player: string, key: string) {
  if (!player || !key) return false;
  if (player === key) return true;
  if (/^\d[\d ]*$/.test(player) && /^\d[\d ]*$/.test(key) && player.replace(/ /g, "") === key.replace(/ /g, "")) return true;
  const keyTokens = significant(key);
  if (keyTokens.length && hasPhrase(player, key)) return true;
  if (keyTokens.length && keyTokens.every((token) => covered(token, player))) return true;
  return shortMark(player, key);
}

function hasPhrase(haystack: string, needle: string) {
  return ` ${haystack} `.includes(` ${needle} `);
}

function covered(token: string, text: string) {
  return tokens(text).some((other) => closeToken(token, other));
}

function shortMark(player: string, key: string) {
  const playerTokens = significant(player);
  const keyTokens = significant(key);
  if (playerTokens.length !== 1) return false;
  const mark = playerTokens[0];
  if (!keyTokens.includes(mark)) return false;
  return keyTokens.filter((token) => token !== mark).every((token) => GENERIC.has(token));
}

function closeToken(a: string, b: string) {
  if (a === b) return true;
  const limit = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > limit) return false;
  return levenshtein(a, b) <= limit;
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
