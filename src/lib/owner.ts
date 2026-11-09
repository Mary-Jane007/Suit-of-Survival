import { randomUUID } from "node:crypto";
import type { Account } from "./auth";
import { sql } from "./db";
import { cleanAcceptedAnswers, isQuestionFormat } from "./answers";
import { cleanQueenSettings } from "./queen";
import { cleanImage, parseJson, safeColor, DEFAULT_THEME } from "./present";
import { ready, rankWeight } from "./seed";
import { FONT_CHOICES, FORMATS, RANKS, SUITS } from "./types";

function owner(account: Account | null): asserts account is Account {
  if (!account || account.role !== "owner") throw new Error("Owner only.");
}

function text(value: unknown, max: number, fallback = "") {
  const raw = String(value ?? fallback).slice(0, max);
  return raw;
}

function bounded(value: unknown, fallback: number, low: number, high: number) {
  const parsed = Number(value ?? fallback);
  const count = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  return Math.max(low, Math.min(high, count));
}

export async function overview(account: Account | null) {
  owner(account);
  await ready();
  const [players, games, sessions, clears, active, activity] = await Promise.all([
    sql<{ n: string }>("select count(*)::text as n from users"),
    sql<{ n: string }>("select count(*)::text as n from games"),
    sql<{ n: string }>("select count(*)::text as n from game_sessions"),
    sql<{ n: string }>("select count(*)::text as n from collections"),
    sql("select code, phase, created_at from game_sessions where closed_at is null order by created_at desc limit 1"),
    sql("select message, created_at from activity order by created_at desc limit 12"),
  ]);
  return {
    players: Number(players[0]?.n ?? 0),
    games: Number(games[0]?.n ?? 0),
    sessions: Number(sessions[0]?.n ?? 0),
    clears: Number(clears[0]?.n ?? 0),
    active: active[0] ?? null,
    activity,
  };
}

export async function manage(account: Account | null, action: string, body: Record<string, unknown>) {
  owner(account);
  await ready();
  if (action === "games") {
    return sql(
      `select id, slug, source, name, suit, rank, status, format, min_players, max_players, timer_seconds
       from games order by suit, difficulty, name`,
    );
  }
  if (action === "game") {
    const rows = await sql("select * from games where id = $1", [body.id]);
    return rows[0] ?? null;
  }
  if (action === "save-game") return saveGame(body);
  if (action === "duplicate-game") return duplicateGame(String(body.id ?? ""));
  if (action === "delete-game") return deleteGame(String(body.id ?? ""));
  if (action === "cards") return sql("select * from cards order by suit, difficulty");
  if (action === "save-writing") return saveWriting(body);
  if (action === "save-card") return saveCard(body);
  if (action === "representatives") return sql("select * from representatives order by name");
  if (action === "save-representative") return saveRep(body);
  if (action === "players") {
    return sql(
      `select u.id, u.username, u.role, u.avatar, u.created_at,
              coalesce(sum(s.delta),0)::int as score,
              (select count(*)::int from collections c where c.user_id = u.id) as cards
       from users u left join score_events s on s.user_id = u.id
       group by u.id order by u.created_at desc`,
    );
  }
  if (action === "sessions") {
    return sql(
      `select s.code, s.phase, s.play_style, s.created_at, s.closed_at, u.username as host,
              (select count(*)::int from participants p where p.session_id = s.id and p.kicked = false) as players
       from game_sessions s join users u on u.id = s.host_user_id
       order by s.created_at desc limit 40`,
    );
  }
  if (action === "announcements") return sql("select * from announcements order by key");
  if (action === "save-announcement") {
    await sql(
      "update announcements set kicker = $2, title_template = $3, body_template = $4, enabled = $5 where key = $1",
      [text(body.key, 40), text(body.kicker, 80), text(body.title, 160), text(body.body, 600), body.enabled !== false],
    );
    return { ok: true };
  }
  if (action === "settings") {
    const rows = await sql<{ value: unknown }>("select value from app_settings where key = 'game'");
    return parseJson(rows[0]?.value, {});
  }
  if (action === "save-settings") return saveSettings(body);
  throw new Error("Unknown owner action.");
}

