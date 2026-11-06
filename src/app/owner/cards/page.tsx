import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { suitLabel, suitSymbol, suitTone } from "@/lib/format";
import { listOwnerCards } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Cards",
};

export default function CardsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading cards…</p>}>
      <CardsBody />
    </Suspense>
  );
}

async function CardsBody() {
  const result = await listOwnerCards();

  return (
    <OwnerPage
      kicker="Cards"
      title="CARDS"
      lede="The list omits secret answers. A row stays unpublished until publishable is true. Export lines that fail the safety rules are not shipped as written."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No cards are stored"
          body="The cards table is empty. Importing the deck, and marking each row export or proposal, is Phase 3."
        />
      ) : (
        <DataTable
          columns={["Card", "Title", "Source", "Publishable"]}
          rows={result.rows.map((card) => [
            <span key={`${card.id}-card`} className={suitTone(card.suit)}>
              {suitSymbol(card.suit)} {card.rank} {suitLabel(card.suit)}
            </span>,
            card.title || "—",
            card.source,
            card.publishable ? "Yes" : "No",
          ])}
        />
      )}
    </OwnerPage>
  );
}
