import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { DataTable } from "@/components/data-table";
import { suitLabel, suitSymbol, suitTone } from "@/lib/format";
import { listPublishedGames } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Game library",
};

export default function LibraryPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Game library</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">PUBLISHED GAMES</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-mute">
          The library reads games whose status is published. Drafts stay on the owner dashboard.
          This phase does not ship a deck.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-mute">Reading published games…</p>}>
        <LibraryList />
      </Suspense>
    </main>
  );
}

async function LibraryList() {
  const result = await listPublishedGames();

  if ("unconfigured" in result) {
    return <SetupNotice body="Published games will appear here after the project is connected." />;
  }

  if (!result.ok) {
    return <QueryError message={result.message} />;
  }

  if (result.rows.length === 0) {
    return (
      <EmptyState
        title="No published games"
        body="The games table has no row with status published. Empty is the real result, not a placeholder deck."
      />
    );
  }

  return (
    <DataTable
      columns={["Suit", "Title", "Source", "Summary"]}
      rows={result.rows.map((game) => [
        <span key={game.id} className={suitTone(game.suit)}>
          {suitSymbol(game.suit)} {suitLabel(game.suit)}
        </span>,
        game.title,
        game.source,
        game.summary || "—",
      ])}
    />
  );
}
