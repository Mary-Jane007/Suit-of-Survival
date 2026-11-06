"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createPlayClient } from "@/lib/supabase/browser";

export function PlaySync({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createPlayClient();
    const poll = window.setInterval(() => router.refresh(), 4000);
    if (!supabase) {
      return () => window.clearInterval(poll);
    }
    const channel = supabase.channel(`session:${sessionId}`);
    channel.on("broadcast", { event: "state" }, () => {
      router.refresh();
    });
    channel.subscribe();
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [router, sessionId]);

  return null;
}
