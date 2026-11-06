import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { listCollections } from "@/lib/content-queries";
import { readCollectionRule, ruleSentence } from "@/lib/progression";

export const metadata: Metadata = {
  title: "Collections",
};

export default function CollectionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading collections…</p>}>
      <CollectionsBody />
    </Suspense>
  );
}

async function CollectionsBody() {
  const result = await listCollections();

  return (
    <OwnerPage
      kicker="Collections"
      title="COLLECTIONS"
      lede="Diamond Mind, Heart Read, Club Line, and Spade Step start unpublished. The clear count lives in the row, so a change does not need a deploy."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState title="No collections are stored" body="Apply the Phase 6 migration to load the four collections." />
      ) : (
        <ul className="divide-y divide-line border border-line">
          {result.rows.map((row) => {
            const rule = readCollectionRule(row.rules);
            return (
              <li key={row.id}>
                <Link href={`/owner/collections/${row.id}`} className="block px-4 py-4 hover:bg-charcoal">
                  <span className="flex items-baseline justify-between gap-4">
                    <span>{row.title}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-mute">{row.published ? "On" : "Off"}</span>
                  </span>
                  <span className="mt-2 block text-sm text-mute">{rule ? ruleSentence(rule) : "This row has no usable rule."}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </OwnerPage>
  );
}
