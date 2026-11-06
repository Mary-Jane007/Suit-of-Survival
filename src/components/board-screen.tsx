"use client";

import { AnnouncementScreen } from "@/components/announcement-screen";
import { DeadlineClock } from "@/components/deadline-clock";
import { PlaySync } from "@/components/play-sync";
import { suitSymbol } from "@/lib/format";
import type { PlayView } from "@/lib/play/service";

export function BoardScreen({ view }: { view: PlayView }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PlaySync sessionId={view.sessionId} />
      <p className="font-display text-4xl tracking-[0.28em]">{view.roomCode}</p>
      {view.screen ? (
        <AnnouncementScreen
          trigger={view.screen.trigger}
          title={view.screen.title}
          body={view.screen.body}
          seconds={view.screen.seconds}
          representative={view.screen.representative}
        />
      ) : null}
      {view.beat === "play" && view.card ? (
        <article className="border border-line bg-charcoal p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-blood-bright">
            {suitSymbol(view.card.suit)} {view.card.rank} · {view.card.kind}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-5xl tracking-[0.06em]">{view.card.title}</h1>
            {view.deadline ? <DeadlineClock key={view.deadline} deadline={view.deadline} /> : null}
          </div>
          <p className="mt-6 whitespace-pre-wrap text-lg leading-8">{view.card.prompt}</p>
          {view.card.question ? <p className="mt-4 text-lg leading-8">{view.card.question}</p> : null}
          {view.card.physicalOptional ? (
            <p className="mt-6 text-base leading-7 text-mute">The physical version is optional. You can stop.</p>
          ) : null}
          {view.card.phoneAlternative ? (
            <p className="mt-2 text-base leading-7">Phone: {view.card.phoneAlternative}</p>
          ) : null}
          {view.hint ? <p className="mt-6 text-base leading-7">Hint: {view.hint}</p> : null}
          {view.answer ? <p className="mt-4 text-base leading-7">Answer: {view.answer}</p> : null}
          {view.card.input === "unresolved" ? (
            <p className="mt-4 text-base text-blood-bright">This card cannot be scored from the stored row. No points are written.</p>
          ) : null}
        </article>
      ) : null}
      <section>
        <h2 className="font-display text-2xl tracking-[0.08em]">RESULTS</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.players.map((player) => (
            <li key={player.id} className="flex items-baseline justify-between border border-line px-4 py-3 text-sm">
              <span>
                {player.name}
                <span className="ml-3 text-xs uppercase tracking-[0.16em] text-mute">{player.role}</span>
              </span>
              <span>
                {player.points}
                <span className="ml-3 text-xs uppercase tracking-[0.16em] text-mute">{player.status}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
