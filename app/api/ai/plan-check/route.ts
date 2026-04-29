import { PLAN_CHECK_PROMPT } from "@/lib/aiPrompts";
import { fallbackPlanCheckAnalysis } from "@/lib/aiFallbacks";
import { getUserRunsAndRecommendations } from "@/lib/aiData";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { RunLog } from "@/lib/types";

export const runtime = "nodejs";

type PlanCheckResponse = {
  status: "completed_as_planned" | "mostly_completed" | "overperformed" | "underperformed" | "missed" | "needs_review";
  summary: string;
  score: number;
};

const ALLOWED_PLAN_CHECK_STATUS = new Set<PlanCheckResponse["status"]>([
  "completed_as_planned",
  "mostly_completed",
  "overperformed",
  "underperformed",
  "missed",
  "needs_review",
]);

type RunContextPayload = {
  id: string;
  title: string;
  date: string;
  runType: string;
  surface: string;
  distanceMiles: number;
  durationMinutes: number;
  paceMinPerMile: number;
  heartRateBpm: number | null;
  caloriesBurned: number | null;
  shoe: string | null;
  fuelingStrategy: string | null;
  energyLevel: number;
  soreness: number;
  treadmillPace: string | null;
  treadmillPaceDurationMinutes: number | null;
  intervalCount: number | null;
  restTimeMinutes: number | null;
  primaryBenefitEvaluation: string | null;
  aiSummary: string | null;
  aiSignals: string[];
  notes: string;
  bodyCheckEntries: Array<{
    side: string;
    region: string;
    location: string;
    severity: number;
    painType: string;
    timing: string;
    trend: string;
    notes: string | null;
  }>;
  structuredNotes: {
    effortLevel: number | null;
    weather: string | null;
    fatigueIndicators: string[];
    sorenessTightness: string[];
    parsedNotes: string | null;
  };
};

type MainSetInference = {
  text: string | null;
  paceMinPerMileMin: number | null;
  paceMinPerMileMax: number | null;
  durationMinutesMin: number | null;
  durationMinutesMax: number | null;
};

function parseRequestedDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function parsePaceRangeMinPerMile(value: string | undefined): { min: number; max: number } | null {
  if (!value) {
    return null;
  }

  const minPerMileMatch = value.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)?/i);
  if (minPerMileMatch) {
    const toMin = (pace: string) => {
      const [mins, secs] = pace.split(":").map(Number);
      return mins + secs / 60;
    };

    const first = toMin(minPerMileMatch[1]);
    const second = toMin(minPerMileMatch[2]);
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  }

  const mphMatch = value.match(/(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)\s*(?:mph)?/i);
  if (!mphMatch) {
    return null;
  }

  const first = Number(mphMatch[1]);
  const second = Number(mphMatch[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
    return null;
  }

  const toMinPerMile = (mph: number) => 60 / mph;
  const convertedFirst = toMinPerMile(first);
  const convertedSecond = toMinPerMile(second);
  return {
    min: Math.min(convertedFirst, convertedSecond),
    max: Math.max(convertedFirst, convertedSecond),
  };
}

function extractGoal(notes: string): string | null {
  const trimmed = notes.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }

  const mainSetMatch = trimmed.match(/Main\s*Set\s*:?\s*([\s\S]*?)(?:Cool\s*Down|$)/i);
  const source = mainSetMatch?.[1]?.trim() || trimmed;
  return source.length > 0 ? source.slice(0, 180) : null;
}

function extractMainSetText(notes: string): string | null {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return null;
  }

  const mainSetMatch = normalized.match(/Main\s*Set\s*:?\s*([\s\S]*?)(?=\n\s*(?:Cool\s*Down|Warm\s*Up)\s*:|$)/i);
  if (mainSetMatch?.[1]) {
    const extracted = mainSetMatch[1].trim().replace(/^[:\-\s]+/, "");
    return extracted || null;
  }

  return null;
}

function parsePaceRangeFromTextMinPerMile(value: string): { min: number; max: number } | null {
  const minPerMileMatch = value.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)?/i);
  if (minPerMileMatch) {
    const toMin = (pace: string) => {
      const [mins, secs] = pace.split(":").map(Number);
      return mins + secs / 60;
    };

    const first = toMin(minPerMileMatch[1]);
    const second = toMin(minPerMileMatch[2]);
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  }

  const singleMinPerMile = value.match(/(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)/i);
  if (singleMinPerMile) {
    const [mins, secs] = singleMinPerMile[1].split(":").map(Number);
    const pace = mins + secs / 60;
    return { min: pace, max: pace };
  }

  const mphRange = value.match(/(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)\s*mph/i);
  if (mphRange) {
    const first = Number(mphRange[1]);
    const second = Number(mphRange[2]);
    if (Number.isFinite(first) && Number.isFinite(second) && first > 0 && second > 0) {
      const firstMin = 60 / first;
      const secondMin = 60 / second;
      return {
        min: Math.min(firstMin, secondMin),
        max: Math.max(firstMin, secondMin),
      };
    }
  }

  const singleMph = value.match(/(\d{1,2}(?:\.\d)?)\s*mph/i);
  if (singleMph) {
    const mph = Number(singleMph[1]);
    if (Number.isFinite(mph) && mph > 0) {
      const pace = 60 / mph;
      return { min: pace, max: pace };
    }
  }

  return null;
}

