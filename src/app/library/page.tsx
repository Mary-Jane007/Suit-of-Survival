import { Nav } from "@/components/ui";
import { library } from "@/lib/room";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const games = (await library()) as { id: string; name: string; suit: string; rank: string; description: string; source: string; difficulty: number }[];
  const suits = ["diamonds", "hearts", "clubs", "spades"];
  return (
    <>
      <Nav />
      <main className="wide stack">
        <p className="kicker">The deck</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px, 8vw, 92px)", margin: 0 }}>Fifty-two challenges</h1>
        {suits.map((suit) => (
          <section key={suit}>
            <h2 className={`suit-${suit}`} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.12em" }}>{suit.toUpperCase()}</h2>
            <div className="lib-grid">
              {games.filter((game) => game.suit === suit).map((game) => (
                <a key={game.id} className={`lib-card suit-${suit}`} href={`/library/${game.id}`}>
                  <strong>{game.rank}</strong>
                  <span>{game.name}</span>
                  <span className="meta">{game.source === "notion" ? "From the notes" : "Starter"}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
