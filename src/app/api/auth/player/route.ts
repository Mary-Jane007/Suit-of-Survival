import { cookieHeader } from "@/lib/auth";
import { assertOrigin, fail, json, readBody } from "@/lib/http";
import { registerPlayer } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const body = await readBody(req);
    const token = await registerPlayer(body);
    const headers = new Headers();
    headers.set("set-cookie", cookieHeader(token));
    return json({ ok: true }, { headers });
  } catch (error) {
    return fail(error);
  }
}
