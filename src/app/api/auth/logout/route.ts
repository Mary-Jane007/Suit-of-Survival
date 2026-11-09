import { clearCookie } from "@/lib/auth";
import { assertOrigin, fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const headers = new Headers();
    headers.set("set-cookie", clearCookie());
    return json({ ok: true }, { headers });
  } catch (error) {
    return fail(error);
  }
}
