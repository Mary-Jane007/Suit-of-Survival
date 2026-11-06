import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";

export type VerifiedUser = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  profileError: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

function readProfile(value: unknown): Profile | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (typeof row.user_id !== "string" || typeof row.display_name !== "string") {
    return null;
  }
  if (row.role !== "owner" && row.role !== "player") {
    return null;
  }
  if (typeof row.created_at !== "string") {
    return null;
  }

  return {
    user_id: row.user_id,
    display_name: row.display_name,
    role: row.role,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    created_at: row.created_at,
  };
}

export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  await connection();

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, role, avatar_url, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    userId,
    email,
    profile: readProfile(profileRow),
    profileError: profileError?.message ?? null,
    supabase,
  };
}
