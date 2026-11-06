import { Countdown } from "@/components/countdown";
import { safePortraitUrl, suitSymbol } from "@/lib/format";

export function AnnouncementScreen({
  trigger,
  title,
  body,
  seconds,
  representative,
}: {
  trigger: string;
  title: string;
  body: string;
  seconds: number | null;
  representative: { name: string; portrait_url: string | null; suit: string | null } | null;
}) {
  const paused = trigger === "paused";

  return (
    <section className={`frame bg-charcoal px-6 py-10 sm:px-10 ${paused ? "" : "rise-in"}`}>
      <p className="text-[0.68rem] uppercase tracking-[0.32em] text-blood-bright">{trigger.replaceAll("_", " ")}</p>
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-[0.08em] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7 text-paper">{body}</p>
        </div>
        {trigger === "countdown" && seconds ? <Countdown key={seconds} seconds={seconds} /> : null}
      </div>
      <div className="mt-10 flex items-center gap-4 border-t border-line pt-5">
        {safePortraitUrl(representative?.portrait_url) ? (
          <span
            aria-hidden="true"
            className="h-14 w-12 border border-line bg-cover bg-center"
            style={{ backgroundImage: `url("${safePortraitUrl(representative?.portrait_url)}")` }}
          />
        ) : (
          <span className="font-display text-2xl text-mute">{suitSymbol(representative?.suit ?? null)}</span>
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-mute">
          {representative?.name ?? "Suit representative"}
        </p>
      </div>
    </section>
  );
}
