import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/auth";
import { ensureAuthTables, getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      await ensureAuthTables();
      const sql = getSql();
      await sql`DELETE FROM sessions WHERE token_hash = ${hashSessionToken(sessionToken)};`;
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to sign out." }, { status: 500 });
  }
}
