import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { formatWhen } from "@/lib/format";
import { listProfiles } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Players",
};

export default function PlayersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading accounts…</p>}>
      <PlayersBody />
    </Suspense>
  );
}

async function PlayersBody() {
  const result = await listProfiles();
  const players = result.ok ? result.rows.filter((row) => row.role === "player") : [];

  return (
    <OwnerPage
      kicker="Players"
      title="ACCOUNTS"
      lede="Profiles from the database. Guests are not listed here. They exist only as participants on a session, with no account."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="No profiles are stored"
          body="Apply the migrations and create an account. The first profile is the owner."
        />
      ) : (
        <>
          {players.length === 0 ? (
            <p className="text-sm text-mute">No player accounts yet. Later signups receive that role.</p>
          ) : null}
          <DataTable
            columns={["Name", "Role", "Created"]}
            rows={result.rows.map((profile) => [
              profile.display_name,
              profile.role,
              formatWhen(profile.created_at),
            ])}
          />
        </>
      )}
    </OwnerPage>
  );
}
