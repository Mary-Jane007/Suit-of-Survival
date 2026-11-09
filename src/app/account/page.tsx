"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/ui";

const AVATARS = ["mark", "ring", "slash", "crest", "signal", "veil", "axis", "glyph"];

function nextPath() {
  const next = new URLSearchParams(location.search).get("next") ?? "";
  if (!next.startsWith("/") || next.startsWith("//")) return "";
  return next;
}

export default function AccountPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("mark");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "login") setMode("login");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, avatar }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Could not continue.");
    const next = nextPath();
    location.href = next || (data.role === "owner" ? "/enter" : "/profile");
  }

  return (
    <>
      <Nav />
      <main className="narrow stack">
        <section className="panel stack">
          <div className="kicker">{mode === "signup" ? "Sign up" : "Log in"}</div>
          <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>{mode === "signup" ? "Take a name" : "Return to your cards"}</h1>
          <p className="meta">One account is the owner and can edit every game, card, and rule. Every other signup is a player. Logging in brings back the same cards, scores, and achievements.</p>
          <div className="dock">
            <button className={mode === "signup" ? "btn" : "ghost"} type="button" onClick={() => { setMode("signup"); setError(""); }}>Sign up</button>
            <button className={mode === "login" ? "btn" : "ghost"} type="button" onClick={() => { setMode("login"); setError(""); }}>Log in</button>
          </div>
          <form className="stack" onSubmit={submit}>
            <label>Name<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></label>
            {mode === "signup" ? (
              <label>Mark
                <select value={avatar} onChange={(event) => setAvatar(event.target.value)}>
                  {AVATARS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            ) : null}
            <button className="btn" type="submit">{mode === "signup" ? "Create account" : "Log in"}</button>
          </form>
          <p className="error">{error}</p>
        </section>
      </main>
    </>
  );
}
