import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { ensureAuthTables, getSql } from "@/lib/db";

export const runtime = "nodejs";

type LoginRequest = {
  email?: string;
  password?: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoginRequest;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    await ensureAuthTables();
    const sql = getSql();

    const userRows = (await sql`
      SELECT id, email, name, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1;
    `) as UserRow[];

    const user = userRows[0];
    if (!user) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const sessionToken = createSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    await sql`
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, NOW() + (${SESSION_MAX_AGE_SECONDS} * INTERVAL '1 second'));
    `;

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return Response.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return Response.json({ error: "Failed to sign in." }, { status: 500 });
  }
}
