"use client";

import { useEffect, useState } from "react";

const SYMBOL: Record<string, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

export function ThemeBoot() {
  useEffect(() => {
    let stop = false;
    fetch("/api/theme")
      .then((res) => res.json())
      .then((data) => {
        if (stop || !data.theme) return;
        const root = document.documentElement;
        const theme = data.theme as Record<string, unknown>;
        const paint = (key: string, variable: string) => {
          const value = theme[key];
          if (typeof value === "string" && value) root.style.setProperty(variable, value);
        };
        paint("bg", "--bg");
        paint("panel", "--panel");
        paint("fg", "--fg");
        paint("red", "--red");
        paint("muted", "--muted");
        const fonts: Record<string, string> = {
          Oswald: "var(--font-display-face), Impact, sans-serif",
          "Big Shoulders Display": "var(--font-display-face), Impact, sans-serif",
          Outfit: "var(--font-body-face), sans-serif",
          Cinzel: "var(--font-cinzel), serif",
          "IBM Plex Mono": "var(--font-mono), monospace",
        };
        if (typeof theme.displayFont === "string" && fonts[theme.displayFont]) root.style.setProperty("--font-display", fonts[theme.displayFont]);
        if (typeof theme.bodyFont === "string" && fonts[theme.bodyFont]) root.style.setProperty("--font-body", fonts[theme.bodyFont]);
        document.body.classList.toggle("scanlines", theme.scanlines !== false);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, []);
  return null;
}

export function Nav() {
  const [account, setAccount] = useState<{ username: string; role: string } | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.account ?? null))
      .catch(() => setAccount(null));
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/account";
  }
  return (
    <header className="topbar">
      <a href="/">Suit of Survival</a>
      <nav>
        <a href="/enter">Enter</a>
        <a href="/library">Library</a>
        <a href="/how">How to play</a>
        <a href="/profile">{account ? account.username : "Profile"}</a>
        {account?.role === "owner" ? <a href="/owner">Owner</a> : null}
        {account ? <button className="text-link" onClick={logout}>Log out</button> : <a href="/account">Log in</a>}
      </nav>
    </header>
  );
}

export function CardFace({ suit, rank, name, flipped }: { suit: string; rank: string; name?: string; flipped: boolean }) {
  const symbol = SYMBOL[suit] ?? "♠";
  return (
    <div className={`playing-card suit-${suit} ${flipped ? "is-flipped" : ""}`}>
      <div className="card-inner">
        <div className="card-back">
          <span>♠</span>
        </div>
        <div className="card-face">
          <span className="corner">
            {rank}
            {symbol}
          </span>
          <b>{symbol}</b>
          <em>{name}</em>
          <span className="corner bottom">
            {rank}
            {symbol}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Portrait({ portraitKey, accent }: { portraitKey?: string; accent?: string }) {
  const key = portraitKey || "herald";
  const ink = accent || "#c4161c";
  return (
    <svg viewBox="0 0 200 240" role="img" aria-label={key}>
      <rect width="200" height="240" fill="#070707" />
      <path d="M20 220 L40 90 L100 40 L160 90 L180 220 Z" fill="none" stroke={ink} strokeWidth="2" />
      {key === "iris" && <polygon points="100,70 130,130 70,130" fill="none" stroke="#8ecbff" strokeWidth="2" />}
      {key === "solene" && <circle cx="100" cy="110" r="28" fill="none" stroke="#e23b3b" strokeWidth="2" />}
      {key === "halden" && <path d="M60 120 H140 M100 80 V150" stroke="#d6b25e" strokeWidth="2" />}
      {key === "ren" && <path d="M70 80 H130 L110 160 H90 Z" fill="none" stroke="#f4f1ea" strokeWidth="2" />}
      {key === "herald" && <rect x="78" y="78" width="44" height="64" fill="none" stroke={ink} strokeWidth="2" />}
      <path d="M30 200 H170" stroke={ink} strokeWidth="1" />
    </svg>
  );
}

export function Timer({ deadline, now, paused }: { deadline: number | null; now: number; paused?: boolean }) {
  const offset = now - Date.now();
  const [left, setLeft] = useState(deadline ? Math.max(0, deadline - (Date.now() + offset)) : 0);
  useEffect(() => {
    const id = setInterval(() => {
      if (!deadline) return setLeft(0);
      setLeft(Math.max(0, deadline - (Date.now() + offset)));
    }, 200);
    return () => clearInterval(id);
  }, [deadline, offset]);
  const seconds = Math.ceil(left / 1000);
  return (
    <div className="timer" aria-live="polite">
      {paused ? "HOLD" : deadline ? `${seconds}` : "—"}
    </div>
  );
}
