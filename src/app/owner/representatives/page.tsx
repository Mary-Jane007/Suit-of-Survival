import type { Metadata } from "next";
import Link from "next/link";
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
      lede="Original cast. Portraits are geometric marks made for this game. Dialogue is editable on each row."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No representatives are stored"
          body="Apply the Phase 3 migration to load Sable Voss, Ivo Quill, Noa Veld, Maren Holt, and Tess Calder."
        />
      ) : (
        <DataTable
          columns={["Name", "Role", "Suit", "Bio"]}
          rows={result.rows.map((person) => [
            <Link key={person.id} href={`/owner/representatives/${person.id}`} className="underline">
              {person.name}
            </Link>,
            person.role.replaceAll("_", " "),
            suitLabel(person.suit),
            person.bio || "—",
          ])}
        />
      )}
    </OwnerPage>
  );
}
