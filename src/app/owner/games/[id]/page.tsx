import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GameEditor, NewCardForm } from "@/components/content-forms";
import { QueryError } from "@/components/empty-state";
import { OwnerPage } from "@/components/owner-page";
import { SetupNotice } from "@/components/setup-notice";
import { suitLabel, suitSymbol } from "@/lib/format";
import { getOwnerGame, listRepresentativeOptions } from "@/lib/content-queries";

export const metadata: Metadata = {
  title: "Edit game",
};

export default function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">Reading the game…</p>}>
      <EditGameBody params={params} />
    </Suspense>
  );
}

async function EditGameBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [gameResult, people] = await Promise.all([getOwnerGame(id), listRepresentativeOptions()]);

  if ("unconfigured" in gameResult) {
    return (
      <OwnerPage kicker="Games" title="EDIT GAME" lede="The editor writes to the games table.">
        <SetupNotice />
      </OwnerPage>
    );
  }
  if (!gameResult.ok) {
    return (
      <OwnerPage kicker="Games" title="EDIT GAME" lede="The editor writes to the games table.">
        <QueryError message={gameResult.message} />
      </OwnerPage>
    );
  }

  const representatives = people.ok ? people.rows : [];

  return (
    <OwnerPage kicker="Games" title={gameResult.game.title} lede="Rules, representative, and status are stored on the game row.">
      <GameEditor game={gameResult.game} representatives={representatives} />
      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-[0.08em]">CARDS</h2>
        <ul className="mt-4 divide-y divide-line border border-line">
          {gameResult.cards.map((card) => (
            <li key={card.id}>
              <Link href={`/owner/cards/${card.id}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-charcoal">
                <span>
                  {suitSymbol(card.suit)} {card.rank} {suitLabel(card.suit)} · {card.title || "Untitled"}
                </span>
                <span className="text-xs uppercase tracking-[0.14em] text-mute">
                  {card.source} · {card.publishable ? "publishable" : "held"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <h3 className="mb-4 text-xs uppercase tracking-[0.16em] text-mute">Add a proposal card</h3>
          <NewCardForm gameId={gameResult.game.id} />
        </div>
      </section>
    </OwnerPage>
  );
}
