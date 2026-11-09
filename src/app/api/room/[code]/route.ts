import { caller, fail, json } from "@/lib/http";
import { viewRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const account = await caller(req);
    const surface = new URL(req.url).searchParams.get("surface") === "screen" ? "screen" : "phone";
    return json(await viewRoom(account, code, surface));
  } catch (error) {
    return fail(error);
  }
}
