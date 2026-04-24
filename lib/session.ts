import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/auth";
import { ensureAuthTables, getSql } from "@/lib/db";

type SessionRow = {
  user_id: string;
};

export async function getAuthenticatedUserId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) return null;

  await ensureAuthTables();
  const sql = getSql();

  const rows = (await sql`
    SELECT user_id
    FROM sessions
    WHERE token_hash = ${hashSessionToken(sessionToken)}
      AND expires_at > NOW()
    LIMIT 1;
  `) as SessionRow[];

  const row = rows[0];
  if (!row) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return row.user_id;
}
