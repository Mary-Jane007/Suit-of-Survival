import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "./db";

const scryptAsync = promisify(scrypt);
export const COOKIE = "sos";

export type Account = {
  id: string;
  username: string;
  role: "player" | "owner";
  avatar: string;
};

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(secret, salt, 32)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifySecret(secret: string, stored: string | null) {
  if (!stored) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const buf = (await scryptAsync(secret, salt, 32)) as Buffer;
  const previous = Buffer.from(hex, "hex");
  if (previous.length !== buf.length) return false;
  return timingSafeEqual(previous, buf);
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export async function revokeToken(token: string | null | undefined) {
  if (!token) return;
  await sql("delete from auth_sessions where token = $1", [token]);
}

export function tokenFromCookie(cookie: string) {
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export async function openSession(userId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql("insert into auth_sessions (token, user_id, expires_at) values ($1, $2, $3)", [
    token,
    userId,
    expires.toISOString(),
  ]);
  return token;
}

export async function accountFromToken(token: string | undefined | null): Promise<Account | null> {
  if (!token) return null;
  const rows = await sql<Account & { expires_at: string }>(
    `select u.id, u.username, u.role, u.avatar, s.expires_at
     from auth_sessions s join users u on u.id = s.user_id
     where s.token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, username: row.username, role: row.role, avatar: row.avatar };
}

export function cookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
