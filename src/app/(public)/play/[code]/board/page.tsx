import type { Metadata } from "next";
import { Suspense } from "react";

import { BoardScreen } from "@/components/board-screen";
import { EmptyState, QueryError } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { ensureBoard, readPlay } from "@/lib/play/service";

export const metadata: Metadata = {
  title: "Board",
};

export default function BoardPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening the board…</p>}>
      <BoardBody params={params} />
    </Suspense>
  );
}

async function BoardBody({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const seated = await ensureBoard(code);
  if (seated.error && seated.error.includes("server key")) {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice title="The server key is missing" body={seated.error} />
      </main>
    );
  }
  const play = await readPlay(code, "board");
  if (play.kind === "unconfigured") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice body="The board reads the room after Supabase is configured." />
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
        <EmptyState title="No room uses that code" body="Check the code with the person who opened the table." />
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
  if (seated.error) {
    return (
      <main className="px-4 py-14 sm:px-8">
        <QueryError message={seated.error} />
      </main>
    );
  }
  return <BoardScreen view={play.view} />;
}
