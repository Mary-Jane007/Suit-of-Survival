import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable } from "@/components/data-table";
import { EmptyState, QueryError } from "@/components/empty-state";
import { CreateRoomForm } from "@/components/forms";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { formatWhen, titleCase } from "@/lib/format";
import { listSessions } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Sessions",
};

export default function SessionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading sessions…</p>}>
      <SessionsBody />
    </Suspense>
  );
}

async function SessionsBody() {
  const result = await listSessions();

  return (
    <OwnerPage
      kicker="Sessions"
      title="SESSIONS"
      lede="A room code and a lobby. Starting, pausing, and scoring a challenge are not part of this phase."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : (
        <>
          <CreateRoomForm />
          {result.rows.length === 0 ? (
            <EmptyState
              title="No sessions are stored"
              body="Open a room to write the first lobby. The list stays empty until that insert succeeds."
            />
          ) : (
            <DataTable
              columns={["Code", "Status", "Mode", "Seated", "Opened"]}
              rows={result.rows.map((session) => [
                <Link key={session.id} href={`/play/${session.room_code}`} className="tracking-[0.16em]">
                  {session.room_code}
                </Link>,
                titleCase(session.status),
                titleCase(session.mode),
                String(session.participants?.length ?? 0),
                formatWhen(session.created_at),
              ])}
            />
          )}
        </>
      )}
    </OwnerPage>
  );
}
