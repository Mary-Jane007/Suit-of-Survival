import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignUpForm } from "@/components/forms";
import { SetupNotice } from "@/components/setup-notice";
import { getVerifiedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<p className="px-8 py-14 text-sm text-mute">Opening sign up…</p>}>
      <SignUpBody />
    </Suspense>
  );
}

async function SignUpBody() {
  if (isSupabaseConfigured()) {
    const user = await getVerifiedUser();
    if (user?.profile?.role === "owner") {
      redirect("/owner");
    }
    if (user?.profile) {
      redirect("/enter");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">Account</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">CREATE ACCOUNT</h1>
        <p className="mt-4 text-sm leading-6 text-mute">
          The first profile becomes the owner. Every profile after that is a player. You can still
          join a room without an account.
        </p>
      </div>
      {isSupabaseConfigured() ? <SignUpForm /> : <SetupNotice />}
      <p className="text-sm text-mute">
        Already registered?{" "}
        <Link href="/auth/sign-in" className="text-paper">
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}
