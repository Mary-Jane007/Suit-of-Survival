import { randomUUID } from "node:crypto";
import { CATALOG } from "./catalog";
import { sql } from "./db";
import { DEFAULT_SETTINGS } from "./present";
import { RANKS, SUITS, type Rank, type Suit } from "./types";

const RANK_LABEL: Record<string, string> = {
  A: "Ace — special",
  "2": "Two — slight",
  "3": "Three — light",
  "4": "Four — moderate",
  "5": "Five — involved",
  "6": "Six — pressing",
  "7": "Seven — severe",
  "8": "Eight — harsh",
  "9": "Nine — extreme",
  "10": "Ten — the edge of the numbers",
  J: "Jack — face",
  Q: "Queen — face",
  K: "King — face",
};

const RANK_BLURB: Record<string, string> = {
  A: "A special card. The owner decides what an ace means. It is not automatically the hardest number.",
  "2": "A short challenge. Enough to bring the table in.",
  "3": "Still gentle. One clear task.",
  "4": "A real problem, with time to talk.",
  "5": "The middle of the deck. Pay attention.",
  "6": "The clock starts to matter.",
  "7": "Several moving parts.",
  "8": "Little room for a second reading.",
  "9": "High pressure. Still only points.",
  "10": "The hardest number in the suit.",
  J: "A face card. More steps than a number, and usually more than one player has a job.",
  Q: "A face card. Narrative, judgment, or a longer cooperation.",
  K: "A face card. A set piece. Several rounds, or the whole table at once.",
};

function difficulty(rank: string) {
  if (rank === "A") return 14;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return Number(rank);
}

const REPS = [
  {
    id: "iris",
    name: "Iris",
    suit: "diamonds",
    portrait_key: "iris",
    accent: "#8ecbff",
    personality: "Precise, unhurried, and unimpressed. She treats a wrong answer as information.",
    style: "Short sentences. No warmth, and no cruelty.",
    intro: "Diamonds. The room is quiet enough to think. Use it.",
    rules_line: "I will read the conditions once. After that, they stay where you can see them.",
    start_line: "The clock is live.",
    success_line: "Clear. The pattern held.",
    failure_line: "The pattern did not hold. The score changes. Nothing else does.",
    special_line: "Look again. The answer is a method, not a guess.",
  },
  {
    id: "solene",
    name: "Solene",
    suit: "hearts",
    portrait_key: "solene",
    accent: "#e23b3b",
    personality: "Calm and direct. She will not ask anyone to bleed for a point.",
    style: "Soft voice, hard edges. She names the choice and the cost.",
    intro: "Hearts. This is a game of choices, not of wounds. No one here owes a secret.",
    rules_line: "Listen to the cost before you choose. You can refuse the game itself.",
    start_line: "Choose. The table will live with it.",
    success_line: "The choice cleared. Take the points, and leave the story here.",
    failure_line: "The choice cost you points. That is the whole of it.",
    special_line: "If the game asks for a secret, it is the wrong game. Tell something trivial.",
  },
  {
    id: "halden",
    name: "Halden",
    suit: "clubs",
    portrait_key: "halden",
    accent: "#d6b25e",
    personality: "Steady. He speaks as if the table were one player with several mouths.",
    style: "Plain and collective. He uses we.",
    intro: "Clubs. No one clears this alone. Say what you are holding.",
    rules_line: "Your fragment is useless until someone else can use it.",
    start_line: "Begin. Talk on purpose.",
    success_line: "The table held. That is the only way this suit clears.",
    failure_line: "The pieces did not meet. Sit with that, then draw again.",
    special_line: "If you are stuck, say the fragment out loud.",
  },
  {
    id: "queen-spades",
    name: "Queen of Spades",
    suit: "spades",
    portrait_key: "queen",
    accent: "#f4f1ea",
    personality: "Still and exact. She never raises her voice. The mark is a courtesy, not a claim.",
    style: "Short, formal, and impossible to hurry. She does not repeat herself.",
    intro: "Queen of Spades. Your memory is your only defense.",
    rules_line: "I will not repeat myself. The mark is gentle, or it is only a place you are shown.",
    start_line: "Pay attention. Every detail matters. Nothing will be repeated.",
    success_line: "Your memory has proven sufficient. You have successfully completed the game.",
    failure_line: "The Queen has prevailed. The challenge has ended.",
    special_line: "Are you certain that your memory serves you well?",
  },
  {
    id: "ren",
    name: "Ren",
    suit: "spades",
    portrait_key: "ren",
    accent: "#f4f1ea",
    personality: "A coach who refuses heroics. The body is not a score.",
    style: "Instructional, firm, and specific about what not to do.",
    intro: "Spades. Move only as far as the chair allows. Stop the moment you wish.",
    rules_line: "The phone is the score. Any movement I describe is optional.",
    start_line: "Eyes up. The clock is the only pressure.",
    success_line: "Clear. Sit back.",
    failure_line: "Not this time. The score moved. You did not have to.",
    special_line: "If a rule asks you to run, climb, or cover your eyes, ignore it and tell me.",
  },
  {
    id: "herald",
    name: "The Herald",
    suit: null,
    portrait_key: "herald",
    accent: "#c4161c",
    personality: "The voice of the room. No suit, no favorite.",
    style: "Formal. Announces the state of the game and nothing more.",
    intro: "The game has begun.",
    rules_line: "Registration is a choice. When it closes, the challenge starts.",
    start_line: "Players are entered. Begin.",
    success_line: "The session records a clear.",
    failure_line: "The session records a miss. The night continues.",
    special_line: "You may leave the table whenever you wish.",
  },
];

