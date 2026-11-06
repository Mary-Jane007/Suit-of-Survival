import type { Metadata } from "next";
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
      lede="Rows from the games table, including drafts. Publishing and editing arrive in a later phase. Nothing here is hardcoded."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No games are stored"
          body="The table is empty. Card text is not imported in this phase, so there is no deck to list."
        />
      ) : (
        <DataTable
          columns={["Suit", "Title", "Status", "Source", "Updated"]}
          rows={result.rows.map((game) => [
            <span key={`${game.id}-suit`} className={suitTone(game.suit)}>
              {suitSymbol(game.suit)} {suitLabel(game.suit)}
            </span>,
            game.title,
            game.status,
            game.source,
            formatWhen(game.updated_at),
          ])}
        />
      )}
    </OwnerPage>
  );
}
