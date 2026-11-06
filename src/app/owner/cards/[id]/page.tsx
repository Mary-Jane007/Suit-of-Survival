import type { Metadata } from "next";
import { Suspense } from "react";

import { CardEditor } from "@/components/content-forms";
import { QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { getOwnerCard, listRepresentativeOptions } from "@/lib/content-queries";

export const metadata: Metadata = {
  title: "Edit card",
};

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the card…</p>}>
      <EditCardBody params={params} />
    </Suspense>
  );
}

async function EditCardBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cardResult, people] = await Promise.all([getOwnerCard(id), listRepresentativeOptions()]);

  if ("unconfigured" in cardResult) {
    return (
      <OwnerPage kicker="Cards" title="EDIT CARD" lede="The hidden answer is loaded through the owner function, not a public column.">
        <SetupNotice />
      </OwnerPage>
    );
  }
  if (!cardResult.ok) {
    return (
      <OwnerPage kicker="Cards" title="EDIT CARD" lede="The hidden answer is loaded through the owner function, not a public column.">
        <QueryError message={cardResult.message} />
      </OwnerPage>
    );
  }

  return (
    <OwnerPage kicker="Cards" title={cardResult.card.title || "Untitled card"} lede="Players never receive the hidden answer. Publishable wording is what the library shows.">
      <CardEditor
        card={cardResult.card}
        secret={cardResult.secret}
        representatives={people.ok ? people.rows : []}
      />
    </OwnerPage>
  );
}
