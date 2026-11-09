"use client";

import { useState } from "react";
import { Nav } from "@/components/ui";

export default function EnterPage() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [playStyle, setPlayStyle] = useState("arena");
  const [drawMode, setDrawMode] = useState("random");

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const created = await fetch("/api/auth/player", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, pin, avatar: "mark" }) });
    const data = await created.json();
    if (!created.ok) return setError(data.error || "Could not register.");
    const joined = await fetch("/api/sessions/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const room = await joined.json();
    if (!joined.ok) return setError(room.error || "Could not join.");
    location.href = `/room/${room.session.code}`;
  }

  async function owner(mode: "claim" | "login") {
    setError("");
    const res = await fetch("/api/auth/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, username: ownerName, password, accessCode }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Owner sign-in failed.");
    const session = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playStyle, drawMode, preventDuplicates: true }) });
    const room = await session.json();
    if (!session.ok) return setError(room.error || "Could not open a room.");
    location.href = `/screen/${room.code}`;
  }

  return (
    <>
      <Nav />
      <main className="narrow stack">
        <section className="panel stack">
          <div className="kicker">Players</div>
          <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Join with a room code</h2>
          <form className="stack" onSubmit={join}>
            <label>Name<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
            <label>4-digit pin<input value={pin} inputMode="numeric" pattern="\d{4}" onChange={(event) => setPin(event.target.value)} required /></label>
            <label>Room code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label>
            <button className="btn" type="submit">Enter</button>
          </form>
        </section>
        <section className="panel stack">
          <div className="kicker">Owner</div>
          <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Open an arena</h2>
          <p className="meta">Put this browser on the television. Phones join with the code. On the published site, the owner key is OWNER_ACCESS_CODE. This dev server can claim the table without one.</p>
          <label>Owner name<input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Owner key<input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} /></label>
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
          <div className="dock">
            <button className="btn" onClick={() => owner("login")}>Open as owner</button>
            <button className="ghost" onClick={() => owner("claim")}>Claim the table</button>
          </div>
        </section>
        <p className="error">{error}</p>
      </main>
    </>
  );
}
