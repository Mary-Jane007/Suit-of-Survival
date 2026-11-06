import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OwnerNav } from "@/components/owner-nav";
import { ghostButtonClass } from "@/components/ui";
import { signOut } from "@/lib/actions";
import { getVerifiedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="px-8 py-10 text-sm text-mute">Checking the owner session…</p>}>
      <OwnerGate>{children}</OwnerGate>
    </Suspense>
  );
}

function OwnerChrome({
  displayName,
  children,
}: {
  displayName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.32em] text-blood-bright">Owner</p>
            <Link href="/" className="font-display text-2xl tracking-[0.18em]">
              SUIT OF SURVIVAL
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {displayName ? (
              <span className="text-xs uppercase tracking-[0.16em] text-mute">{displayName}</span>
            ) : (
              <Link href="/auth/sign-in?next=/owner" className="text-xs uppercase tracking-[0.16em]">
                Sign in
              </Link>
            )}
            {displayName ? (
              <form action={signOut}>
                <button type="submit" className="text-xs uppercase tracking-[0.16em] text-paper">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <OwnerNav />
      </header>
      <div className="px-4 py-10 sm:px-8">{children}</div>
    </div>
  );
}

async function OwnerGate({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <OwnerChrome displayName={null}>{children}</OwnerChrome>;
  }

  const user = await getVerifiedUser();
  if (!user) {
    redirect("/auth/sign-in?next=/owner");
  }

  if (user.profileError || !user.profile) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16 sm:px-8">
        <h1 className="font-display text-4xl tracking-[0.08em]">NO PROFILE</h1>
        <p className="text-sm leading-6 text-mute">
          {user.profileError ??
            "This account has no profile row. Apply the migrations, then create the account again."}
        </p>
        <form action={signOut}>
          <button type="submit" className={ghostButtonClass}>
            Sign out
          </button>
        </form>
      </main>
    );
  }

  if (user.profile.role !== "owner") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16 sm:px-8">
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Player</p>
        <h1 className="font-display text-4xl tracking-[0.08em]">THE DASHBOARD IS THE OWNER&apos;S</h1>
        <p className="text-sm leading-6 text-mute">
          {user.profile.display_name}, this account is a player. Only the first account can open
          the dashboard.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/enter" className={ghostButtonClass}>
            Enter the game
          </Link>
          <form action={signOut}>
            <button type="submit" className={ghostButtonClass}>
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <OwnerChrome displayName={user.profile.display_name}>{children}</OwnerChrome>;
}
