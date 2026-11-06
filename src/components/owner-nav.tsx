"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/games", label: "Games" },
  { href: "/owner/cards", label: "Cards" },
  { href: "/owner/representatives", label: "Representatives" },
  { href: "/owner/announcements", label: "Announcements" },
  { href: "/owner/collections", label: "Collections" },
  { href: "/owner/players", label: "Players" },
  { href: "/owner/sessions", label: "Sessions" },
  { href: "/owner/design", label: "Design" },
  { href: "/owner/settings", label: "Settings" },
];

export function OwnerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 px-4 pb-3 sm:px-8">
      {items.map((item) => {
        const active = item.href === "/owner" ? pathname === "/owner" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 border px-3 py-2 font-display text-xs uppercase tracking-[0.16em] ${
              active ? "border-blood text-paper" : "border-transparent text-mute hover:text-paper"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
