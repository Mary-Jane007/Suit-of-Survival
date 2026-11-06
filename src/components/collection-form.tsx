"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { areaClass, fieldClass, ghostButtonClass } from "@/components/ui";
import { deleteCollection, updateCollection } from "@/lib/collection-actions";
import type { ActionState } from "@/lib/types";

const initial: ActionState = {};

export function CollectionForm({
  collection,
}: {
  collection: {
    id: string;
    title: string;
    description: string;
    suit: string;
    clearsRequired: number;
    clearMinimum: number;
    published: boolean;
  };
}) {
  const [state, action] = useActionState(updateCollection, initial);

  return (
    <div className="flex flex-col gap-8">
      <form action={action} className="grid max-w-xl gap-4">
        <input type="hidden" name="id" value={collection.id} />
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Title
          <input className={fieldClass} name="title" defaultValue={collection.title} required />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Description
          <textarea className={areaClass} name="description" defaultValue={collection.description} />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Suit
          <select className={fieldClass} name="suit" defaultValue={collection.suit}>
            <option value="diamonds">Diamonds</option>
            <option value="hearts">Hearts</option>
            <option value="clubs">Clubs</option>
            <option value="spades">Spades</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Clears required
          <input className={fieldClass} name="clears_required" type="number" min={1} step={1} defaultValue={collection.clearsRequired} required />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
          Clear minimum
          <input className={fieldClass} name="clear_minimum" type="number" step={1} defaultValue={collection.clearMinimum} required />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="published" defaultChecked={collection.published} />
          On. Profiles read this row.
        </label>
        {state.error ? <p className="text-sm text-blood-bright">{state.error}</p> : null}
        {state.message ? <p className="text-sm text-paper">{state.message}</p> : null}
        <SubmitButton pendingLabel="Saving">Save the rule</SubmitButton>
      </form>
      <form action={deleteCollection}>
        <input type="hidden" name="id" value={collection.id} />
        <SubmitButton className={ghostButtonClass} pendingLabel="Deleting">
          Delete this collection
        </SubmitButton>
      </form>
    </div>
  );
}