async function saveWriting(body: Record<string, unknown>) {
  const id = text(body.id, 80);
  if (!id) throw new Error("Choose a card.");
  const existing = await sql<{ definition: unknown; format: string; min_players: number; max_players: number; timer_seconds: number }>(
    "select definition, format, min_players, max_players, timer_seconds from games where id = $1 and status = 'published'",
    [id],
  );
  if (!existing[0]) throw new Error("That card is not in the library.");
  const definition = parseJson<Record<string, unknown>>(existing[0].definition, {});
  const queenCard = existing[0].format === "queens_touch" && body.queen && typeof body.queen === "object";
  if (queenCard) {
    definition.queen = cleanQueenSettings(body.queen);
    definition.successPoints = Math.max(-20, Math.min(50, Number(body.successPoints ?? definition.successPoints ?? 5)));
    definition.failPoints = Math.max(-20, Math.min(50, Number(body.failPoints ?? definition.failPoints ?? -2)));
    definition.rounds = Math.max(1, Math.min(5, Number(body.rounds ?? definition.rounds ?? 5)));
  }
  if (isQuestionFormat(existing[0].format) && typeof body.answers === "string") {
    const answers = cleanAcceptedAnswers(body.answers);
    if (answers.length) definition.acceptedAnswers = answers;
    else delete definition.acceptedAnswers;
  }
  const minPlayers = bounded(body.minPlayers, Number(existing[0].min_players ?? 1), 1, 16);
  const maxPlayers = bounded(body.maxPlayers, Number(existing[0].max_players ?? minPlayers), minPlayers, 16);
  const timerSeconds = bounded(body.timerSeconds, Number(existing[0].timer_seconds ?? 60), 5, 3600);
  definition.timerSeconds = timerSeconds;
  const rounds = Math.max(1, Math.min(5, Number(body.rounds ?? 5)));
  const fields = [
    id,
    text(body.name, 80) || "Untitled challenge",
    text(body.description, 400),
    text(body.rules, 4000),
    text(body.rulesOriginal, 4000),
    text(body.instructions, 2000),
    text(body.objective, 400),
    text(body.win, 400),
    text(body.fail, 400),
    text(body.scoring, 400),
    text(body.materials, 200),
    text(body.safety, 400),
    JSON.stringify(definition),
  ];
  const updated = queenCard
    ? await sql(
        `update games set name=$2, description=$3, rules=$4, rules_original=$5, instructions=$6, objective=$7,
          win_condition=$8, fail_condition=$9, scoring_summary=$10, materials=$11, safety_note=$12,
          definition=$13::jsonb, min_players=$14, max_players=$15, timer_seconds=$16, duration_seconds=$16, rounds=$17, updated_at=now()
         where id=$1 and status='published' returning id`,
        [...fields, minPlayers, maxPlayers, timerSeconds, rounds],
      )
    : await sql(
        `update games set name=$2, description=$3, rules=$4, rules_original=$5, instructions=$6, objective=$7,
          win_condition=$8, fail_condition=$9, scoring_summary=$10, materials=$11, safety_note=$12,
          definition=$13::jsonb, min_players=$14, max_players=$15, timer_seconds=$16, duration_seconds=$16, updated_at=now()
         where id=$1 and status='published' returning id`,
        [...fields, minPlayers, maxPlayers, timerSeconds],
      );
  if (!updated[0]) throw new Error("That card is not in the library.");
  return { id };
}

