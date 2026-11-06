import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { suitLabel } from "@/lib/format";
import { listRepresentatives } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Representatives",
};

export default function RepresentativesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading representatives…</p>}>
      <RepresentativesBody />
    </Suspense>
  );
}

async function RepresentativesBody() {
  const result = await listRepresentatives();

  return (
    <OwnerPage
      kicker="Representatives"
      title="REPRESENTATIVES"
      lede="Original cast only. No show names, voices, or likenesses. This phase does not invent a cast."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No representatives are stored"
          body="The table is empty. Portraits, when they exist, have to be art made for this game."
        />
      ) : (
        <DataTable
          columns={["Name", "Role", "Suit", "Bio"]}
          rows={result.rows.map((person) => [
            person.name,
            person.role.replaceAll("_", " "),
            suitLabel(person.suit),
            person.bio || "—",
          ])}
        />
      )}
    </OwnerPage>
  );
}
