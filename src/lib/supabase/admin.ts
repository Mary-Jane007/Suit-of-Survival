import "server-only";

import { createClient } from "@supabase/supabase-js";

import { isServerKeyConfigured, serverSupabaseKey, supabaseUrl } from "@/lib/supabase/env";

export function createAdminClient() {
  if (!isServerKeyConfigured()) {
    return null;
  }

  return createClient(supabaseUrl(), serverSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
