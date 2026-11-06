const DISPLAY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} '\u2019.-]{0,39}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function cleanDisplayName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim().replace(/\s+/g, " ");
  if (!DISPLAY_NAME.test(name)) {
    return null;
  }

  return name;
}

export function cleanEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return null;
  }

  return email;
}

export function cleanPassword(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    return null;
  }

  return value;
}

export function cleanRoomCode(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().replace(/[\s-]/g, "").toUpperCase();
  if (!ROOM_CODE.test(code)) {
    return null;
  }

  return code;
}

export function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  return value;
}

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
