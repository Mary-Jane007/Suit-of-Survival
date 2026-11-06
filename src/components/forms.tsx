"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { fieldClass } from "@/components/ui";
import { createRoom, createTable, joinRoom, signIn, signUp } from "@/lib/actions";
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

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const [state, action] = useActionState(signIn, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Email
        <input className={fieldClass} name="email" type="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Password
        <input
          className={fieldClass}
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Signing in">Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Display name
        <input className={fieldClass} name="display_name" autoComplete="nickname" required />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Email
        <input className={fieldClass} name="email" type="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Password
        <input
          className={fieldClass}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Confirm password
        <input
          className={fieldClass}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Creating account">Create account</SubmitButton>
    </form>
  );
}

export function JoinForm() {
  const [state, action] = useActionState(joinRoom, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Display name
        <input className={fieldClass} name="display_name" autoComplete="nickname" required />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Room code
        <input
          className={`${fieldClass} uppercase tracking-[0.3em]`}
          name="room_code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          required
        />
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Joining">Join the room</SubmitButton>
    </form>
  );
}

export function PhoneJoinForm({ code }: { code: string }) {
  const [state, action] = useActionState(joinRoom, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="seat" value="phone" />
      <input type="hidden" name="room_code" value={code} />
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-mute">
        Display name
        <input className={fieldClass} name="display_name" autoComplete="nickname" required />
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Joining">Join on this phone</SubmitButton>
    </form>
  );
}

export function CreateRoomForm() {
  const [state, action] = useActionState(createRoom, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <p className="max-w-md text-sm text-mute">
        Opens an online room and a six-character code. The host starts the draw from the lobby.
      </p>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Opening">Open a room</SubmitButton>
    </form>
  );
}

export function CreateTableForm() {
  const [state, action] = useActionState(createTable, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <p className="max-w-md text-sm text-mute">
        Opens one room code for a TV and for phones. The board only displays. Phones send the moves.
      </p>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Opening">Open a table</SubmitButton>
    </form>
  );
}
