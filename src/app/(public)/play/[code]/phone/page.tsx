import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { PhoneJoinForm } from "@/components/forms";
import { PhoneScreen } from "@/components/phone-screen";
import { SetupNotice } from "@/components/setup-notice";
import { readPlay } from "@/lib/play/service";

export const metadata: Metadata = {
  title: "Phone",
};

export default function PhonePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening the phone…</p>}>
      <PhoneBody params={params} />
    </Suspense>
  );
}

async function PhoneBody({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const play = await readPlay(code, "phone");
  if (play.kind === "unconfigured") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice body="A phone joins the room after Supabase is configured." />
      </main>
    );
  }
  if (play.kind === "invalid") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <EmptyState title="That is not a room code" body="Room codes are six letters or digits, without I, O, 0, or 1." />
      </main>
    );
  }
  if (play.kind === "missing") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <EmptyState title="No room uses that code" body="Check the code on the board." />
      </main>
    );
  }
  if (play.kind === "error") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <QueryError message={play.message} />
      </main>
    );
  }
  if (!play.view.you || play.view.you.role === "board") {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <h1 className="font-display text-4xl tracking-[0.08em]">JOIN THIS TABLE</h1>
        <p className="mt-3 text-sm leading-6 text-mute">Use the room code {play.view.roomCode}. This phone is a controller.</p>
        <div className="mt-6">
          <PhoneJoinForm code={play.view.roomCode} />
        </div>
      </main>
    );
  }
  return <PhoneScreen view={play.view} />;
}
