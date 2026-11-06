import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { EmptyState, QueryError } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { ghostButtonClass } from "@/components/ui";
import { getVerifiedUser } from "@/lib/auth";
import { formatWhen, titleCase } from "@/lib/format";
import { getLobby } from "@/lib/lobby";

export const metadata: Metadata = {
  title: "Lobby",
};

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening the lobby…</p>}>
      <LobbyBody params={params} />
    </Suspense>
  );
}

async function LobbyBody({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await getLobby(code);

  if (result.kind === "unconfigured") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice body="The lobby reads the session after Supabase is configured." />
      </main>
    );
  }

  if (result.kind === "invalid") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <EmptyState
          title="That is not a room code"
          body="Room codes are six letters or digits, without I, O, 0, or 1."
        />
      </main>
    );
  }

  if (result.kind === "needs-server-key") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice
          title="The server key is missing"
          body="A guest lobby is read with SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY. A signed-in host can still open the room they created."
        />
      </main>
    );
  }

  if (result.kind === "hidden") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <EmptyState
          title="This account cannot see that room"
          body="Guest access to a lobby needs the server key. The host can open a room they created while signed in."
        />
      </main>
    );
  }

  if (result.kind === "missing") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <EmptyState title="No room uses that code" body="Check the code with the person who opened the room." />
      </main>
    );
  }

  if (result.kind === "error") {
    return (
      <main className="px-4 py-14 sm:px-8">
        <QueryError message={result.message} />
      </main>
    );
  }

  const lobby = result.lobby;
  const cookieStore = await cookies();
  const guestId = cookieStore.get("sos_participant")?.value;
  const user = await getVerifiedUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">
          {titleCase(lobby.status)} · {titleCase(lobby.mode)}
        </p>
        <h1 className="mt-3 font-display text-6xl tracking-[0.22em]">{lobby.room_code}</h1>
        <p className="mt-4 text-sm leading-6 text-mute">
          Opened {formatWhen(lobby.created_at)}. No challenge is dealt in this phase. The room
          stays a lobby.
        </p>
      </div>
      <section className="frame px-6 py-6">
        <h2 className="font-display text-2xl tracking-[0.08em]">IN THE ROOM</h2>
        {lobby.participants.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No one is seated yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {lobby.participants.map((person) => {
              const you = person.id === guestId || (person.user_id !== null && person.user_id === user?.userId);
              return (
                <li key={person.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-paper">
                    {person.display_name}
                    {you ? <span className="ml-3 text-xs uppercase tracking-[0.16em] text-blood-bright">You</span> : null}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-mute">
                    {person.role} · {person.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/play/${lobby.room_code}`} className={ghostButtonClass}>
          Refresh the lobby
        </Link>
        <Link href="/enter" className={ghostButtonClass}>
          Enter another room
        </Link>
      </div>
    </main>
  );
}
