"use client";

import { useFormStatus } from "react-dom";

import { solidButtonClass } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={solidButtonClass}>
      {pending ? pendingLabel : children}
    </button>
  );
}