async function saveGame(body: Record<string, unknown>) {
  const suit = String(body.suit ?? "");
  const rank = String(body.rank ?? "");
  const format = String(body.format ?? "host_judge");
  if (!(SUITS as readonly string[]).includes(suit)) throw new Error("Choose a suit.");
  if (!(RANKS as readonly string[]).includes(rank)) throw new Error("Choose a rank.");
  if (!(FORMATS as readonly string[]).includes(format)) throw new Error("Choose a format.");
  const definition = body.definition && typeof body.definition === "object" ? body.definition : {};
  const image = cleanImage(body.image);
  const fields = [
    text(body.name, 80) || "Untitled challenge",
    text(body.description, 400),
    suit,
    rank,
    rankWeight(rank),
    text(body.representativeId, 40) || null,
    Math.max(1, Math.min(16, Number(body.minPlayers ?? 1))),
    Math.max(1, Math.min(16, Number(body.maxPlayers ?? 8))),
    Math.max(10, Math.min(3600, Number(body.timerSeconds ?? 60))),
    text(body.materials, 200),
    text(body.rules, 4000),
    text(body.rulesOriginal, 4000),
    text(body.instructions, 2000),
    text(body.objective, 400),
    text(body.win, 400),
    text(body.fail, 400),
    text(body.scoring, 400),
    Math.max(1, Math.min(20, Number(body.rounds ?? 1))),
    body.status === "published" ? "published" : body.status === "archived" ? "archived" : "draft",
    body.status === "published" ? "public" : "private",
    format,
    JSON.stringify(definition),
    text(body.safety, 400),
    image,
  ];
  if (body.id) {
    await sql(
      `update games set name=$2, description=$3, suit=$4, rank=$5, difficulty=$6, representative_id=$7,
        min_players=$8, max_players=$9, duration_seconds=$10, timer_seconds=$10, materials=$11, rules=$12,
        rules_original=$13, instructions=$14, objective=$15, win_condition=$16, fail_condition=$17,
        scoring_summary=$18, rounds=$19, status=$20, visibility=$21, format=$22, definition=$23::jsonb,
        safety_note=$24, image=$25, updated_at=now() where id=$1`,
      [body.id, ...fields],
    );
    return { id: body.id };
  }
  const id = randomUUID();
  await sql(
    `insert into games (id, source, name, description, suit, rank, difficulty, representative_id, min_players, max_players,
      duration_seconds, materials, rules, rules_original, instructions, objective, win_condition, fail_condition,
      scoring_summary, rounds, timer_seconds, status, visibility, format, definition, safety_note, image)
     values ($1,'custom',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$10,$20,$21,$22,$23::jsonb,$24,$25)`,
    [id, ...fields],
  );
  return { id };
}

async function duplicateGame(id: string) {
  const rows = await sql<Record<string, unknown>>("select * from games where id = $1", [id]);
  const game = rows[0];
  if (!game) throw new Error("Game not found.");
  const copy = randomUUID();
  await sql(
    `insert into games (id, source, name, description, suit, rank, difficulty, representative_id, min_players, max_players,
      duration_seconds, materials, rules, rules_original, instructions, objective, win_condition, fail_condition,
      scoring_summary, rounds, timer_seconds, status, visibility, format, definition, safety_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'draft','private',$22,$23::jsonb,$24)`,
    [
      copy, game.source, `${game.name} copy`, game.description, game.suit, game.rank, game.difficulty, game.representative_id,
      game.min_players, game.max_players, game.duration_seconds, game.materials, game.rules, game.rules_original,
      game.instructions, game.objective, game.win_condition, game.fail_condition, game.scoring_summary, game.rounds,
      game.timer_seconds, game.format, JSON.stringify(parseJson(game.definition, {})), game.safety_note,
    ],
  );
  return { id: copy };
}

async function deleteGame(id: string) {
  const used = await sql("select id from draws where game_id = $1 limit 1", [id]);
  if (used[0]) {
    await sql("update games set status = 'archived', visibility = 'private' where id = $1", [id]);
    return { archived: true };
  }
  await sql("delete from games where id = $1", [id]);
  return { deleted: true };
}

async function saveCard(body: Record<string, unknown>) {
  await sql(
    `update cards set difficulty_label = $2, description = $3, active = $4, difficulty = $5 where id = $1`,
    [body.id, text(body.difficultyLabel, 80), text(body.description, 400), body.active !== false, Math.max(1, Math.min(20, Number(body.difficulty ?? 1)))],
  );
  return { ok: true };
}

