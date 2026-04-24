import { ensureAuthTables, getSql } from "@/lib/db";

export type InsightType =
  | "weekly_insights"
  | "injury_risk"
  | "today_focus"
  | "stretch_recommendation";

type InsightRow = {
  id: string;
  user_id: string;
  insight_type: InsightType;
  period_start: string;
  period_end: string;
  related_run_id: string | null;
  payload: unknown;
  cache_key: string;
  created_at: string;
  updated_at: string;
};

export type CachedInsight<TPayload> = {
  id: string;
  insightType: InsightType;
  periodStart: string;
  periodEnd: string;
  relatedRunId: string | null;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
};

export function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - diffToMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function makeCacheKey(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part ?? "-").join(":");
}

export async function getCachedInsight<TPayload>(
  userId: string,
  insightType: InsightType,
  cacheKey: string
): Promise<CachedInsight<TPayload> | null> {
  await ensureAuthTables();
  const sql = getSql();

  const rows = (await sql`
    SELECT id, user_id, insight_type, period_start, period_end, related_run_id, payload, cache_key, created_at, updated_at
    FROM ai_insights
    WHERE user_id = ${userId}
      AND insight_type = ${insightType}
      AND cache_key = ${cacheKey}
    LIMIT 1;
  `) as InsightRow[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    insightType: row.insight_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    relatedRunId: row.related_run_id,
    payload: row.payload as TPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertInsight<TPayload>(args: {
  userId: string;
  insightType: InsightType;
  periodStart: string;
  periodEnd: string;
  relatedRunId?: string | null;
  cacheKey: string;
  payload: TPayload;
}) {
  await ensureAuthTables();
  const sql = getSql();

  const rows = (await sql`
    INSERT INTO ai_insights (
      user_id,
      insight_type,
      period_start,
      period_end,
      related_run_id,
      cache_key,
      payload,
      created_at,
      updated_at
    )
    VALUES (
      ${args.userId},
      ${args.insightType},
      ${args.periodStart}::timestamptz,
      ${args.periodEnd}::timestamptz,
      ${args.relatedRunId ?? null},
      ${args.cacheKey},
      ${JSON.stringify(args.payload)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, insight_type, cache_key)
    DO UPDATE SET
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      related_run_id = EXCLUDED.related_run_id,
      payload = EXCLUDED.payload,
      updated_at = NOW()
    RETURNING id, user_id, insight_type, period_start, period_end, related_run_id, payload, cache_key, created_at, updated_at;
  `) as InsightRow[];

  const row = rows[0];

  return {
    id: row.id,
    insightType: row.insight_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    relatedRunId: row.related_run_id,
    payload: row.payload as TPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies CachedInsight<TPayload>;
}
