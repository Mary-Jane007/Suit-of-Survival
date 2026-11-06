"use client";

import { useRouter } from "next/navigation";
import { useEffect, useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { areaClass, fieldClass, ghostButtonClass } from "@/components/ui";
import { suitSymbol } from "@/lib/format";
import {
  advanceRoom,
  answerRoom,
  endRoom,
  pauseRoom,
  resumeRoom,
  startRoom,
  stopRoom,
} from "@/lib/play/actions";
import type { PlayView } from "@/lib/play/service";
import { createPlayClient } from "@/lib/supabase/browser";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="text-sm text-blood-bright">{state.error}</p>;
  }
  if (state.message) {
    return <p className="text-sm text-paper">{state.message}</p>;
  }
  return null;
}

function RoomButton({
  action,
  room,
  label,
  pending,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  room: string;
  label: string;
  pending: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room" value={room} />
      <Feedback state={state} />
      <SubmitButton className={ghostButtonClass} pendingLabel={pending}>
        {label}
      </SubmitButton>
    </form>
  );
}

function AnswerForm({ view }: { view: PlayView }) {
  const [state, action] = useActionState(answerRoom, initial);
  const card = view.card;
  if (!card || !card.yours || card.input === "done" || card.input === "unresolved") {
    return null;
  }

  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="room" value={view.roomCode} />
      <Feedback state={state} />
      {card.input === "text" ? <textarea className={areaClass} name="text" required /> : null}
      {card.input === "number" ? <input className={fieldClass} name="text" inputMode="numeric" required /> : null}
      {card.input === "choice" || card.input === "player" || card.input === "role" ? (
        <select className={fieldClass} name={card.input === "role" ? "role" : card.input === "player" ? "target" : "choice"} required>
          <option value="">Choose</option>
          {(card.options.length > 0 ? card.options : card.choices.map((choice) => ({ value: choice, label: choice }))).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {card.input === "role" ? (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="agree" />
          Agree to every choice
        </label>
      ) : null}
      {card.input === "weather" ? (
        <select className={fieldClass} name="weather" required>
          <option value="">One weather detail?</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : null}
      {card.input === "guess" ? (
        <select className={fieldClass} name="guess" required>
          <option value="">Your guess</option>
          <option value="true">It matches</option>
          <option value="false">It does not match</option>
        </select>
      ) : null}
      {card.input === "assign" ? (
        <>
          <select className={fieldClass} name="target" required>
            <option value="">Player</option>
            {view.players
              .filter((player) => player.id !== view.you?.id && player.status === "active")
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
          <select className={fieldClass} name="card" required>
            <option value="">Published card</option>
            {card.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {card.input === "bluff" ? (
        <>
          <input className={fieldClass} name="first" placeholder="First card" required />
          <input className={fieldClass} name="second" placeholder="Second card" required />
          <input className={fieldClass} name="correct" placeholder="Marked card" required />
        </>
      ) : null}
      {card.input === "trade" ? (
        <>
          <select className={fieldClass} name="own" required>
            <option value="">Your card</option>
            {card.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input className={fieldClass} name="theirs" placeholder="Card from their hand" required />
        </>
      ) : null}
      {card.input === "pass" ? (
        <>
          <select className={fieldClass} name="card" required>
            <option value="">Your card</option>
            {card.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className={fieldClass} name="target" required>
            <option value="">Pass to</option>
            {view.players
              .filter((player) => player.status === "active")
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </>
      ) : null}
      {card.input === "tap" ? <input type="hidden" name="action" value="tap" /> : null}
      {card.input === "token" ? <input type="hidden" name="action" value="pass_token" /> : null}
      {card.input === "cup" ? <input type="hidden" name="action" value="place" /> : null}
      {card.input === "hold" || card.input === "still" ? (
        <div className="flex flex-wrap gap-3">
          <button className={ghostButtonClass} name="action" value={card.input === "hold" ? "hold_start" : "still_start"} type="submit">
            Start
          </button>
          <button className={ghostButtonClass} name="action" value={card.input === "hold" ? "hold_end" : "tap"} type="submit">
            {card.input === "hold" ? "Release" : "Tap"}
          </button>
        </div>
      ) : (
        <SubmitButton pendingLabel="Sending">
          {card.input === "tap" || card.input === "token" || card.input === "cup" ? "Send" : "Submit"}
        </SubmitButton>
      )}
    </form>
  );
}

export function PlayRoom({ view }: { view: PlayView }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createPlayClient();
    if (!supabase) {
      return;
    }
    const channel = supabase.channel(`session:${view.sessionId}`);
    channel.on("broadcast", { event: "state" }, () => {
      router.refresh();
    });
    channel.subscribe();
    const poll = window.setInterval(() => router.refresh(), 4000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [router, view.sessionId]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-14 sm:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.32em] text-blood-bright">
          {view.status} · {view.drawsDone}/{view.drawLimit}
        </p>
        <h1 className="mt-3 font-display text-6xl tracking-[0.22em]">{view.roomCode}</h1>
        {view.announcement ? <p className="mt-4 text-sm leading-6 text-paper">{view.announcement}</p> : null}
      </div>
      <section className="frame px-6 py-6">
        <h2 className="font-display text-2xl tracking-[0.08em]">IN THE ROOM</h2>
        <ul className="mt-4 divide-y divide-line">
          {view.players.map((player) => (
            <li key={player.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <span>
                {player.name}
                {player.id === view.you?.id ? <span className="ml-3 text-xs uppercase tracking-[0.16em] text-blood-bright">You</span> : null}
              </span>
              <span className="text-xs uppercase tracking-[0.16em] text-mute">
                {player.role} · {player.status} · {player.points}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {view.card ? (
        <article className="border border-line bg-charcoal p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-blood-bright">
            {suitSymbol(view.card.suit)} {view.card.rank} · {view.card.kind}
            {view.card.innerCount > 1 ? ` · ${view.card.inner}/${view.card.innerCount}` : ""}
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-[0.06em]">{view.card.title}</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{view.card.prompt}</p>
          {view.card.question ? <p className="mt-4 text-sm leading-7">{view.card.question}</p> : null}
          {view.card.privateNote ? <p className="mt-4 text-sm text-paper">{view.card.privateNote}</p> : null}
          {view.card.input === "unresolved" ? (
            <p className="mt-4 text-sm text-blood-bright">This card cannot be scored from the stored row. No points are written.</p>
          ) : null}
          <AnswerForm view={view} />
        </article>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {view.isHost && view.status === "lobby" ? (
          <RoomButton action={startRoom} room={view.roomCode} label="Start" pending="Starting" />
        ) : null}
        {view.isHost && view.status === "live" ? (
          <RoomButton action={pauseRoom} room={view.roomCode} label="Pause" pending="Pausing" />
        ) : null}
        {view.isHost && view.status === "paused" ? (
          <RoomButton action={resumeRoom} room={view.roomCode} label="Resume" pending="Resuming" />
        ) : null}
        {view.isHost && (view.status === "live" || view.status === "paused") ? (
          <RoomButton action={endRoom} room={view.roomCode} label="End" pending="Ending" />
        ) : null}
        {view.isHost && view.status === "live" && view.card?.input === "unresolved" ? (
          <RoomButton action={advanceRoom} room={view.roomCode} label="Continue" pending="Continuing" />
        ) : null}
        {view.you?.status === "active" && view.status === "live" ? (
          <RoomButton action={stopRoom} room={view.roomCode} label="Stop" pending="Stopping" />
        ) : null}
      </div>
    </main>
  );
}
