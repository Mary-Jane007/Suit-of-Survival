import Link from "next/link";
import { Suspense } from "react";

import { AccountSlot } from "@/components/account-slot";

const links = [
  { href: "/enter", label: "Enter" },
  { href: "/library", label: "Library" },
  { href: "/how-to-play", label: "How to play" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl tracking-[0.22em]">
          SUIT OF SURVIVAL
        </Link>
        <nav className="flex items-center gap-5 text-xs uppercase tracking-[0.18em] text-mute">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-paper">
              {link.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<span className="text-xs uppercase tracking-[0.18em] text-mute">…</span>}>
          <AccountSlot />
        </Suspense>
      </div>
    </header>
  );
}