function parseDurationRangeFromText(value: string): { min: number; max: number } | null {
  const rangeMatch = value.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:min|mins|minute|minutes)\b/i);
  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second) && first > 0 && second > 0) {
      return { min: Math.min(first, second), max: Math.max(first, second) };
    }
  }

  const singleMatch = value.match(/\b(\d{1,2})\s*(?:min|mins|minute|minutes)\b/i);
  if (singleMatch) {
    const minutes = Number(singleMatch[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      return { min: minutes, max: minutes };
    }
  }

  return null;
}

function inferMainSetFromRun(run: RunLog): MainSetInference {
  const primarySource = run.notes ?? "";
  const secondarySource = run.structuredNotes?.notes ?? "";
  const mainSetText = extractMainSetText(primarySource) ?? extractMainSetText(secondarySource);

  if (!mainSetText) {
    return {
      text: null,
      paceMinPerMileMin: null,
      paceMinPerMileMax: null,
      durationMinutesMin: null,
      durationMinutesMax: null,
    };
  }

  const paceRange = parsePaceRangeFromTextMinPerMile(mainSetText);
  const durationRange = parseDurationRangeFromText(mainSetText);

  return {
    text: mainSetText,
    paceMinPerMileMin: paceRange?.min ?? null,
    paceMinPerMileMax: paceRange?.max ?? null,
    durationMinutesMin: durationRange?.min ?? null,
    durationMinutesMax: durationRange?.max ?? null,
  };
}

