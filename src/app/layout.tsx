import type { Metadata } from "next";
import { Barlow, Oswald } from "next/font/google";

import "./globals.css";

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
});

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  title: {
    default: "Suit of Survival",
    template: "%s · Suit of Survival",
  },
  description:
    "A dark original card night. Join a room with a display name. Accounts are optional.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
