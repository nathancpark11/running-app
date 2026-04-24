import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/auth";
import { ensureAuthTables, getSql } from "@/lib/db";

export const runtime = "nodejs";

type MeRow = {
  id: string;
  email: string;
  name: string;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }

    await ensureAuthTables();
    const sql = getSql();

    const rows = (await sql`
      SELECT u.id, u.email, u.name
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${hashSessionToken(sessionToken)}
        AND s.expires_at > NOW()
      LIMIT 1;
    `) as MeRow[];

    const user = rows[0];
    if (!user) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return Response.json({ error: "Session expired." }, { status: 401 });
    }

    return Response.json({ user });
  } catch {
    return Response.json({ error: "Failed to read session." }, { status: 500 });
  }
}
