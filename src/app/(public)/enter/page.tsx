import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CreateRoomForm, CreateTableForm, JoinForm } from "@/components/forms";
import { SetupNotice } from "@/components/setup-notice";
import { ghostButtonClass } from "@/components/ui";
import { getVerifiedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Enter the game",
};

export default function EnterPage() {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening the door…</p>}>
      <EnterBody />
    </Suspense>
  );
}

async function EnterBody() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getVerifiedUser() : null;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-14 sm:px-8 lg:grid-cols-2">
      <section className="flex flex-col gap-6">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Enter the game</p>
          <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">JOIN WITH A CODE</h1>
          <p className="mt-4 text-sm leading-6 text-mute">
            A display name is enough. Joining does not create an account, and the seat is stored
            with no user id.
          </p>
        </div>
        {configured ? (
          <JoinForm />
        ) : (
          <SetupNotice body="Guest join writes a participant through the server key." />
        )}
      </section>
      <section className="frame flex flex-col gap-5 px-6 py-6">
        <h2 className="font-display text-2xl tracking-[0.08em]">OPEN A ROOM</h2>
        {user?.profile ? (
          <>
            <p className="text-sm leading-6 text-mute">
              Signed in as {user.profile.display_name}. This account is the {user.profile.role}.
            </p>
            <CreateRoomForm />
            <CreateTableForm />
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-mute">
              Sign in to open a room. The first account becomes the owner. Later accounts are
              players. Guests do not need either.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/sign-in" className={ghostButtonClass}>
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={ghostButtonClass}>
                Create account
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
