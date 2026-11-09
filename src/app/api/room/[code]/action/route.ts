import { assertOrigin, caller, fail, json, readBody } from "@/lib/http";
import { act } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    assertOrigin(req);
    const account = await caller(req);
    if (!account) return json({ error: "Sign in first." }, { status: 401 });
    const { code } = await context.params;
    const body = await readBody(req);
    return json(await act(account, code, body));
  } catch (error) {
    return fail(error);
  }
}
