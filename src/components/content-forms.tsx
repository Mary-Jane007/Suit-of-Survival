"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { areaClass, fieldClass, ghostButtonClass } from "@/components/ui";
import {
  createCard,
  createGame,
  deleteCard,
  deleteGame,
  duplicateGame,
  updateAnnouncement,
  updateCard,
  updateGame,
  updateRepresentative,
} from "@/lib/content-actions";
import { asObject, effectNumber, hintsText, scoringText, secretAnswer } from "@/lib/public-effect";
import type { ActionState } from "@/lib/types";
import { CARD_SUITS, RANKS, SUITS } from "@/lib/validate";

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

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
      {label}
      <input className={fieldClass} name={name} defaultValue={defaultValue} required={required} />
    </label>
  );
}

export function NewGameForm() {
  const [state, action] = useActionState(createGame, initial);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <Feedback state={state} />
      <Field label="Title" name="title" required />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Suit
        <select className={fieldClass} name="suit" defaultValue="any">
          {SUITS.map((suit) => (
            <option key={suit} value={suit}>
              {suit}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Summary
        <textarea className={areaClass} name="summary" />
      </label>
      <SubmitButton>Create draft</SubmitButton>
    </form>
  );
}

export function GameEditor({
  game,
  representatives,
}: {
  game: {
    id: string;
    title: string;
    slug: string;
    suit: string;
    summary: string;
    status: string;
    source: string;
    representative_id: string | null;
    rules: unknown;
  };
  representatives: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateGame, initial);
  const [copyState, copy] = useActionState(duplicateGame, initial);
  const [deleteState, remove] = useActionState(deleteGame, initial);
  const rules = asObject(game.rules);

  return (
    <div className="flex flex-col gap-10">
      <form action={action} className="grid max-w-3xl gap-4">
        <Feedback state={state} />
        <input type="hidden" name="id" value={game.id} />
        <p className="text-xs uppercase tracking-[0.16em] text-mute">Source {game.source}. Source stays as stored.</p>
        <Field label="Title" name="title" defaultValue={game.title} required />
        <Field label="Slug" name="slug" defaultValue={game.slug} required />
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Suit
          <select className={fieldClass} name="suit" defaultValue={game.suit}>
            {SUITS.map((suit) => (
              <option key={suit} value={suit}>
                {suit}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Status
          <select className={fieldClass} name="status" defaultValue={game.status}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Representative
          <select className={fieldClass} name="representative_id" defaultValue={game.representative_id ?? ""}>
            <option value="">None</option>
            {representatives.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Summary
          <textarea className={areaClass} name="summary" defaultValue={game.summary} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Draws" name="draws" defaultValue={effectNumber(rules, "draws")} />
          <Field label="Hand size" name="hand_size" defaultValue={effectNumber(rules, "hand_size")} />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="digital_elimination" defaultChecked={rules.digital_elimination === true} />
          Digital elimination is recorded on this game
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="physical_offered" defaultChecked={rules.physical_offered === true} />
          Physical challenges are offered
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Rules notes
          <textarea className={areaClass} name="rules_notes" defaultValue={typeof rules.notes === "string" ? rules.notes : ""} />
        </label>
        <SubmitButton>Save game</SubmitButton>
      </form>
      <form action={copy} className="flex items-center gap-4">
        <input type="hidden" name="id" value={game.id} />
        <Feedback state={copyState} />
        <SubmitButton className={ghostButtonClass}>Duplicate as draft</SubmitButton>
      </form>
      <form action={remove} className="grid max-w-md gap-3 border border-line p-4">
        <input type="hidden" name="id" value={game.id} />
        <input type="hidden" name="slug" value={game.slug} />
        <Feedback state={deleteState} />
        <Field label="Type the slug to delete" name="confirm" />
        <SubmitButton>Delete game</SubmitButton>
      </form>
    </div>
  );
}

export function NewCardForm({ gameId }: { gameId: string }) {
  const [state, action] = useActionState(createCard, initial);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <Feedback state={state} />
      <input type="hidden" name="game_id" value={gameId} />
      <Field label="Title" name="title" required />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Suit
        <select className={fieldClass} name="suit" defaultValue="diamonds">
          {CARD_SUITS.map((suit) => (
            <option key={suit} value={suit}>
              {suit}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Rank
        <select className={fieldClass} name="rank" defaultValue="A">
          {RANKS.map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton>Add draft card</SubmitButton>
    </form>
  );
}

export function CardEditor({
  card,
  secret,
  representatives,
}: {
  card: {
    id: string;
    game_id: string | null;
    title: string;
    prompt: string;
    source: string;
    publishable: boolean;
    representative_id: string | null;
    effect: unknown;
  };
  secret: unknown;
  representatives: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateCard, initial);
  const [deleteState, remove] = useActionState(deleteCard, initial);
  const effect = asObject(card.effect);
  const warning = [effect.safety, effect.owner_note, effect.withheld]
    .filter((value) => typeof value === "string" && value)
    .join(" ");

  return (
    <div className="flex flex-col gap-10">
      <form action={action} className="grid max-w-3xl gap-4">
        <Feedback state={state} />
        <input type="hidden" name="id" value={card.id} />
        <p className="text-xs uppercase tracking-[0.16em] text-mute">Source {card.source}. Source stays as stored.</p>
        {warning ? <p className="border border-blood px-3 py-2 text-sm text-blood-bright">{warning}</p> : null}
        <Field label="Title" name="title" defaultValue={card.title} required />
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Prompt
          <textarea className={areaClass} name="prompt" defaultValue={card.prompt} />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Representative
          <select className={fieldClass} name="representative_id" defaultValue={card.representative_id ?? ""}>
            <option value="">None</option>
            {representatives.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rounds" name="rounds" defaultValue={effectNumber(effect, "rounds")} />
          <Field label="Timer seconds" name="timer_seconds" defaultValue={effectNumber(effect, "timer_seconds")} />
        </div>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Question
          <textarea className={areaClass} name="question" defaultValue={typeof effect.question === "string" ? effect.question : ""} />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Hints, one per line
          <textarea className={areaClass} name="hints" defaultValue={hintsText(effect)} />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Scoring JSON
          <textarea className={areaClass} name="scoring" defaultValue={scoringText(effect)} />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Hidden answer
          <textarea className={areaClass} name="secret_answer" defaultValue={secretAnswer(secret)} />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="in_play" defaultChecked={effect.in_play !== false} />
          In play
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="publishable" defaultChecked={card.publishable} />
          Publishable
        </label>
        <SubmitButton>Save card</SubmitButton>
      </form>
      <form action={remove} className="grid max-w-md gap-3 border border-line p-4">
        <input type="hidden" name="id" value={card.id} />
        <input type="hidden" name="game_id" value={card.game_id ?? ""} />
        <Feedback state={deleteState} />
        <Field label='Type "delete" to remove' name="confirm" />
        <SubmitButton>Delete card</SubmitButton>
      </form>
    </div>
  );
}

export function RepresentativeEditor({
  representative,
}: {
  representative: {
    id: string;
    name: string;
    bio: string;
    portrait_url: string | null;
    dialogue: unknown;
  };
}) {
  const [state, action] = useActionState(updateRepresentative, initial);
  const dialogue = asObject(representative.dialogue);

  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={representative.id} />
      <Field label="Name" name="name" defaultValue={representative.name} required />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Bio
        <textarea className={areaClass} name="bio" defaultValue={representative.bio} />
      </label>
      <Field label="Portrait URL" name="portrait_url" defaultValue={representative.portrait_url ?? ""} />
      {Object.entries(dialogue).map(([key, value]) =>
        typeof value === "string" ? (
          <label key={key} className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
            {key.replaceAll("_", " ")}
            <textarea className={areaClass} name={`dialogue__${key}`} defaultValue={value} />
          </label>
        ) : null,
      )}
      <Field label="New line key" name="new_key" />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        New line
        <textarea className={areaClass} name="new_value" />
      </label>
      <SubmitButton>Save representative</SubmitButton>
    </form>
  );
}

export function AnnouncementEditor({
  announcement,
  representatives,
}: {
  announcement: {
    id: string;
    title: string;
    body: string;
    source: string;
    representative_id: string | null;
    timing: unknown;
  };
  representatives: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateAnnouncement, initial);
  const timing = asObject(announcement.timing);

  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={announcement.id} />
      <p className="text-xs uppercase tracking-[0.16em] text-mute">Source {announcement.source}.</p>
      <Field label="Title" name="title" defaultValue={announcement.title} required />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Body
        <textarea className={areaClass} name="body" defaultValue={announcement.body} required />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Representative
        <select className={fieldClass} name="representative_id" defaultValue={announcement.representative_id ?? ""}>
          <option value="">Suit representative</option>
          {representatives.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Countdown seconds" name="seconds" defaultValue={effectNumber(timing, "seconds")} />
      <SubmitButton>Save announcement</SubmitButton>
    </form>
  );
}
