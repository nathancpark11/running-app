import { WEEKLY_INSIGHTS_PROMPT } from "@/lib/aiPrompts";
import { fallbackWeeklyInsights } from "@/lib/aiFallbacks";
import { analyzeWeekPlannedWorkouts, averagePace, completedVsPlanned, extractBodyCheckNotes, getPlanContext, getUserRunsAndRecommendations, isInRange, parseIsoDateSafe, sumMiles } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, startOfWeek, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { RunLog, WeeklyInsightsPayload } from "@/lib/types";

export const runtime = "nodejs";
const WEEKLY_INSIGHTS_CACHE_VERSION = "v2";

type WeeklyInsightsAiResponse = {
  insights: string[];
};

function toWeekWindow(now: Date) {
  const currentStart = startOfWeek(now);
  const currentEnd = new Date(currentStart);
  currentEnd.setDate(currentStart.getDate() + 6);
  currentEnd.setHours(23, 59, 59, 999);

  const previousStart = new Date(currentStart);
  previousStart.setDate(currentStart.getDate() - 7);

  const previousEnd = new Date(currentEnd);
  previousEnd.setDate(currentEnd.getDate() - 7);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

function formatPace(value: number | null) {
  if (value === null) {
    return null;
  }

  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/mi`;
}

function getDailyMileageArray(runs: RunLog[], weekStart: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const totals = Array.from({ length: 7 }, () => 0);

  for (const run of runs) {
    const date = parseIsoDateSafe(run.date);
    if (!date) continue;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const index = Math.floor((dayStart.getTime() - weekStart.getTime()) / dayMs);
    if (index >= 0 && index < totals.length) {
      totals[index] += run.distanceMiles;
    }
  }

  return totals.map((miles) => Number(miles.toFixed(1)));
}

function summarizeFatigueLevel(runs: RunLog[]) {
  if (runs.length === 0) {
    return "unknown";
  }

  const averageEnergy = runs.reduce((sum, run) => sum + run.energyLevel, 0) / runs.length;
  const fatigueFlagCount = runs.filter((run) => (run.structuredNotes?.fatigueIndicators?.length ?? 0) > 0).length;

  if (averageEnergy <= 4.5 || fatigueFlagCount >= Math.max(2, Math.ceil(runs.length / 2))) {
    return "high";
  }

  if (averageEnergy <= 6.5 || fatigueFlagCount > 0) {
    return "moderate";
  }

  return "low";
}

function summarizeSorenessArea(runs: RunLog[]) {
  const keywordGroups = [
    { label: "calves", patterns: ["calf", "calves"] },
    { label: "shin", patterns: ["shin", "shins"] },
    { label: "achilles", patterns: ["achilles"] },
    { label: "knee", patterns: ["knee", "knees"] },
    { label: "hip", patterns: ["hip", "hips", "glute", "glutes"] },
    { label: "hamstring", patterns: ["hamstring", "hamstrings"] },
    { label: "quads", patterns: ["quad", "quads"] },
  ];
  const counts = new Map<string, number>();

  for (const run of runs) {
    const text = [
      run.notes,
      ...(run.structuredNotes?.sorenessTightness ?? []),
      ...extractBodyCheckNotes(run),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const group of keywordGroups) {
      if (group.patterns.some((pattern) => text.includes(pattern))) {
        counts.set(group.label, (counts.get(group.label) ?? 0) + 1);
      }
    }
  }

  const topMatch = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  if (topMatch) {
    return topMatch;
  }

  return runs.some((run) => run.soreness >= 6) ? "general soreness" : "none";
}

function formatWorkoutLabel(runType: string) {
  return runType === "Long" ? "Long Run" : runType;
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const now = new Date();
    const { currentStart, currentEnd, previousStart, previousEnd } = toWeekWindow(now);
    const cacheKey = makeCacheKey([toDateKey(currentStart), WEEKLY_INSIGHTS_CACHE_VERSION]);

    if (!forceRefresh) {
      const cached = await getCachedInsight<WeeklyInsightsPayload>(userId, "weekly_insights", cacheKey);
      if (cached) {
        return Response.json({ source: "cache", payload: cached.payload, updatedAt: cached.updatedAt });
      }
    }

    const { runs, recommendations, goals } = await getUserRunsAndRecommendations(userId);

    const current = completedVsPlanned({
      runs,
      recommendations,
      start: currentStart,
      end: currentEnd,
    });

    const previousRuns = runs.filter((run) => {
      const date = parseIsoDateSafe(run.date);
      return date ? isInRange(date, previousStart, previousEnd) : false;
    });

    const currentPace = averagePace(current.completed);
    const previousPace = averagePace(previousRuns);
    const paceDeltaSeconds =
      currentPace !== null && previousPace !== null ? Math.round((currentPace - previousPace) * 60) : 0;

    const currentWeekMiles = sumMiles(current.completed);
    const previousWeekMiles = sumMiles(previousRuns);
    const missedLongRun = current.missedPlanned.some((item) => item.runType === "Long");
    
    const planContext = getPlanContext(goals);
    const weekPlannedInfo = analyzeWeekPlannedWorkouts({
      recommendations,
      start: currentStart,
      end: currentEnd,
    });
    const goalMileage = planContext?.plannedWeeklyMileage ?? goals?.weeklyMileage ?? null;
    const plannedWorkouts = weekPlannedInfo.keyWorkouts.map((item) => item.title || formatWorkoutLabel(item.runType));
    const missedWorkouts = current.missedPlanned.map((item) => item.title || formatWorkoutLabel(item.runType));

    const input = {
      completedCount: current.completed.length,
      plannedCount: current.planned.length,
      missedCount: current.missedPlanned.length,
      currentWeekMiles,
      previousWeekMiles,
      paceDeltaSeconds,
      missedLongRun,
      activeGoal: planContext?.activeGoal ?? null,
      plannedWeeklyMileage: planContext?.plannedWeeklyMileage ?? null,
      planWorkoutsByType: weekPlannedInfo.workoutsByType,
      plannedMileageForWeek: weekPlannedInfo.plannedMileage,
      current_mileage: currentWeekMiles,
      daily_mileage_array: getDailyMileageArray(current.completed, currentStart),
      avg_pace: formatPace(currentPace),
      run_count: current.completed.length,
      previous_mileage: previousWeekMiles,
      previous_avg_pace: formatPace(previousPace),
      goal_mileage: goalMileage,
      planned_workouts: plannedWorkouts,
      fatigue_level: summarizeFatigueLevel(current.completed),
      soreness_area: summarizeSorenessArea(current.completed),
      missed_workouts: missedWorkouts,
    };

    const aiResult = process.env.OPENAI_API_KEY
      ? await requestAiJson<WeeklyInsightsAiResponse>(WEEKLY_INSIGHTS_PROMPT, input, 260).catch(() => null)
      : null;

    const fallback = fallbackWeeklyInsights({
      completedCount: input.completedCount,
      plannedCount: input.plannedCount,
      currentWeekMiles,
      previousWeekMiles,
      paceDeltaSeconds,
      missedLongRun,
      plannedWeeklyMileage: goalMileage,
      missedCount: input.missedCount,
    });

    const insights = Array.isArray(aiResult?.insights)
      ? aiResult.insights.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : fallback.insights;

    const payload: WeeklyInsightsPayload = {
      insights: insights.length > 0 ? insights : fallback.insights,
      meta: {
        completedCount: input.completedCount,
        plannedCount: input.plannedCount,
        missedCount: input.missedCount,
        currentWeekMiles,
        previousWeekMiles,
        paceDeltaSeconds,
        plannedWeeklyMileage: planContext?.plannedWeeklyMileage ?? null,
        activeGoal: planContext?.activeGoal ?? null,
      },
    };

    const saved = await upsertInsight({
      userId,
      insightType: "weekly_insights",
      periodStart: toIso(currentStart),
      periodEnd: toIso(currentEnd),
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build weekly insights." }, { status: 500 });
  }
}