function buildRunnerNotes(run: RunLog): string | null {
  const bodyCheckNotes = (run.bodyCheck?.entries ?? [])
    .map((entry) => {
      const parts = [
        entry.side,
        entry.location,
        entry.painType,
        entry.notes,
      ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
      return parts.join(" - ").trim();
    })
    .filter((line) => line.length > 0);

  const parts = [
    run.notes?.trim(),
    run.primaryBenefitEvaluation?.trim(),
    run.fuelingStrategy?.trim(),
    run.aiSummary?.trim(),
    ...(run.aiSignals ?? []),
    ...bodyCheckNotes,
    ...(run.structuredNotes?.fatigueIndicators ?? []),
    ...(run.structuredNotes?.sorenessTightness ?? []),
    run.structuredNotes?.notes?.trim(),
  ].filter((part): part is string => typeof part === "string" && part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join("\n");
}

function toRunContext(run: RunLog): RunContextPayload {
  return {
    id: run.id,
    title: run.title,
    date: run.date,
    runType: run.runType,
    surface: run.surface,
    distanceMiles: run.distanceMiles,
    durationMinutes: run.durationMinutes,
    paceMinPerMile: run.paceMinPerMile,
    heartRateBpm: run.heartRateBpm ?? null,
    caloriesBurned: run.caloriesBurned ?? null,
    shoe: run.shoe ?? null,
    fuelingStrategy: run.fuelingStrategy ?? null,
    energyLevel: run.energyLevel,
    soreness: run.soreness,
    treadmillPace: run.treadmillPace ?? null,
    treadmillPaceDurationMinutes: run.treadmillPaceDurationMinutes ?? null,
    intervalCount: run.intervalCount ?? null,
    restTimeMinutes: run.restTimeMinutes ?? null,
    primaryBenefitEvaluation: run.primaryBenefitEvaluation ?? null,
    aiSummary: run.aiSummary ?? null,
    aiSignals: (run.aiSignals ?? []).filter((item) => typeof item === "string" && item.trim().length > 0),
    notes: run.notes,
    bodyCheckEntries: (run.bodyCheck?.entries ?? []).map((entry) => ({
      side: entry.side,
      region: entry.region,
      location: entry.location,
      severity: entry.severity,
      painType: entry.painType,
      timing: entry.timing,
      trend: entry.trend,
      notes: entry.notes ?? null,
    })),
    structuredNotes: {
      effortLevel: run.structuredNotes?.effortLevel ?? null,
      weather: run.structuredNotes?.weather ?? null,
      fatigueIndicators: run.structuredNotes?.fatigueIndicators ?? [],
      sorenessTightness: run.structuredNotes?.sorenessTightness ?? [],
      parsedNotes: run.structuredNotes?.notes ?? null,
    },
  };
}

function trimSummary(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 35).join(" ");
}

function calibrateScoreByStatus(status: PlanCheckResponse["status"], score: number): number {
  const rounded = Math.max(0, Math.min(100, Math.round(score)));

  switch (status) {
    case "completed_as_planned":
      return Math.max(85, rounded);
    case "overperformed":
      return Math.max(80, rounded);
    case "mostly_completed":
      return Math.max(65, rounded);
    case "underperformed":
      return Math.min(70, Math.max(35, rounded));
    case "missed":
      return Math.min(40, rounded);
    case "needs_review":
      return Math.min(60, Math.max(30, rounded));
    default:
      return rounded;
  }
}

function normalizePlanCheck(value: unknown, fallback: PlanCheckResponse): PlanCheckResponse {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const status = typeof record.status === "string" && ALLOWED_PLAN_CHECK_STATUS.has(record.status as PlanCheckResponse["status"])
    ? (record.status as PlanCheckResponse["status"])
    : fallback.status;
  const summary = typeof record.summary === "string" && record.summary.trim().length > 0
    ? trimSummary(record.summary)
    : fallback.summary;
  const rawScore = typeof record.score === "number" && Number.isFinite(record.score)
    ? record.score
    : fallback.score;
  const score = calibrateScoreByStatus(status, rawScore);

  return { status, summary, score };
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedRunId = url.searchParams.get("runId")?.trim() || null;
    const dateKeyFromQuery = parseRequestedDate(url.searchParams.get("date"));
    if (!requestedRunId && !dateKeyFromQuery) {
      return Response.json({ error: "Provide runId or date query param." }, { status: 400 });
    }

    const { runs, recommendations } = await getUserRunsAndRecommendations(userId);

    const requestedRun = requestedRunId ? runs.find((item) => item.id === requestedRunId) ?? null : null;
    const effectiveDateKey = requestedRun ? toDateKey(requestedRun.date) : dateKeyFromQuery;
    if (!effectiveDateKey) {
      return Response.json({ error: "Could not resolve analysis date." }, { status: 400 });
    }

    const dayRecommendations = recommendations.filter((item) => toDateKey(item.date) === effectiveDateKey);
    const dayRuns = runs.filter((item) => toDateKey(item.date) === effectiveDateKey);

    if (dayRecommendations.length === 0 || dayRuns.length === 0) {
      return Response.json({ payload: null });
    }

    const actual = requestedRun ?? dayRuns[0];
    const planned =
      dayRecommendations.find((item) => item.runType === actual.runType)
      ?? dayRecommendations[0];
    const paceRange = parsePaceRangeMinPerMile(planned.targetPace);
    const mainSet = inferMainSetFromRun(actual);
    const runnerNotes = buildRunnerNotes(actual);
    const runContext = toRunContext(actual);
    const input = {
      planned_type: planned.runType,
      planned_distance: planned.distanceMiles ?? null,
      planned_duration: planned.durationMinutes ?? null,
      target_pace_min: paceRange?.min ?? null,
      target_pace_max: paceRange?.max ?? null,
      workout_goal: extractGoal(planned.notes),
      actual_distance: actual.distanceMiles,
      actual_duration: actual.durationMinutes,
      avg_pace: actual.paceMinPerMile,
      effective_pace_for_comparison: mainSet.paceMinPerMileMin !== null
        ? {
            source: "runner_main_set",
            pace_min: mainSet.paceMinPerMileMin,
            pace_max: mainSet.paceMinPerMileMax,
          }
        : {
            source: "run_average",
            pace_min: actual.paceMinPerMile,
            pace_max: actual.paceMinPerMile,
          },
      splits_array: [],
      pace_variability: null,
      elevation: null,
      rpe: actual.structuredNotes?.effortLevel ?? actual.energyLevel ?? null,
      runner_notes: runnerNotes,
      runner_main_set: {
        text: mainSet.text,
        pace_min: mainSet.paceMinPerMileMin,
        pace_max: mainSet.paceMinPerMileMax,
        duration_min: mainSet.durationMinutesMin,
        duration_max: mainSet.durationMinutesMax,
      },
      actual_run: runContext,
      all_logged_runs_for_day: dayRuns.map(toRunContext),
      planned_workout_calendar_notes: planned.notes,
    };

    const fallback = fallbackPlanCheckAnalysis({
      plannedType: planned.runType,
      plannedDistanceMiles: planned.distanceMiles ?? null,
      plannedDurationMinutes: planned.durationMinutes ?? null,
      targetPaceMin: paceRange?.min ?? null,
      targetPaceMax: paceRange?.max ?? null,
      workoutGoal: extractGoal(planned.notes),
      actualDistanceMiles: actual.distanceMiles,
      actualDurationMinutes: actual.durationMinutes,
      avgPaceMinPerMile: actual.paceMinPerMile,
      effectivePaceMinPerMile: mainSet.paceMinPerMileMin,
      effectivePaceMaxPerMile: mainSet.paceMinPerMileMax,
      rpe: actual.structuredNotes?.effortLevel ?? null,
    });

    const aiResult = process.env.OPENAI_API_KEY
      ? await requestAiJson<PlanCheckResponse>(PLAN_CHECK_PROMPT, input, 420).catch(() => null)
      : null;

    return Response.json({
      payload: normalizePlanCheck(aiResult, fallback),
    });
  } catch {
    return Response.json({ error: "Failed to generate plan check." }, { status: 500 });
  }
}
