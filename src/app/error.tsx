"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[0.7rem] uppercase tracking-[0.35em] text-blood-bright">Error</p>
      <h1 className="mt-4 font-display text-5xl tracking-[0.08em]">THIS PAGE COULD NOT BE SHOWN</h1>
      <button
        type="button"
        onClick={reset}
        className="mt-10 inline-flex h-12 items-center border border-line px-6 font-display text-sm uppercase tracking-[0.18em]"
      >
        Try again
      </button>
    </main>
  );
}
