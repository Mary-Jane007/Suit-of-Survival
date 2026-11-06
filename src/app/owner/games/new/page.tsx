import type { Metadata } from "next";

import { NewGameForm } from "@/components/content-forms";
import { OwnerPage } from "@/components/owner-page";

export const metadata: Metadata = {
  title: "New game",
};

export default function NewGamePage() {
  return (
    <OwnerPage
      kicker="Games"
      title="NEW GAME"
      lede="A game you create here is a proposal and starts as a draft. The seeded deck stays labeled export."
    >
      <NewGameForm />
    </OwnerPage>
  );
}
