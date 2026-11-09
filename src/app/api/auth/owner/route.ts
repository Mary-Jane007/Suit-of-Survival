import { cookieHeader } from "@/lib/auth";
import { assertOrigin, fail, json, readBody } from "@/lib/http";
import { login } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const body = await readBody(req);
    const result = await login(body);
    if (result.role !== "owner") throw new Error("This account is not the owner.");
    const headers = new Headers();
    headers.set("set-cookie", cookieHeader(result.token));
    return json({ ok: true, role: result.role }, { headers });
  } catch (error) {
    return fail(error);
  }
}
