import "server-only";

import { connection } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getVerifiedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Lobby, LobbyParticipant } from "@/lib/types";
import { cleanRoomCode } from "@/lib/validate";

export type LobbyResult =
  | { kind: "unconfigured" }
  | { kind: "needs-server-key" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "hidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; lobby: Lobby };

function asLobby(value: unknown): Lobby | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.room_code !== "string" ||
    typeof row.mode !== "string" ||
    typeof row.status !== "string" ||
    typeof row.host_user_id !== "string" ||
    typeof row.created_at !== "string" ||
    !Array.isArray(row.participants)
  ) {
    return null;
  }

  const participants: LobbyParticipant[] = [];
  for (const entry of row.participants) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const person = entry as Record<string, unknown>;
    if (
      typeof person.id !== "string" ||
      typeof person.display_name !== "string" ||
      typeof person.role !== "string" ||
      typeof person.status !== "string" ||
      typeof person.joined_at !== "string"
    ) {
      return null;
    }
    participants.push({
      id: person.id,
      display_name: person.display_name,
      role: person.role,
      status: person.status,
      user_id: typeof person.user_id === "string" ? person.user_id : null,
      joined_at: person.joined_at,
    });
  }

  participants.sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  return {
    id: row.id,
    room_code: row.room_code,
    mode: row.mode,
    status: row.status,
    host_user_id: row.host_user_id,
    created_at: row.created_at,
    participants,
  };
}

async function readLobby(client: SupabaseClient, roomCode: string): Promise<LobbyResult> {
  const { data, error } = await client
    .from("sessions")
    .select(
      "id, room_code, mode, status, host_user_id, created_at, participants(id, display_name, role, status, user_id, joined_at)",
    )
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error) {
    return { kind: "error", message: error.message };
  }

  if (!data) {
    return { kind: "missing" };
  }

  const lobby = asLobby(data);
  if (!lobby) {
    return { kind: "error", message: "The room row could not be read." };
  }

  return { kind: "ready", lobby };
}

export async function getLobby(rawCode: string): Promise<LobbyResult> {
  await connection();
  const roomCode = cleanRoomCode(rawCode);
  if (!roomCode) {
    return { kind: "invalid" };
  }

  if (!isSupabaseConfigured()) {
    return { kind: "unconfigured" };
  }

  const admin = createAdminClient();
  if (admin) {
    return readLobby(admin, roomCode);
  }

  const user = await getVerifiedUser();
  if (!user) {
    return { kind: "needs-server-key" };
  }

  const result = await readLobby(user.supabase, roomCode);
  if (result.kind === "missing") {
    return { kind: "hidden" };
  }

  return result;
}
