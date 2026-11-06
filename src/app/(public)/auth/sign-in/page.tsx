import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/components/forms";
import { SetupNotice } from "@/components/setup-notice";
import { getVerifiedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/validate";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening sign in…</p>}>
      <SignInBody searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInBody({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = safeNextPath(rawNext ?? null) ?? undefined;

  if (isSupabaseConfigured()) {
    const user = await getVerifiedUser();
    if (user?.profile?.role === "owner") {
      redirect(nextPath?.startsWith("/owner") ? nextPath : "/owner");
    }
    if (user?.profile) {
      redirect(nextPath && !nextPath.startsWith("/owner") ? nextPath : "/enter");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Account</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">SIGN IN</h1>
        <p className="mt-4 text-sm leading-6 text-mute">
          Email and password. Guests can skip this and join from Enter the game.
        </p>
      </div>
      {isSupabaseConfigured() ? <SignInForm nextPath={nextPath} /> : <SetupNotice />}
      <p className="text-sm text-mute">
        No account yet?{" "}
        <Link href="/auth/sign-up" className="text-paper">
          Create one
        </Link>
        . The first account is the owner.
      </p>
    </main>
  );
}
