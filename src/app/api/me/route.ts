import { caller, fail, json } from "@/lib/http";
import { profile } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const account = await caller(req);
    if (!account) return json({ account: null });
    return json(await profile(account));
  } catch (error) {
    return fail(error);
  }
}
