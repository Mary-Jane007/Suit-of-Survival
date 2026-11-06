import Link from "next/link";

import { signOut } from "@/lib/actions";
import { getVerifiedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function AccountSlot() {
  if (!isSupabaseConfigured()) {
    return (
      <Link href="/auth/sign-in" className="text-xs uppercase tracking-[0.18em] text-mute">
        Sign in
      </Link>
    );
  }

  const user = await getVerifiedUser();
  if (!user) {
    return (
      <Link href="/auth/sign-in" className="text-xs uppercase tracking-[0.18em] text-paper">
        Sign in
      </Link>
    );
  }

  const name = user.profile?.display_name ?? "Account";
  const owner = user.profile?.role === "owner";

  return (
    <div className="flex items-center gap-4 text-xs uppercase tracking-[0.16em]">
      <span className="text-mute">{name}</span>
      {owner ? (
        <Link href="/owner" className="text-blood-bright">
          Owner
        </Link>
      ) : null}
      <form action={signOut}>
        <button type="submit" className="uppercase tracking-[0.16em] text-paper">
          Sign out
        </button>
      </form>
    </div>
  );
}
