"use client";

import { AnswerForm } from "@/components/play-room";
import { PlaySync } from "@/components/play-sync";
import { suitSymbol } from "@/lib/format";
import { stopRoom } from "@/lib/play/actions";
import type { PlayView } from "@/lib/play/service";
import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { ghostButtonClass } from "@/components/ui";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

export function PhoneScreen({ view }: { view: PlayView }) {
  const [state, action] = useActionState(stopRoom, initial);
  const canStop = view.you?.status === "active" && (view.you.role === "phone" || view.you.role === "player");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <PlaySync sessionId={view.sessionId} />
      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-blood-bright">{view.roomCode}</p>
      {view.card ? (
        <article className="border border-line bg-charcoal p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-blood-bright">
            {suitSymbol(view.card.suit)} {view.card.rank}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-[0.06em]">{view.card.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{view.card.prompt}</p>
          {view.card.physicalOptional ? <p className="mt-3 text-sm text-mute">The physical version is optional.</p> : null}
          {view.card.phoneAlternative ? <p className="mt-2 text-sm leading-6">Phone: {view.card.phoneAlternative}</p> : null}
          {view.hint ? <p className="mt-3 text-sm leading-6">Hint: {view.hint}</p> : null}
          {view.card.privateNote ? <p className="mt-3 text-sm">{view.card.privateNote}</p> : null}
          <AnswerForm view={view} />
        </article>
      ) : (
        <p className="text-sm text-mute">Waiting for the host to start.</p>
      )}
      <p className="text-sm text-mute">
        {view.you ? `${view.you.role} · ${view.you.status}` : "This phone is not seated."} · {view.players.find((player) => player.id === view.you?.id)?.points ?? 0} points
      </p>
      {canStop && view.status === "live" ? (
        <form action={action}>
          <input type="hidden" name="room" value={view.roomCode} />
          {state.error ? <p className="mb-2 text-sm text-blood-bright">{state.error}</p> : null}
          <SubmitButton className={ghostButtonClass} pendingLabel="Stopping">
            Stop
          </SubmitButton>
        </form>
      ) : null}
    </main>
  );
}
