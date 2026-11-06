import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { formatWhen } from "@/lib/format";
import { listSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Design",
};

export default function DesignPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading design tokens…</p>}>
      <DesignBody />
    </Suspense>
  );
}

async function DesignBody() {
  const result = await listSettings("design");

  return (
    <OwnerPage
      kicker="Design"
      title="DESIGN TOKENS"
      lede="Tokens live in owner_settings under keys that start with design. The cinematic frame on the site is the application shell, not a row pretending to be a theme."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No design tokens are stored"
          body="Nothing in owner_settings uses the design. prefix. Palette and motion stay in the stylesheet until you save tokens."
        />
      ) : (
        <DataTable
          columns={["Key", "Value", "Updated"]}
          rows={result.rows.map((row) => [
            row.key,
            JSON.stringify(row.value),
            formatWhen(row.updated_at),
          ])}
        />
      )}
    </OwnerPage>
  );
}
