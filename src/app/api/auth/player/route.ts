import { cookieHeader } from "@/lib/auth";
import { assertOrigin, fail, json, readBody } from "@/lib/http";
import { signUp } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const body = await readBody(req);
    const result = await signUp({ ...body, password: body.password ?? body.pin });
    const headers = new Headers();
    headers.set("set-cookie", cookieHeader(result.token));
    return json({ ok: true, role: result.role }, { headers });
  } catch (error) {
    return fail(error);
  }
}
