import { suitLabel, suitSymbol, suitTone } from "@/lib/format";
import { asObject } from "@/lib/public-effect";

export function PublicCard({
  card,
}: {
  card: {
    title: string;
    suit: string;
    rank: string;
    prompt: string;
    source: string;
    effect: Record<string, unknown>;
  };
}) {
  const effect = card.effect;
  const scoring = asObject(effect.scoring);
  const hints = Array.isArray(effect.hints) ? effect.hints.filter((hint) => typeof hint === "string") : [];
  const physical = asObject(effect.physical);

  return (
    <article className="border border-line bg-charcoal p-5">
      <p className={`text-xs uppercase tracking-[0.2em] ${suitTone(card.suit)}`}>
        {suitSymbol(card.suit)} {card.rank} {suitLabel(card.suit)} · {card.source}
      </p>
      <h2 className="mt-2 font-display text-2xl tracking-[0.06em]">{card.title}</h2>
      {card.prompt ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{card.prompt}</p> : null}
      {typeof effect.question === "string" && effect.question ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-paper">{effect.question}</p>
      ) : null}
      <dl className="mt-4 grid gap-2 text-xs uppercase tracking-[0.14em] text-mute sm:grid-cols-3">
        {effect.player_count ? (
          <div>
            <dt>Players</dt>
            <dd className="mt-1 text-paper">{String(effect.player_count)}</dd>
          </div>
        ) : null}
        {effect.rounds ? (
          <div>
            <dt>Rounds</dt>
            <dd className="mt-1 text-paper">{String(effect.rounds)}</dd>
          </div>
        ) : null}
        {effect.timer_seconds ? (
          <div>
            <dt>Timer</dt>
            <dd className="mt-1 text-paper">{String(effect.timer_seconds)}s</dd>
          </div>
        ) : null}
      </dl>
      {Object.keys(scoring).length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-paper">
          {Object.entries(scoring).map(([key, value]) => (
            <li key={key}>
              {key.replaceAll("_", " ")}: {String(value)}
            </li>
          ))}
        </ul>
      ) : null}
      {hints.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-mute">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
      {physical.optional === true ? (
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-mute">
          Physical version is optional, indoor, and low risk. A phone version is on the card.
        </p>
      ) : null}
    </article>
  );
}
