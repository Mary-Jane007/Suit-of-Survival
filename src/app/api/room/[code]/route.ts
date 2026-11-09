import { caller, fail, json } from "@/lib/http";
import { viewRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const account = await caller(req);
    return json(await viewRoom(account, code));
  } catch (error) {
    return fail(error);
  }
}
