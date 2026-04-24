import { WEEKLY_INSIGHTS_PROMPT } from "@/lib/aiPrompts";
import { fallbackWeeklyInsights } from "@/lib/aiFallbacks";
import { analyzeWeekPlannedWorkouts, averagePace, completedVsPlanned, getPlanContext, getUserRunsAndRecommendations, isInRange, parseIsoDateSafe, sumMiles } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, startOfWeek, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { WeeklyInsightsPayload } from "@/lib/types";

export const runtime = "nodejs";

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
    const cacheKey = makeCacheKey([toDateKey(currentStart)]);

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

    const input = {
      completedCount: current.completed.length,
      plannedCount: current.planned.length,
      missedCount: current.missedPlanned.length,
      missedRunTypes: current.missedPlanned.map((item) => item.runType),
      currentWeekMiles,
      previousWeekMiles,
      paceDeltaSeconds,
      completedRunTypes: current.completed.map((item) => item.runType),
      missedLongRun,
      // Plan context
      activeGoal: planContext?.activeGoal ?? null,
      plannedWeeklyMileage: planContext?.plannedWeeklyMileage ?? null,
      planWorkoutsByType: weekPlannedInfo.workoutsByType,
      plannedMileageForWeek: weekPlannedInfo.plannedMileage,
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
    });

    const insights = Array.isArray(aiResult?.insights)
      ? aiResult.insights.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
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
