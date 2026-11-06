export type CollectionRule = {
  suit: string;
  clearsRequired: number;
  clearMinimum: number;
};

export type ScoreChange = {
  card_id: string;
  draw: number;
  points: number;
  reason: string;
};

export type ScoreRow = {
  participantId: string;
  points: number;
};

const SUITS = new Set(["diamonds", "hearts", "clubs", "spades"]);

export function readCollectionRule(rules: unknown): CollectionRule | null {
  if (typeof rules !== "object" || rules === null || Array.isArray(rules)) {
    return null;
  }
  const row = rules as Record<string, unknown>;
  const suit = typeof row.suit === "string" ? row.suit : "";
  const required = row.clears_required;
  const minimum = row.clear_minimum;
  if (!SUITS.has(suit) || typeof required !== "number" || typeof minimum !== "number") {
    return null;
  }
  if (!Number.isInteger(required) || required < 1 || !Number.isInteger(minimum)) {
    return null;
  }
  return { suit, clearsRequired: required, clearMinimum: minimum };
}

export function ruleSentence(rule: CollectionRule) {
  const direction = rule.clearMinimum === 0 ? "zero or higher" : `${rule.clearMinimum} or higher`;
  return `${rule.clearsRequired} clears in ${rule.suit}. A clear is a point change of ${direction} on one card.`;
}

export function readHistory(result: unknown): ScoreChange[] {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return [];
  }
  const history = (result as Record<string, unknown>).history;
  if (!Array.isArray(history)) {
    return [];
  }
  const changes: ScoreChange[] = [];
  for (const entry of history) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.card_id !== "string" || typeof row.draw !== "number" || typeof row.points !== "number") {
      continue;
    }
    changes.push({
      card_id: row.card_id,
      draw: row.draw,
      points: row.points,
      reason: typeof row.reason === "string" ? row.reason : "",
    });
  }
  return changes;
}

export function appendChange(history: ScoreChange[], change: ScoreChange) {
  return [...history, change].slice(-200);
}

export function netsByDraw(history: ScoreChange[]) {
  const grouped = new Map<string, { cardId: string; draw: number; points: number }>();
  for (const change of history) {
    const key = `${change.draw}:${change.card_id}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      cardId: change.card_id,
      draw: change.draw,
      points: (previous?.points ?? 0) + change.points,
    });
  }
  return [...grouped.values()];
}

export function clearsFor(
  history: ScoreChange[],
  suitByCard: ReadonlyMap<string, string>,
  rule: CollectionRule,
) {
  return netsByDraw(history).filter(
    (net) => suitByCard.get(net.cardId) === rule.suit && net.points >= rule.clearMinimum,
  );
}

export function collectionStanding(clears: number, rule: CollectionRule) {
  return {
    clears,
    required: rule.clearsRequired,
    complete: clears >= rule.clearsRequired,
    sentence: ruleSentence(rule),
  };
}

export function rankByPoints<T extends ScoreRow>(rows: T[]) {
  return [...rows].sort((left, right) => right.points - left.points || left.participantId.localeCompare(right.participantId));
}

export function victoriesFor(sessions: { scores: ScoreRow[] }[], participantIds: ReadonlySet<string>) {
  let wins = 0;
  for (const session of sessions) {
    if (session.scores.length < 2) {
      continue;
    }
    const ranked = rankByPoints(session.scores);
    const top = ranked[0];
    if (!top || !participantIds.has(top.participantId)) {
      continue;
    }
    const tied = ranked.filter((row) => row.points === top.points);
    if (tied.length === 1) {
      wins += 1;
    }
  }
  return wins;
}
