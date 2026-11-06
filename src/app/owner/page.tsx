import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { ownerCounts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the database…</p>}>
      <OverviewBody />
    </Suspense>
  );
}

async function OverviewBody() {
  const result = await ownerCounts();

  return (
    <OwnerPage
      kicker="Overview"
      title="EMPTY UNTIL YOU PUBLISH"
      lede="Each number is a count from Postgres. Zero means the table has no matching rows. This phase does not seed cards, representatives, or announcements."
    >
      {"unconfigured" in result ? (
        <SetupNotice />
      ) : !result.ok ? (
        <QueryError message={result.message} />
      ) : (
        <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((item) => {
            const body = (
              <>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-mute">{item.label}</p>
                <p className="mt-4 font-display text-5xl tracking-wide">
                  {item.count === null ? "—" : item.count}
                </p>
                {item.error ? <p className="mt-3 text-xs text-blood-bright">{item.error}</p> : null}
              </>
            );

            return (
              <li key={item.label} className="bg-ink p-5">
                {item.href ? (
                  <Link href={item.href} className="block hover:text-blood-bright">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </OwnerPage>
  );
}