async function saveRep(body: Record<string, unknown>) {
  const image = cleanImage(body.portraitImage);
  const suit = (SUITS as readonly string[]).includes(String(body.suit)) ? String(body.suit) : null;
  if (body.id) {
    await sql(
      `update representatives set name=$2, suit=$3, personality=$4, style=$5, intro=$6, rules_line=$7, start_line=$8,
        success_line=$9, failure_line=$10, special_line=$11, enabled=$12, accent=$13, portrait_image=$14 where id=$1`,
      [body.id, text(body.name, 40, "Representative"), suit, text(body.personality, 400), text(body.style, 200), text(body.intro, 400), text(body.rulesLine, 400), text(body.startLine, 400), text(body.successLine, 400), text(body.failureLine, 400), text(body.specialLine, 400), body.enabled !== false, safeColor(body.accent, "#c4161c"), image],
    );
    return { id: body.id };
  }
  const id = randomUUID();
  await sql(
    `insert into representatives (id, name, suit, portrait_key, personality, style, intro, rules_line, start_line, success_line, failure_line, special_line, enabled, accent, portrait_image)
     values ($1,$2,$3,'herald',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, text(body.name, 40, "Representative"), suit, text(body.personality, 400), text(body.style, 200), text(body.intro, 400), text(body.rulesLine, 400), text(body.startLine, 400), text(body.successLine, 400), text(body.failureLine, 400), text(body.specialLine, 400), body.enabled !== false, safeColor(body.accent, "#c4161c"), image],
  );
  return { id };
}

async function saveSettings(body: Record<string, unknown>) {
  const currentRows = await sql<{ value: unknown }>("select value from app_settings where key = 'game'");
  const current = parseJson<Record<string, any>>(currentRows[0]?.value, {});
  const themeIn = (body.theme ?? current.theme ?? {}) as Record<string, unknown>;
  const keep = (key: string, fallback: unknown) => (body[key] == null || body[key] === "" ? current[key] ?? fallback : body[key]);
  const display = FONT_CHOICES.includes(themeIn.displayFont as (typeof FONT_CHOICES)[number]) ? themeIn.displayFont : DEFAULT_THEME.displayFont;
  const bodyFont = FONT_CHOICES.includes(themeIn.bodyFont as (typeof FONT_CHOICES)[number]) ? themeIn.bodyFont : DEFAULT_THEME.bodyFont;
  const next = {
    ...current,
    benchThreshold: Number(keep("benchThreshold", -20)),
    benchingEnabled: keep("benchingEnabled", true) !== false,
    benchLocksPlay: keep("benchLocksPlay", false) === true,
    awardCardOn: ["success", "participate", "never"].includes(String(keep("awardCardOn", "success"))) ? keep("awardCardOn", "success") : "success",
    maxPlayers: Math.max(2, Math.min(16, Number(keep("maxPlayers", 12)))),
    registrationSeconds: Math.max(5, Math.min(120, Number(keep("registrationSeconds", 20)))),
    countdownSeconds: Math.max(3, Math.min(30, Number(keep("countdownSeconds", 5)))),
    soundEnabled: keep("soundEnabled", true) !== false,
    handSize: Math.max(1, Math.min(8, Number(keep("handSize", 4)))),
    suits: body.suits ?? current.suits,
    theme: {
      ...DEFAULT_THEME,
      ...(current.theme as object),
      ...themeIn,
      bg: safeColor(themeIn.bg, DEFAULT_THEME.bg),
      panel: safeColor(themeIn.panel, DEFAULT_THEME.panel),
      fg: safeColor(themeIn.fg, DEFAULT_THEME.fg),
      red: safeColor(themeIn.red, DEFAULT_THEME.red),
      muted: safeColor(themeIn.muted, DEFAULT_THEME.muted),
      displayFont: display,
      bodyFont,
      glitch: themeIn.glitch !== false,
      scanlines: themeIn.scanlines !== false,
      background: cleanImage(themeIn.background) ?? "",
    },
  };
  await sql(
    `insert into app_settings (key, value) values ('game', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(next)],
  );
  return next;
}