const ANNOUNCEMENTS: { key: string; kicker: string; title: string; body: string }[] = [
  { key: "registration_open", kicker: "REGISTRATION OPEN", title: "{game}", body: "Step in on your phone. The table closes in {seconds} seconds. {representative} is watching." },
  { key: "registration_close", kicker: "REGISTRATION CLOSED", title: "THE TABLE IS SET", body: "{players} players are entered. Everyone else will watch this one." },
  { key: "card_detected", kicker: "GAME DETECTED", title: "{card}", body: "{game}. Difficulty {difficulty}. The representative is {representative}." },
  { key: "card_reveal", kicker: "CARD REVEALED", title: "{card}", body: "{game} is live in the arena." },
  { key: "representative_intro", kicker: "{representative}", title: "{card}", body: "{line}" },
  { key: "rules", kicker: "CONDITIONS", title: "{game}", body: "{line}" },
  { key: "countdown", kicker: "STARTING", title: "{seconds}", body: "The challenge begins when the count ends." },
  { key: "game_started", kicker: "GAME STARTED", title: "{game}", body: "{line}" },
  { key: "round_completed", kicker: "ROUND CLOSED", title: "ROUND {round}", body: "The table moves on." },
  { key: "time_warning", kicker: "TIME", title: "TEN SECONDS", body: "The clock is almost done." },
  { key: "hint_revealed", kicker: "HINT", title: "A DOOR OPENS", body: "The representative has allowed a hint." },
  { key: "paused", kicker: "PAUSED", title: "THE CLOCK IS HELD", body: "Nothing is due while the room is paused." },
  { key: "resumed", kicker: "RESUMED", title: "THE CLOCK RETURNS", body: "Continue." },
  { key: "success", kicker: "SUCCESSFULLY COMPLETED", title: "{game}", body: "{line}" },
  { key: "game_over", kicker: "GAME OVER", title: "{game}", body: "{line} The result is a score. There is no other consequence." },
  { key: "final_results", kicker: "RESULTS", title: "{game}", body: "The table is split. Scores are on the screen." },
  { key: "session_completed", kicker: "SESSION COMPLETE", title: "THE ARENA CLOSES", body: "Room {code} is finished. The cards you cleared stay in your collection." },
];

const ACHIEVEMENTS = [
  { id: "first-clear", name: "First clear", description: "Clear any challenge.", rule: { type: "clears", count: 1 } },
  { id: "five-clears", name: "Five cards", description: "Clear five different challenges.", rule: { type: "clears", count: 5 } },
  { id: "suit-diamonds", name: "Diamond mind", description: "Clear every Diamond.", rule: { type: "suit", suit: "diamonds", count: 13 } },
  { id: "suit-hearts", name: "Open heart", description: "Clear every Heart.", rule: { type: "suit", suit: "hearts", count: 13 } },
  { id: "suit-clubs", name: "Full table", description: "Clear every Club.", rule: { type: "suit", suit: "clubs", count: 13 } },
  { id: "suit-spades", name: "Last spade", description: "Clear every Spade.", rule: { type: "suit", suit: "spades", count: 13 } },
  { id: "balance", name: "On the scale", description: "Clear Balance Scale.", rule: { type: "slug", slug: "diamonds-k" } },
];

let pending: Promise<void> | null = null;

