import type { Metadata } from "next";
import { Suspense } from "react";

import { RepresentativeEditor } from "@/components/content-forms";
import { QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { getOwnerRepresentative } from "@/lib/content-queries";
import { safePortraitUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Edit representative",
};

export default function EditRepresentativePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the representative…</p>}>
      <EditRepresentativeBody params={params} />
    </Suspense>
  );
}

async function EditRepresentativeBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOwnerRepresentative(id);

  if ("unconfigured" in result) {
    return (
      <OwnerPage kicker="Representatives" title="EDIT" lede="Dialogue is stored on the representative row.">
        <SetupNotice />
      </OwnerPage>
    );
  }
  if (!result.ok) {
    return (
      <OwnerPage kicker="Representatives" title="EDIT" lede="Dialogue is stored on the representative row.">
        <QueryError message={result.message} />
      </OwnerPage>
    );
  }

  const person = result.representative;

  return (
    <OwnerPage kicker="Representatives" title={person.name} lede={person.bio || "Original cast. No show likeness."}>
      {safePortraitUrl(person.portrait_url) ? (
        <div
          aria-hidden="true"
          className="mb-8 h-40 w-32 border border-line bg-cover bg-center"
          style={{ backgroundImage: `url("${safePortraitUrl(person.portrait_url)}")` }}
        />
      ) : null}
      <RepresentativeEditor representative={person} />
    </OwnerPage>
  );
}
