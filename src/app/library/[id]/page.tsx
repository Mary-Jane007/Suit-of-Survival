import { cookies } from "next/headers";
import { Nav } from "@/components/ui";
import { LibraryEditor } from "@/components/library-editor";
import { COOKIE, accountFromToken } from "@/lib/auth";
import { answerField, isQuestionFormat } from "@/lib/answers";
import { equationSettings } from "@/lib/equation";
import { queenSettings } from "@/lib/queen";
import { library } from "@/lib/room";
import type { GameDefinition } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(COOKIE)?.value;
  const account = await accountFromToken(token);
  const owner = account?.role === "owner";
  const game = (await library(id, { secrets: owner })) as Record<string, unknown> | null;
  if (!game) notFound();
  const definition = (game.definition ?? {}) as GameDefinition;
  const queen = String(game.format) === "queens_touch" ? queenSettings(definition) : null;
  const equation = String(game.format) === "perfect_equation" ? equationSettings(definition) : null;
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
            queen,
            equation,
            minPlayers: Number(game.min_players ?? 1),
            maxPlayers: Number(game.max_players ?? 8),
            timerSeconds: Number(game.timer_seconds ?? 60),
            rounds: Number(game.rounds ?? 1),
            successPoints: Number(definition.successPoints ?? 5),
            failPoints: Number(definition.failPoints ?? 0),
            question: isQuestionFormat(String(game.format ?? "")),
            answers: answerField(definition),
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
