import { Nav } from "@/components/ui";

export default function HowPage() {
  return (
    <>
      <Nav />
      <main className="wide stack">
        <p className="kicker">How the night works</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px, 8vw, 92px)", margin: 0 }}>One screen. Every phone.</h1>
        <p>The first account is the owner. Everyone who signs up after that is a player. Log in with the same name and password and the cards, scores, and achievements are still there. Put the owner’s browser on a television. Everyone else opens the room code on a phone. The screen is the representative. The phones are how you answer, vote, and choose. You can stop whenever you want. Points, benching, and the words life, end, wolf, and failure are digital. Nothing here asks for a stunt, a secret, or a punishment.</p>
        <div className="grid-2">
          <article className="panel"><h2>Spades</h2><p>Memory, observation, and optional seated movement. The phone is the score. Standing is never required.</p></article>
          <article className="panel"><h2>Hearts</h2><p>Trust, bluff, and agreement. Lie about a card if you like. Do not use a real secret.</p></article>
          <article className="panel"><h2>Diamonds</h2><p>Logic, patterns, and the balance scale. The server scores the answer. A phone cannot invent its own points.</p></article>
          <article className="panel"><h2>Clubs</h2><p>Someone else is holding the fragment you need. Say it out loud.</p></article>
        </div>
        <article className="panel">
          <h2>From the original notes</h2>
          <p>The Hearts games and the written Diamonds games come from the Notion deck, including Door of Life, Decode, Memory, Two Doors, The Box, Light Switch, Balance Scale, and every Hearts title from Generosity through Face Cards. Their original Dutch text is kept on each record. Clubs, Spades, and the empty Diamond pages had no rules yet. Those cards are starter games, marked as such, and the owner can rewrite or delete them.</p>
          <p>Door of Life still moves the way the note says: life one wall to the left, end one wall to the right. The Box is still Box B. Balance Scale is still the average, multiplied by 0.8, across five rounds. Wolf among Sheep still costs −5 to cover someone else, and covering yourself still does nothing.</p>
        </article>
      </main>
    </>
  );
}
