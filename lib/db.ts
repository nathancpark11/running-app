import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let authTablesReady = false;

export function getSql() {
  if (!sqlClient) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not configured.");
    }

    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}

export async function ensureAuthTables() {
  if (authTablesReady) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      runs JSONB NOT NULL DEFAULT '[]'::jsonb,
      training_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      training_plan_name TEXT,
      goals JSONB NOT NULL DEFAULT '{}'::jsonb,
      preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      routines JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_insights (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      insight_type TEXT NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      related_run_id TEXT,
      cache_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, insight_type, cache_key)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);`;
  await sql`CREATE INDEX IF NOT EXISTS ai_insights_user_type_period_idx ON ai_insights (user_id, insight_type, period_start);`;

  authTablesReady = true;
}
