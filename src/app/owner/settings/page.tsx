import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { formatWhen } from "@/lib/format";
import { listSettings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading settings…</p>}>
      <SettingsBody />
    </Suspense>
  );
}

async function SettingsBody() {
  const result = await listSettings("other");

  return (
    <OwnerPage
      kicker="Settings"
      title="SETTINGS"
      lede="Rows in owner_settings, other than design tokens. Later phases can store whether digital elimination is offered and whether a physical version is offered. Neither switch exists yet."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No settings are stored"
          body="The table has no rows outside the design. prefix. This phase does not insert defaults."
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
