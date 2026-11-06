import type { Metadata } from "next";
import Link from "next/link";

import { solidButtonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "How to play",
};

export default function HowToPlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">How to play</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.08em]">READ THE LIBRARY. THE LOBBY WAITS.</h1>
      </div>
      <div className="space-y-5 text-sm leading-7 text-paper">
        <p>
          Join with a display name and a room code. An account is optional. The person who opens
          the room signs in. Everyone else can stay a guest.
        </p>
        <p>
          The first account created is the owner. Every account after that is a player. The owner
          dashboard is where games, cards, and announcements are published.
        </p>
        <p>
          Published cards are in the game library. The host starts a room, and the server deals and
          scores. This version does not run a shared screen or a phone controller.
        </p>
      </div>
      <div className="frame px-6 py-6">
        <h2 className="font-display text-2xl tracking-[0.08em]">SAFETY</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-mute">
          <li>Elimination, when it exists, is a digital status. It changes nothing outside the app.</li>
          <li>A player can always stop.</li>
          <li>No real danger, violence, weapons, stunts, or punishment.</li>
          <li>Hearts must not humiliate anyone or press for a private story.</li>
          <li>A physical task, if one is offered later, is optional, low-risk, and indoor.</li>
        </ul>
      </div>
      <Link href="/enter" className={`${solidButtonClass} self-start`}>
        Enter the game
      </Link>
    </main>
  );
}
