import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured, publicSupabaseKey, supabaseUrl } from "@/lib/supabase/env";

export function createPlayClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createBrowserClient(supabaseUrl(), publicSupabaseKey());
}
