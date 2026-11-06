import Link from "next/link";

import { ghostButtonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[0.7rem] uppercase tracking-[0.35em] text-blood-bright">404</p>
      <h1 className="mt-4 font-display text-5xl tracking-[0.12em]">NO SUCH ROOM</h1>
      <Link href="/" className={`${ghostButtonClass} mt-10`}>
        Return
      </Link>
    </main>
  );
}
