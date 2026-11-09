"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primeSound } from "@/components/table-sound";
import { Nav } from "@/components/ui";

type Account = { username: string; role: string };

export default function EnterPage() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [playStyle, setPlayStyle] = useState("arena");
  const [drawMode, setDrawMode] = useState("random");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.account ?? null))
      .catch(() => setAccount(null));
  }, []);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const joined = await fetch("/api/sessions/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const room = await joined.json();
    if (!joined.ok) return setError(room.error || "Could not join.");
    location.href = `/room/${room.session.code}`;
  }

  async function openArena() {
    primeSound();
    setError("");
    const session = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playStyle, drawMode, preventDuplicates: true }) });
    const room = await session.json();
    if (!session.ok) return setError(room.error || "Could not open a room.");
    router.push(`/screen/${room.code}`);
  }

  return (
    <>
      <Nav />
      <main className="narrow stack">
        {account === undefined ? <p className="meta">Checking the table…</p> : null}
        {account === null ? (
          <section className="panel stack">
            <div className="kicker">Account</div>
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Sign in before you sit down</h2>
            <p>Your clears stay on the account. The first person to sign up is the owner.</p>
            <div className="dock">
              <a className="btn" href="/account?mode=login&next=/enter">Log in</a>
              <a className="ghost" href="/account?mode=signup&next=/enter">Sign up</a>
            </div>
          </section>
        ) : null}
        {account ? (
          <section className="panel stack">
            <div className="kicker">{account.role === "owner" ? "Owner" : "Player"}</div>
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>{account.username}</h2>
            <p className="meta">Signed in. Cards you have already cleared are on your profile.</p>
            <form className="stack" onSubmit={join}>
              <label>Room code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label>
              <button className="btn" type="submit">Join the room</button>
            </form>
          </section>
        ) : null}
        {account?.role === "owner" ? (
          <section className="panel stack">
            <div className="kicker">Arena</div>
            <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Open a room</h2>
            <p className="meta">Put this browser on the television. Phones join with the code.</p>
            <div className="grid-2">
              <label>Style
                <select value={playStyle} onChange={(event) => setPlayStyle(event.target.value)}>
                  <option value="arena">Shared draw</option>
                  <option value="hands">Dealt hands</option>
                </select>
              </label>
              <label>Draw
                <select value={drawMode} onChange={(event) => setDrawMode(event.target.value)}>
                  <option value="random">Random</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
            </div>
            <button className="btn" onClick={openArena}>Open the arena</button>
          </section>
        ) : null}
        <p className="error">{error}</p>
      </main>
    </>
  );
}
