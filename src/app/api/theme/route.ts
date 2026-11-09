import { fail, json } from "@/lib/http";
import { theme } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await theme());
  } catch (error) {
    return fail(error);
  }
}
