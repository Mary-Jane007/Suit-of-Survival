import { assertOrigin, caller, fail, json, readBody } from "@/lib/http";
import { joinRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const account = await caller(req);
    if (!account) return json({ error: "Sign in first. Your cards stay on the account you log in with." }, { status: 401 });
    const body = await readBody(req);
    const room = await joinRoom(account, String(body.code ?? ""));
    return json(room);
  } catch (error) {
    return fail(error);
  }
}
