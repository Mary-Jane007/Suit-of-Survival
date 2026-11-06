export function suitSymbol(suit: string | null) {
  switch (suit) {
    case "spades":
      return "♠";
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    default:
      return "◆";
  }
}

export function suitLabel(suit: string | null) {
  switch (suit) {
    case "spades":
      return "Spades";
    case "hearts":
      return "Hearts";
    case "diamonds":
      return "Diamonds";
    case "clubs":
      return "Clubs";
    case "any":
      return "Any suit";
    default:
      return "—";
  }
}

export function suitTone(suit: string | null) {
  return suit === "hearts" || suit === "diamonds" ? "text-blood-bright" : "text-paper";
}

export function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ");
}

export function safePortraitUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (/^\/[A-Za-z0-9./_-]+$/.test(value) || /^https:\/\/[A-Za-z0-9./_-]+$/.test(value)) {
    return value;
  }
  return null;
}