export function ready() {
  pending ??= seed().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function seed() {
  await sql("select 1");
  for (const rep of REPS) {
    await sql(
      `insert into representatives
        (id, name, suit, portrait_key, personality, style, intro, rules_line, start_line, success_line, failure_line, special_line, accent)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (id) do nothing`,
      [rep.id, rep.name, rep.suit, rep.portrait_key, rep.personality, rep.style, rep.intro, rep.rules_line, rep.start_line, rep.success_line, rep.failure_line, rep.special_line, rep.accent],
    );
  }
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      await sql(
        `insert into cards (id, suit, rank, difficulty, special, difficulty_label, description)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (suit, rank) do nothing`,
        [`${suit}-${rank}`, suit, rank, difficulty(rank), ["A", "J", "Q", "K"].includes(rank), RANK_LABEL[rank], RANK_BLURB[rank]],
      );
    }
  }
  for (const entry of CATALOG) {
    const rep = entry.slug === "spades-q" ? "queen-spades" : entry.suit === "diamonds" ? "iris" : entry.suit === "hearts" ? "solene" : entry.suit === "clubs" ? "halden" : "ren";
    await sql(
      `insert into games
        (id, slug, source, name, description, suit, rank, difficulty, representative_id, min_players, max_players,
         duration_seconds, materials, rules, rules_original, instructions, objective, win_condition, fail_condition,
         scoring_summary, rounds, timer_seconds, status, visibility, format, definition, safety_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'published','public',$23,$24::jsonb,$25)
       on conflict (slug) do nothing`,
      [
        randomUUID(),
        entry.slug,
        entry.source,
        entry.name,
        entry.description,
        entry.suit,
        entry.rank,
        difficulty(entry.rank),
        rep,
        entry.min,
        entry.max,
        entry.timer,
        entry.materials,
        entry.rules,
        entry.rulesOriginal,
        entry.instructions,
        entry.objective,
        entry.win,
        entry.fail,
        entry.scoring,
        entry.rounds,
        entry.timer,
        entry.definition.format,
        JSON.stringify(entry.definition),
        entry.safety,
      ],
    );
  }
  for (const item of ANNOUNCEMENTS) {
    await sql(
      `insert into announcements (key, kicker, title_template, body_template) values ($1,$2,$3,$4)
       on conflict (key) do nothing`,
      [item.key, item.kicker, item.title, item.body],
    );
  }
  await sql(
    `insert into app_settings (key, value) values ('game',$1::jsonb) on conflict (key) do nothing`,
    [JSON.stringify(DEFAULT_SETTINGS)],
  );
  for (const achievement of ACHIEVEMENTS) {
    await sql(
      `insert into achievements (id, name, description, rule) values ($1,$2,$3,$4::jsonb) on conflict (id) do nothing`,
      [achievement.id, achievement.name, achievement.description, JSON.stringify(achievement.rule)],
    );
  }
  await installQueenCard();
  const settingsRows = await sql<{ value: unknown }>("select value from app_settings where key = 'game'");
  const stored = settingsRows[0]?.value;
  const settings = typeof stored === "string" ? JSON.parse(stored) as { maxPlayers?: number } : (stored as { maxPlayers?: number } | undefined);
  if (settings && Number(settings.maxPlayers ?? 0) < 16) {
    settings.maxPlayers = 16;
    await sql("update app_settings set value = $1::jsonb where key = 'game'", [JSON.stringify(settings)]);
  }
}

async function installQueenCard() {
  const queen = CATALOG.find((entry) => entry.slug === "spades-q");
  if (!queen) return;
  const current = await sql<{ format: string }>("select format from games where slug = 'spades-q'");
  if (current[0] && current[0].format !== "queens_touch") {
    await sql(
      `update games set name=$1, description=$2, rules=$3, instructions=$4, objective=$5, win_condition=$6, fail_condition=$7,
        scoring_summary=$8, materials=$9, min_players=$10, max_players=$11, timer_seconds=$12, duration_seconds=$12, rounds=$13,
        format=$14, definition=$15::jsonb, safety_note=$16, representative_id='queen-spades', updated_at=now()
       where slug='spades-q'`,
      [
        queen.name,
        queen.description,
        queen.rules,
        queen.instructions,
        queen.objective,
        queen.win,
        queen.fail,
        queen.scoring,
        queen.materials,
        queen.min,
        queen.max,
        queen.timer,
        queen.rounds,
        queen.definition.format,
        JSON.stringify(queen.definition),
        queen.safety,
      ],
    );
  }
  await sql(
    `update cards set description=$2, difficulty_label=$3 where id='spades-Q' and description=$1`,
    [RANK_BLURB.Q, "The Queen's Touch. One player is chosen as the Queen. Memory is the challenge.", "Queen — extreme"],
  );
}

export function repForSuit(suit: Suit | string) {
  if (suit === "hearts") return "solene";
  if (suit === "clubs") return "halden";
  if (suit === "spades") return "ren";
  if (suit === "diamonds") return "iris";
  return "herald";
}

export function rankWeight(rank: Rank | string) {
  return difficulty(rank);
}
