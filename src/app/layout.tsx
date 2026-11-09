import type { Metadata } from "next";
import { Cinzel, IBM_Plex_Mono, Oswald, Outfit } from "next/font/google";
import { ThemeBoot } from "@/components/ui";
import "./globals.css";

const display = Oswald({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display-face" });
const body = Outfit({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-body-face" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Suit of Survival",
  description: "A real-life multiplayer card arena. Digital points only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${cinzel.variable} ${mono.variable} scanlines`}>
        <ThemeBoot />
        <div className="arena">
          <div className="shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
