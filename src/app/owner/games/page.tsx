import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { formatWhen, suitLabel, suitSymbol, suitTone } from "@/lib/format";
import { listOwnerGames } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Games",
};

export default function GamesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading games…</p>}>
      <GamesBody />
    </Suspense>
  );
}

async function GamesBody() {
  const result = await listOwnerGames();

  return (
    <OwnerPage
      kicker="Games"
      title="GAMES"
      lede="Rows from the games table, including drafts. Open a row to edit rules, status, and cards."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No games are stored"
          body="Apply the Phase 3 migration to load the deck, or create a draft."
        />
      ) : (
        <DataTable
          columns={["Suit", "Title", "Status", "Source", "Updated"]}
          rows={result.rows.map((game) => [
            <span key={`${game.id}-suit`} className={suitTone(game.suit)}>
              {suitSymbol(game.suit)} {suitLabel(game.suit)}
            </span>,
            <Link key={`${game.id}-title`} href={`/owner/games/${game.id}`} className="underline">
              {game.title}
            </Link>,
            game.status,
            game.source,
            formatWhen(game.updated_at),
          ])}
        />
      )}
      <p className="mt-6">
        <Link href="/owner/games/new" className="text-xs uppercase tracking-[0.16em] text-blood-bright">
          New game
        </Link>
      </p>
    </OwnerPage>
  );
}
