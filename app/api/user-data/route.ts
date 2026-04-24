import { DEFAULT_GOALS, DEFAULT_ROUTINES } from "@/lib/defaults";
import type { Goals, Preferences, RunLog, StretchRoutine, TrainingRecommendation } from "@/lib/types";
import { ensureAuthTables, getSql } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/session";

export const runtime = "nodejs";

type UserDataRow = {
  runs: RunLog[] | null;
  training_recommendations: TrainingRecommendation[] | null;
  training_plan_name: string | null;
  goals: Goals | null;
  preferences: Preferences | null;
  routines: StretchRoutine[] | null;
};

type UserDataPayload = {
  runs: RunLog[];
  trainingRecommendations: TrainingRecommendation[];
  trainingPlanName: string | null;
  goals: Goals;
  preferences: Preferences;
  routines: StretchRoutine[];
};

const DEFAULT_PREFERENCES: Preferences = {
  darkMode: false,
  unit: "miles",
};

function defaultPayload(): UserDataPayload {
  return {
    runs: [],
    trainingRecommendations: [],
    trainingPlanName: null,
    goals: DEFAULT_GOALS,
    preferences: DEFAULT_PREFERENCES,
    routines: DEFAULT_ROUTINES,
  };
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  await ensureAuthTables();
  const sql = getSql();

  const rows = (await sql`
    SELECT runs, training_recommendations, training_plan_name, goals, preferences, routines
    FROM user_data
    WHERE user_id = ${userId}
    LIMIT 1;
  `) as UserDataRow[];

  const row = rows[0];
  if (!row) {
    return Response.json(defaultPayload());
  }

  return Response.json({
    runs: row.runs ?? [],
    trainingRecommendations: row.training_recommendations ?? [],
    trainingPlanName: row.training_plan_name,
    goals: row.goals ?? DEFAULT_GOALS,
    preferences: row.preferences ?? DEFAULT_PREFERENCES,
    routines: row.routines ?? DEFAULT_ROUTINES,
  } satisfies UserDataPayload);
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<UserDataPayload>;

  await ensureAuthTables();
  const sql = getSql();

  const mergedRows = (await sql`
    SELECT runs, training_recommendations, training_plan_name, goals, preferences, routines
    FROM user_data
    WHERE user_id = ${userId}
    LIMIT 1;
  `) as UserDataRow[];

  const existing = mergedRows[0];
  const defaults = defaultPayload();

  const merged = {
    runs: body.runs ?? existing?.runs ?? defaults.runs,
    training_recommendations:
      body.trainingRecommendations ?? existing?.training_recommendations ?? defaults.trainingRecommendations,
    training_plan_name:
      body.trainingPlanName !== undefined ? body.trainingPlanName : (existing?.training_plan_name ?? defaults.trainingPlanName),
    goals: body.goals ?? existing?.goals ?? defaults.goals,
    preferences: body.preferences ?? existing?.preferences ?? defaults.preferences,
    routines: body.routines ?? existing?.routines ?? defaults.routines,
  };

  await sql`
    INSERT INTO user_data (
      user_id,
      runs,
      training_recommendations,
      training_plan_name,
      goals,
      preferences,
      routines,
      updated_at
    )
    VALUES (
      ${userId},
      ${JSON.stringify(merged.runs)}::jsonb,
      ${JSON.stringify(merged.training_recommendations)}::jsonb,
      ${merged.training_plan_name},
      ${JSON.stringify(merged.goals)}::jsonb,
      ${JSON.stringify(merged.preferences)}::jsonb,
      ${JSON.stringify(merged.routines)}::jsonb,
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      runs = EXCLUDED.runs,
      training_recommendations = EXCLUDED.training_recommendations,
      training_plan_name = EXCLUDED.training_plan_name,
      goals = EXCLUDED.goals,
      preferences = EXCLUDED.preferences,
      routines = EXCLUDED.routines,
      updated_at = NOW();
  `;

  return Response.json({ ok: true });
}

export async function DELETE() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  await ensureAuthTables();
  const sql = getSql();
  await sql`DELETE FROM user_data WHERE user_id = ${userId};`;

  return Response.json({ ok: true });
}
