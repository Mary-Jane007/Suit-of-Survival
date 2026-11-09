import { assertOrigin, caller, fail, json, readBody } from "@/lib/http";
import { createSession } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const account = await caller(req);
    if (!account) return json({ error: "Sign in as the owner first." }, { status: 401 });
    const body = await readBody(req);
    const code = await createSession(account, {
      playStyle: String(body.playStyle ?? "arena"),
      drawMode: String(body.drawMode ?? "random"),
      suits: Array.isArray(body.suits) ? body.suits.map(String) : [],
      preventDuplicates: body.preventDuplicates !== false,
    });
    return json({ code });
  } catch (error) {
    return fail(error);
  }
}
