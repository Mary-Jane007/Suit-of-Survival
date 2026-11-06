"use client";

import { useFormStatus } from "react-dom";

import { solidButtonClass } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = solidButtonClass,
}: {
  children: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
