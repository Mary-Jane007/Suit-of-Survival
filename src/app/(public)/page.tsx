import Link from "next/link";

import { ghostButtonClass, solidButtonClass } from "@/components/ui";

const marks = [
  { symbol: "♠", className: "left-[7%] top-[16%] text-paper" },
  { symbol: "♥", className: "right-[8%] top-[18%] text-blood-bright" },
  { symbol: "♦", className: "bottom-[14%] left-[12%] text-blood-bright" },
  { symbol: "♣", className: "right-[10%] bottom-[16%] text-paper" },
];

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {marks.map((mark) => (
          <span
            key={mark.symbol}
            className={`suit-drift absolute hidden font-display text-7xl md:block sm:text-8xl ${mark.className}`}
          >
            {mark.symbol}
          </span>
        ))}
      </div>
      <div className="rise-in relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.42em] text-mute">Four suits</p>
        <h1 className="mt-6 max-w-5xl font-display text-5xl leading-none tracking-[0.14em] sm:text-7xl md:text-8xl">
          SUIT OF SURVIVAL
        </h1>
        <div className="mt-8 h-px w-24 bg-blood" />
        <p className="mt-8 font-display text-lg tracking-[0.32em] sm:text-2xl">THE GAME HAS BEGUN</p>
        <div className="mt-12 flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/enter" className={solidButtonClass}>
            Enter the game
          </Link>
          <Link href="/library" className={ghostButtonClass}>
            Game library
          </Link>
          <Link href="/how-to-play" className={ghostButtonClass}>
            How to play
          </Link>
        </div>
      </div>
      <p className="relative px-6 pb-8 text-center text-[0.68rem] uppercase tracking-[0.28em] text-mute">
        Digital score only · You can stop · No account required to join
      </p>
    </main>
  );
}
