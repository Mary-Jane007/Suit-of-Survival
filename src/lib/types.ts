export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export const FORMATS = [
  "multiple_choice",
  "keywords",
  "host_judge",
  "custom",
  "sequence",
  "pattern_doors",
  "number_contest",
  "role_consensus",
  "deduction_wolf",
  "transfer",
  "pending_trust",
  "pending_guess",
  "pending_alliance",
  "pending_risk",
  "intuition",
  "trade",
  "chain",
  "bluff_story",
  "forehead",
  "echo_choice",
  "split_clue",
  "reaction",
  "order_coop",
  "word_chain",
  "unanimous",
  "queens_touch",
] as const;
export type Format = (typeof FORMATS)[number];

export const AVATARS = ["mark", "ring", "slash", "crest", "signal", "veil", "axis", "glyph"] as const;
export type AvatarId = (typeof AVATARS)[number];

export const FONT_CHOICES = [
  "Oswald",
  "Outfit",
  "Cinzel",
  "IBM Plex Mono",
] as const;

export type CardName = { id: string; label: string; suit: Suit; rank: string };

export type GameDefinition = {
  format?: Format | string;
  timerSeconds?: number;
  rounds?: number;
  hint?: string;
  answerReveal?: string;
  successPoints?: number;
  failPoints?: number;
  prompt?: string;
  options?: { id: string; label: string }[];
  correctOptionId?: string;
  acceptedAnswers?: string[];
  keywordGroups?: string[][];
  sequence?: string[];
  sequenceLabels?: Record<string, string>;
  memorizeMs?: number;
  stepMs?: number;
  doors?: {
    walls: string[];
    start: Record<string, "life" | "end">;
    lifeShift: number;
    endShift: number;
    rounds: number;
    lifePoints: number;
    endPoints: number;
  };
  contest?: {
    min: number;
    max: number;
    factor: number;
    winPoints: number;
    losePoints: number;
    rounds: number;
  };
  roles?: { id: string; label: string; points: number; blurb: string }[];
  disagreementPoints?: number;
  wolf?: {
    targetPoints: number;
    wolfCaught: number;
    wolfClear: number;
    protectOtherCost: number;
  };
  transfer?: { amount: number };
  pendingPoints?: { hit: number; miss: number; bothFail?: number; oneFail?: number };
  pairPoints?: number;
  chain?: { returnedPoints: number; passedPoints: number };
  bluff?: { fooledPoints: number; caughtPoints: number };
  forehead?: { correct: number; wrong: number; mislead: number };
  fragments?: string[];
  aliases?: string[];
  flashes?: number;
  windowMs?: number;
  pointsEach?: number;
  chainPoints?: number;
  mustEqual?: string;
  input?: "text" | "number";
  safety?: string;
  needsActor?: boolean;
  queen?: QueenSettings;
};

export type QueenSettings = {
  locations: { id: string; label: string }[];
  movements: string[];
  movementCount: number;
  questionsPerRound: number[];
  allowedMistakes: number;
  continueAfterElimination: boolean;
  memorizeSeconds: number;
  difficultyLabel: string;
  abilities: { deception: boolean; recall: boolean; exchange: boolean };
  dialogue: {
    registration: string;
    start: string;
    round2: string;
    deception: string;
    final: string;
    success: string;
    failure: string;
  };
};

export type PlayerRef = { id: string; username: string; playing: boolean };

export type Runtime = {
  format: string;
  round: number;
  rounds: number;
  phase: "live" | "feedback" | "complete";
  startedAt: number;
  deadline: number | null;
  pausedRemaining: number | null;
  hintLevel: 0 | 1 | 2;
  players: PlayerRef[];
  secret: Record<string, unknown>;
  submissions: Record<string, Record<string, Record<string, unknown>>>;
  scores: Record<string, number>;
  success: Record<string, boolean>;
  reasons: Record<string, string>;
  log: string[];
  feedback: string | null;
  extra: Record<string, unknown>;
  config: GameDefinition;
  completeTone?: "success" | "fail" | "mixed";
  summary?: string;
  pending?: PendingDraft[];
};

export type PendingDraft = {
  kind: "trust" | "guess" | "alliance" | "risk";
  actorId: string;
  targetId: string;
  suit?: string;
  hit: number;
  miss: number;
  bothFail?: number;
  oneFail?: number;
};

export type PlayInput =
  | { kind: "choice"; options: { id: string; label: string }[] }
  | { kind: "text"; placeholder: string }
  | { kind: "number"; min: number; max: number }
  | { kind: "order"; pool: { id: string; label: string }[] }
  | { kind: "players"; people: { id: string; label: string }[] }
  | { kind: "doors"; walls: string[] }
  | { kind: "roles"; roles: { id: string; label: string; blurb: string; points: number }[] }
  | { kind: "boolean"; trueLabel: string; falseLabel: string }
  | { kind: "accept" }
  | { kind: "tap"; label: string }
  | { kind: "wait"; message: string }
  | { kind: "judge"; entries: { id: string; name: string; text: string; marked: string | null }[] }
  | { kind: "suits" }
  | { kind: "pair"; cards: { id: string; label: string }[]; recommendation: string }
  | { kind: "story" };

export type PlayView = {
  format: string;
  round: number;
  rounds: number;
  phase: "live" | "feedback" | "complete";
  deadline: number | null;
  paused: boolean;
  prompt: string;
  subprompt: string;
  input: PlayInput;
  submitted: boolean;
  feedback: string | null;
  progress: { id: string; name: string; done: boolean }[];
  hint: string | null;
  revealed: string | null;
  board: Record<string, unknown> | null;
  yourScore: number;
  hostPanel: Extract<PlayInput, { kind: "judge" }> | null;
};

export type Outcome = { userId: string; delta: number; success: boolean; reason: string };

export const SAFETY_BANNER =
  "Recreational game only. Points, benching, and failure are digital. No one is asked to take a risk, share a private secret, or keep playing. You can stop at any time.";

export const RANK_NAME: Record<string, string> = {
  A: "ACE",
  "2": "TWO",
  "3": "THREE",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "8": "EIGHT",
  "9": "NINE",
  "10": "TEN",
  J: "JACK",
  Q: "QUEEN",
  K: "KING",
};

export const SUIT_NAME: Record<Suit, string> = {
  spades: "SPADES",
  hearts: "HEARTS",
  diamonds: "DIAMONDS",
  clubs: "CLUBS",
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
