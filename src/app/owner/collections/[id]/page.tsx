import type { Metadata } from "next";
import { Suspense } from "react";

import { CollectionForm } from "@/components/collection-form";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { getCollection } from "@/lib/content-queries";
import { readCollectionRule, ruleSentence } from "@/lib/progression";

export const metadata: Metadata = {
  title: "Collection",
};

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the collection…</p>}>
      <CollectionBody params={params} />
    </Suspense>
  );
}

async function CollectionBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCollection(id);

  if ("unconfigured" in result) {
    return (
      <OwnerPage kicker="Collections" title="COLLECTION" lede="">
        <SetupNotice />
      </OwnerPage>
    );
  }
  if ("missing" in result) {
    return (
      <OwnerPage kicker="Collections" title="COLLECTION" lede="">
        <EmptyState title="That collection is not stored" body="It may have been deleted." />
      </OwnerPage>
    );
  }
  if (!result.ok) {
    return (
      <OwnerPage kicker="Collections" title="COLLECTION" lede="">
        <QueryError message={result.message} />
      </OwnerPage>
    );
  }

  const rule = readCollectionRule(result.row.rules);
  return (
    <OwnerPage
      kicker="Collections"
      title={result.row.title.toUpperCase()}
      lede={rule ? ruleSentence(rule) : "This row has no usable rule. Saving replaces it."}
    >
      <CollectionForm
        collection={{
          id: result.row.id,
          title: result.row.title,
          description: result.row.description,
          suit: rule?.suit ?? "diamonds",
          clearsRequired: rule?.clearsRequired ?? 5,
          clearMinimum: rule?.clearMinimum ?? 0,
          published: result.row.published,
        }}
      />
    </OwnerPage>
  );
}
