import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { PublicCard } from "@/components/public-card";
import { SetupNotice } from "@/components/setup-notice";
import { getPublishedGame } from "@/lib/content-queries";

export const metadata: Metadata = {
  title: "Game",
};

export default function PublishedGamePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Reading the game…</p>}>
      <PublishedGameBody params={params} />
    </Suspense>
  );
}

async function PublishedGameBody({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublishedGame(slug);

  if ("unconfigured" in result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <SetupNotice body="Published cards will appear here after the project is connected." />
      </main>
    );
  }

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        {"missing" in result ? (
          <EmptyState title="This game is not published" body="Drafts and held cards stay off the library." />
        ) : (
          <QueryError message={result.message} />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-14 sm:px-8">
      <div>
        <Link href="/library" className="text-xs uppercase tracking-[0.2em] text-mute">
          Game library
        </Link>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">{result.game.title}</h1>
        {result.game.summary ? <p className="mt-4 text-sm leading-6 text-mute">{result.game.summary}</p> : null}
      </div>
      {result.cards.length === 0 ? (
        <EmptyState title="No shippable cards" body="Published cards that are in play will list here. Held rows stay hidden." />
      ) : (
        result.cards.map((card) => <PublicCard key={card.id} card={card} />)
      )}
    </main>
  );
}
