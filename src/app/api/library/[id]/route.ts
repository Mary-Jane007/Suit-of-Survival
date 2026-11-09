import { fail, json } from "@/lib/http";
import { library } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const game = await library(id);
    if (!game) return json({ error: "That game is not published." }, { status: 404 });
    return json(game);
  } catch (error) {
    return fail(error);
  }
}
