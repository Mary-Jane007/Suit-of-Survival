import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { listAnnouncements } from "@/lib/content-queries";

export const metadata: Metadata = {
  title: "Announcements",
};

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading announcements…</p>}>
      <AnnouncementsBody />
    </Suspense>
  );
}

async function AnnouncementsBody() {
  const result = await listAnnouncements();

  return (
    <OwnerPage
      kicker="Announcements"
      title="ANNOUNCEMENTS"
      lede="Preview a screen from the announcements table. No live room is required."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : result.rows.length === 0 ? (
        <EmptyState title="No announcements are stored" body="Apply the Phase 3 migration to load the announcement rows." />
      ) : (
        <ul className="divide-y divide-line border border-line">
          {result.rows.map((row) => (
            <li key={row.id}>
              <Link href={`/owner/announcements/${row.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-charcoal">
                <span>{row.title}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-mute">
                  {row.trigger.replaceAll("_", " ")} · {row.source}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}
