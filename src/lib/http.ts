import { accountFromToken, COOKIE } from "./auth";

export function json(data: unknown, init?: { status?: number; headers?: Headers }) {
  const headers = init?.headers ?? new Headers();
  headers.set("cache-control", "no-store");
  return Response.json(data, { status: init?.status ?? 200, headers });
}

export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const status = /only|refused|not in this room|full|cannot|not open|unknown/i.test(message) ? 400 : 400;
  return json({ error: message }, { status });
}

export function assertOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Cross-site request blocked.");
  }
  if (originHost !== host) throw new Error("Cross-site request blocked.");
}

export async function caller(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : "";
  return accountFromToken(token);
}

export async function readBody(req: Request) {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 300_000) throw new Error("That upload is too large.");
  return (await req.json()) as Record<string, unknown>;
}
