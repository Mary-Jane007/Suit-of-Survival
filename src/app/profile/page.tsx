"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/ui";

export default function ProfilePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch("/api/me").then((res) => res.json()).then(setData);
  }, []);
  const account = data?.account as { username: string; role: string } | null;
  const totals = data?.totals as { score?: string; clears?: string } | undefined;
  const collection = (data?.collection as { id: string; name: string; suit: string; rank: string }[]) ?? [];
  const history = (data?.history as { name: string; delta: number; reason: string }[]) ?? [];
  const achievements = (data?.achievements as { name: string; description: string }[]) ?? [];
  return (
    <>
      <Nav />
      <main className="wide stack">
        <p className="kicker">Profile</p>
        <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>{account?.username || "No one is signed in"}</h1>
        {account ? <p className="meta">{account.role === "owner" ? "Owner" : "Player"} · {totals?.score ?? 0} points · {totals?.clears ?? 0} cards. This stays when you log in again.</p> : <a className="btn" href="/account?next=/profile">Log in</a>}
        <section>
          <h2>Collection</h2>
          <div className="lib-grid">
            {collection.map((card) => (
              <a key={card.id} className={`lib-card suit-${card.suit}`} href={`/library/${card.id}`}>
                <strong>{card.rank}</strong>
                <span>{card.name}</span>
              </a>
            ))}
          </div>
          {account && collection.length === 0 ? <p className="meta">No cards cleared yet.</p> : null}
        </section>
        <section className="grid-2">
          <article className="panel">
            <h2>Achievements</h2>
            {achievements.map((item) => <p key={item.name}><strong>{item.name}.</strong> {item.description}</p>)}
            {account && achievements.length === 0 ? <p className="meta">None yet.</p> : null}
          </article>
          <article className="panel">
            <h2>Recent scores</h2>
            {history.map((item, index) => <p key={index}>{item.name || "Effect"} · {item.delta} · {item.reason}</p>)}
          </article>
        </section>
      </main>
    </>
  );
}
