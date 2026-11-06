import type { Metadata } from "next";
import { Suspense } from "react";

import { AnnouncementScreen } from "@/components/announcement-screen";
import { AnnouncementEditor } from "@/components/content-forms";
import { QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { getAnnouncement, listRepresentativeOptions } from "@/lib/content-queries";
import { asObject } from "@/lib/public-effect";

export const metadata: Metadata = {
  title: "Announcement",
};

export default function AnnouncementPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the announcement…</p>}>
      <AnnouncementBody params={params} />
    </Suspense>
  );
}

async function AnnouncementBody({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, people] = await Promise.all([getAnnouncement(slug), listRepresentativeOptions()]);

  if ("unconfigured" in result) {
    return (
      <OwnerPage kicker="Announcements" title="PREVIEW" lede="The screen reads one announcements row.">
        <SetupNotice />
      </OwnerPage>
    );
  }
  if (!result.ok) {
    return (
      <OwnerPage kicker="Announcements" title="PREVIEW" lede="The screen reads one announcements row.">
        <QueryError message={result.message} />
      </OwnerPage>
    );
  }

  const timing = asObject(result.announcement.timing);
  const seconds = typeof timing.seconds === "number" ? timing.seconds : null;

  return (
    <OwnerPage kicker="Announcements" title="PREVIEW" lede="This preview is the stored row. It is not a live session.">
      <AnnouncementScreen
        trigger={String(timing.screen ?? result.announcement.trigger)}
        title={result.announcement.title}
        body={result.announcement.body}
        seconds={seconds}
        representative={result.representative}
      />
      <div className="mt-10">
        <AnnouncementEditor
          announcement={result.announcement}
          representatives={people.ok ? people.rows : []}
        />
      </div>
    </OwnerPage>
  );
}
