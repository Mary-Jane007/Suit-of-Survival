import { fail, json } from "@/lib/http";
import { library } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await library());
  } catch (error) {
    return fail(error);
  }
}
