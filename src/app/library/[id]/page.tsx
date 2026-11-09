import { cookies } from "next/headers";
import { Nav } from "@/components/ui";
import { LibraryEditor } from "@/components/library-editor";
import { COOKIE, accountFromToken } from "@/lib/auth";
import { library } from "@/lib/room";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = (await library(id)) as Record<string, unknown> | null;
  if (!game) notFound();
  const token = (await cookies()).get(COOKIE)?.value;
  const account = await accountFromToken(token);
  const owner = account?.role === "owner";
  return (
    <>
      <Nav />
      <main className="narrow stack">
        <p className={`kicker suit-${game.suit}`}>{String(game.rank)} of {String(game.suit)} · {String(game.source) === "notion" ? "From the notes" : "Starter card"}</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 72, margin: 0 }}>{String(game.name)}</h1>
        {owner ? (
          <LibraryEditor game={{
            id: String(game.id),
            name: String(game.name ?? ""),
            description: String(game.description ?? ""),
            rules: String(game.rules ?? ""),
            rulesOriginal: String(game.rules_original ?? ""),
            instructions: String(game.instructions ?? ""),
            objective: String(game.objective ?? ""),
            win: String(game.win_condition ?? ""),
            fail: String(game.fail_condition ?? ""),
            scoring: String(game.scoring_summary ?? ""),
            materials: String(game.materials ?? ""),
            safety: String(game.safety_note ?? ""),
          }} />
        ) : (
          <article className="panel stack">
            <p>{String(game.description)}</p>
            <p>{String(game.rules)}</p>
            <p className="meta">Objective · {String(game.objective)}</p>
            <p className="meta">Clear · {String(game.win_condition)}</p>
            <p className="meta">Miss · {String(game.fail_condition)}</p>
            <p className="meta">Score · {String(game.scoring_summary)}</p>
            <p className="meta">{String(game.min_players)}–{String(game.max_players)} players · {String(game.timer_seconds)}s · {String(game.materials)}</p>
            <p className="safety">{String(game.safety_note)}</p>
            {game.rules_original ? <details><summary className="meta">Original note</summary><p>{String(game.rules_original)}</p></details> : null}
          </article>
        )}
      </main>
    </>
  );
}
