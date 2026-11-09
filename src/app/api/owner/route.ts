import { assertOrigin, caller, fail, json, readBody } from "@/lib/http";
import { manage, overview } from "@/lib/owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const account = await caller(req);
    return json(await overview(account));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const account = await caller(req);
    const body = await readBody(req);
    return json(await manage(account, String(body.action ?? ""), body));
  } catch (error) {
    return fail(error);
  }
}
