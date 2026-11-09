import { Nav } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="hero">
        <div>
          <div className="kicker">A private arena</div>
          <h1 className="glitch" data-text="SUIT OF SURVIVAL">SUIT OF SURVIVAL</h1>
          <p className="lede">The game has begun.</p>
          <div className="suit-cycle" aria-hidden="true">
            <span>♠</span>
            <span>♥</span>
            <span>♦</span>
            <span>♣</span>
          </div>
          <div className="row">
            <a className="btn" href="/account">Sign up or log in</a>
            <a className="ghost" href="/enter">Enter the game</a>
            <a className="ghost" href="/library">Game library</a>
            <a className="ghost" href="/how">How to play</a>
          </div>
        </div>
      </main>
    </>
  );
}
