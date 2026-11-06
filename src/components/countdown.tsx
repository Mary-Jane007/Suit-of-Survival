"use client";

import { useEffect, useState } from "react";

export function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="font-display text-7xl tracking-[0.12em] text-blood-bright" aria-live="polite">
      {left}
    </p>
  );
}
