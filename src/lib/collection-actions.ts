"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ownerDb } from "@/lib/content-queries";
import { readCollectionRule } from "@/lib/progression";
import { cleanText } from "@/lib/validate";
import type { ActionState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function integer(formData: FormData, key: string) {
  const raw = cleanText(formData.get(key));
  if (!/^-?\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

export async function updateCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await ownerDb();
  if (!db.ok) {
    return { error: "message" in db ? db.message : "Supabase is not configured." };
  }
  const id = cleanText(formData.get("id"));
  if (!UUID.test(id)) {
    return { error: "That collection was not found." };
  }
  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"));
  const suit = cleanText(formData.get("suit"));
  const clearsRequired = integer(formData, "clears_required");
  const clearMinimum = integer(formData, "clear_minimum");
  if (!title) {
    return { error: "A collection needs a title." };
  }
  const rules = { suit, clears_required: clearsRequired, clear_minimum: clearMinimum };
  if (!readCollectionRule(rules)) {
    return { error: "Use a suit and whole numbers. Clears required must be at least 1." };
  }
  const { error } = await db.supabase
    .from("collections")
    .update({
      title,
      description,
      rules,
      published: formData.get("published") === "on",
    })
    .eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/profile");
  revalidatePath("/owner/collections");
  revalidatePath(`/owner/collections/${id}`);
  return { message: "Saved. Profiles read this rule from the database." };
}

export async function deleteCollection(formData: FormData) {
  const db = await ownerDb();
  if (!db.ok) {
    return;
  }
  const id = cleanText(formData.get("id"));
  if (!UUID.test(id)) {
    return;
  }
  await db.supabase.from("collections").delete().eq("id", id);
  revalidatePath("/profile");
  revalidatePath("/owner/collections");
  redirect("/owner/collections");
}
