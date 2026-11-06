"use client";

import { useEffect, useState } from "react";

export function DeadlineClock({ deadline }: { deadline: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft(Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return (
    <p className="font-display text-7xl tracking-[0.12em] text-blood-bright" aria-live="polite">
      {left}
    </p>
  );
}
