import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { QueryError } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { ghostButtonClass } from "@/components/ui";
import { loadProfile } from "@/lib/profile-data";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Reading the record…</p>}>
      <ProfileBody />
    </Suspense>
  );
}

async function ProfileBody() {
  const result = await loadProfile();
  if ("unconfigured" in result) {
    return (
      <main className="px-4 py-14 sm:px-8">
        <SetupNotice body="The profile reads collections after Supabase is configured." />
      </main>
    );
  }
  if (!result.ok) {
    return (
      <main className="px-4 py-14 sm:px-8">
        <QueryError message={result.message} />
      </main>
    );
  }
  const view = result.view;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Profile</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">{view.account ? view.account.name : "GUEST"}</h1>
        <p className="mt-4 text-sm leading-6 text-mute">
          {view.account
            ? "Completed cards, collection progress, sessions, and victories come from stored scores."
            : "An account is optional. A guest can still play, and this page shows the current session."}
        </p>
        {view.note ? <p className="mt-3 text-sm text-blood-bright">{view.note}</p> : null}
      </div>

      <section>
        <h2 className="font-display text-2xl tracking-[0.08em]">COLLECTIONS</h2>
        {view.collections.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No collection is on. The owner turns one on from the dashboard.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line">
            {view.collections.map((collection) => (
              <li key={collection.id} className="px-4 py-4">
                <p className="flex items-baseline justify-between gap-4">
                  <span>{collection.title}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-mute">
                    {view.account ? `${collection.clears} / ${collection.required}` : "Rule"}
                    {collection.complete ? " · complete" : ""}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6">{collection.sentence}</p>
                {collection.description ? <p className="mt-2 text-sm leading-6 text-mute">{collection.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {view.account ? (
        <>
          <section>
            <h2 className="font-display text-2xl tracking-[0.08em]">COMPLETED CARDS</h2>
            {view.cards.length === 0 ? (
              <p className="mt-4 text-sm text-mute">No stored point change has cleared a card under the current rules.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line border border-line">
                {view.cards.map((card) => (
                  <li key={card.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <span>{card.title}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-mute">
                      {card.rank} {card.suit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="font-display text-2xl tracking-[0.08em]">SESSIONS</h2>
            <p className="mt-4 text-sm text-mute">Victories: {view.victories}. A victory is the sole highest stored score when a session ends.</p>
            {view.sessions.length === 0 ? (
              <p className="mt-3 text-sm text-mute">No session is stored for this account.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line border border-line">
                {view.sessions.map((session) => (
                  <li key={session.id} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                    <Link href={`/play/${session.roomCode}`} className="tracking-[0.16em]">
                      {session.roomCode}
                    </Link>
                    <span className="text-xs uppercase tracking-[0.14em] text-mute">
                      {session.status} · {session.points} · {session.place}/{session.field}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section>
          <h2 className="font-display text-2xl tracking-[0.08em]">THIS SESSION</h2>
          {view.guestSession ? (
            <>
              <p className="mt-4 text-sm text-mute">
                {view.guestSession.roomCode} · {view.guestSession.status}. Ranked by the scores stored for this room.
              </p>
              {view.guestSession.ranking.length === 0 ? (
                <p className="mt-3 text-sm text-mute">No scores are stored yet.</p>
              ) : (
                <ol className="mt-4 divide-y divide-line border border-line">
                  {view.guestSession.ranking.map((row, index) => (
                    <li key={`${row.name}-${index}`} className="flex justify-between px-4 py-3 text-sm">
                      <span>
                        {index + 1}. {row.name}
                      </span>
                      <span>{row.points}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-mute">Join a room to see its score list. Signing in keeps the record.</p>
          )}
          <div className="mt-6 flex gap-3">
            <Link href="/auth/sign-in" className={ghostButtonClass}>
              Sign in
            </Link>
            <Link href="/enter" className={ghostButtonClass}>
              Enter a room
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
