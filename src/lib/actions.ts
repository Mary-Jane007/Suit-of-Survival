"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getVerifiedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActionState } from "@/lib/types";
import {
  cleanDisplayName,
  cleanEmail,
  cleanPassword,
  cleanRoomCode,
  createRoomCode,
  safeNextPath,
} from "@/lib/validate";

function setupError() {
  return {
    error: "Supabase is not configured. Add the URL and a publishable or anon key to .env.local.",
  };
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return setupError();
  }

  const displayName = cleanDisplayName(formData.get("display_name"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  const confirm = formData.get("confirm");

  if (!displayName) {
    return { error: "Use a display name of 1–40 letters or numbers." };
  }
  if (!email) {
    return { error: "Enter a valid email address." };
  }
  if (!password) {
    return { error: "Use a password of 8 to 72 characters." };
  }
  if (password !== confirm) {
    return { error: "The passwords do not match." };
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://127.0.0.1:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/sign-in`,
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      message: "Check your email and confirm the account, then sign in. The first confirmed account is the owner.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", data.session.user.id)
    .maybeSingle();

  redirect(profile?.role === "owner" ? "/owner" : "/enter");
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return setupError();
  }

  const email = cleanEmail(formData.get("email"));
  const password = cleanPassword(formData.get("password"));
  const nextPath = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter the email and password for the account." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  let role: string | null = null;
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    role = typeof profile?.role === "string" ? profile.role : null;
  }

  if (nextPath?.startsWith("/owner") && role !== "owner") {
    redirect("/enter");
  }

  if (nextPath) {
    redirect(nextPath);
  }

  redirect(role === "owner" ? "/owner" : "/enter");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}

export async function createRoom(prev: ActionState, formData: FormData): Promise<ActionState> {
  void prev;
  void formData;

  if (!isSupabaseConfigured()) {
    return setupError();
  }

  const user = await getVerifiedUser();
  if (!user) {
    return { error: "Sign in before opening a room. Guests join with a code." };
  }
  if (!user.profile) {
    return {
      error: user.profileError ?? "This account has no profile. Apply the migrations, then sign up again.",
    };
  }

  let created: { id: string; room_code: string } | null = null;
  let lastMessage = "The room could not be opened.";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomCode = createRoomCode();
    const { data, error } = await user.supabase
      .from("sessions")
      .insert({
        room_code: roomCode,
        mode: "online",
        status: "lobby",
        host_user_id: user.userId,
        settings_snapshot: { deals_cards: false },
      })
      .select("id, room_code")
      .single();

    if (!error && data) {
      created = data as { id: string; room_code: string };
      break;
    }

    if (error && error.code !== "23505") {
      lastMessage = error.message;
      break;
    }
  }

  if (!created) {
    return { error: lastMessage };
  }

  const { error: participantError } = await user.supabase.from("participants").insert({
    session_id: created.id,
    user_id: user.userId,
    display_name: user.profile.display_name,
    role: "host",
    status: "active",
  });

  if (participantError) {
    await user.supabase.from("sessions").delete().eq("id", created.id);
    return { error: participantError.message };
  }

  redirect(`/play/${created.room_code}`);
}

export async function joinRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return setupError();
  }

  const displayName = cleanDisplayName(formData.get("display_name"));
  const roomCode = cleanRoomCode(formData.get("room_code"));

  if (!displayName) {
    return { error: "Use a display name of 1–40 letters or numbers." };
  }
  if (!roomCode) {
    return {
      error: "Enter the six-character room code. It uses letters and digits, without I, O, 0, or 1.",
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Guest join needs the server key. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    };
  }

  const { data: session, error } = await admin
    .from("sessions")
    .select("id, room_code, status")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!session) {
    return { error: "No room uses that code." };
  }
  if (session.status !== "lobby") {
    return { error: "That room is not open for joining." };
  }

  const { data: participant, error: insertError } = await admin
    .from("participants")
    .insert({
      session_id: session.id,
      user_id: null,
      display_name: displayName,
      role: "player",
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !participant) {
    return { error: insertError?.message ?? "The room did not accept the join." };
  }

  const cookieStore = await cookies();
  cookieStore.set("sos_participant", participant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect(`/play/${session.room_code}`);
}
