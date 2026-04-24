import { INJURY_RISK_PROMPT } from "@/lib/aiPrompts";
import { fallbackInjuryRisk } from "@/lib/aiFallbacks";
import { averagePace, gatherSorenessMentions, getPlannedRunForDate, getPlanContext, getUpcomingKeyWorkouts, getUserRunsAndRecommendations, isInRange, parseIsoDateSafe, sumMiles } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, startOfWeek, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { InjuryRiskPayload } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(weekEnd.getDate() - 7);

    const cacheKey = makeCacheKey([toDateKey(weekStart)]);

    if (!forceRefresh) {
      const cached = await getCachedInsight<InjuryRiskPayload>(userId, "injury_risk", cacheKey);
      if (cached) {
        return Response.json({ source: "cache", payload: cached.payload, updatedAt: cached.updatedAt });
      }
    }

    const { runs, recommendations, goals } = await getUserRunsAndRecommendations(userId);

    const currentRuns = runs.filter((run) => {
      const date = parseIsoDateSafe(run.date);
      return date ? isInRange(date, weekStart, weekEnd) : false;
    });

    const prevRuns = runs.filter((run) => {
      const date = parseIsoDateSafe(run.date);
      return date ? isInRange(date, prevWeekStart, prevWeekEnd) : false;
    });

    const currentWeekMiles = sumMiles(currentRuns);
    const previousWeekMiles = sumMiles(prevRuns);
    const mileageIncreasePercent =
      previousWeekMiles > 0 ? Number((((currentWeekMiles - previousWeekMiles) / previousWeekMiles) * 100).toFixed(2)) : 0;

    const currentPace = averagePace(currentRuns);
    const previousPace = averagePace(prevRuns);
    const paceDeclineSeconds =
      currentPace !== null && previousPace !== null && currentPace > previousPace
        ? Math.round((currentPace - previousPace) * 60)
        : 0;

    const hardRuns = currentRuns.filter((run) => ["Tempo", "Intervals", "Hills", "Race"].includes(run.runType));
    const hardRunRatio = currentRuns.length > 0 ? Number((hardRuns.length / currentRuns.length).toFixed(3)) : 0;

    const recentRuns = [...runs]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 8);
    const sorenessMentions = gatherSorenessMentions(recentRuns);

    const planContext = getPlanContext(goals);
    const upcomingKeyWorkouts = getUpcomingKeyWorkouts({
      recommendations,
      start: now,
      end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // next 7 days
      limit: 3,
    });

    const aiInput = {
      currentWeekMiles,
      previousWeekMiles,
      mileageIncreasePercent,
      sorenessMentionCount: sorenessMentions.length,
      sorenessMentions: sorenessMentions.slice(0, 6),
      paceDeclineSeconds,
      hardRunRatio,
      currentRunTypes: currentRuns.map((run) => run.runType),
      // Plan context
      activeGoal: planContext?.activeGoal ?? null,
      plannedWeeklyMileage: planContext?.plannedWeeklyMileage ?? null,
      upcomingKeyWorkoutTypes: upcomingKeyWorkouts.map((w) => w.runType),
    };

    const fallback = fallbackInjuryRisk({
      mileageIncreasePercent,
      sorenessMentionCount: sorenessMentions.length,
      paceDeclineSeconds,
      hardRunRatio,
    });

    const ai = process.env.OPENAI_API_KEY
      ? await requestAiJson<Pick<InjuryRiskPayload, "riskLevel" | "explanation" | "recommendation">>(
          INJURY_RISK_PROMPT,
          aiInput,
          220
        ).catch(() => null)
      : null;

    const payload: InjuryRiskPayload = {
      riskLevel: ai?.riskLevel === "low" || ai?.riskLevel === "moderate" || ai?.riskLevel === "high" ? ai.riskLevel : fallback.riskLevel,
      explanation: typeof ai?.explanation === "string" && ai.explanation.trim() ? ai.explanation.trim() : fallback.explanation,
      recommendation:
        typeof ai?.recommendation === "string" && ai.recommendation.trim() ? ai.recommendation.trim() : fallback.recommendation,
      metrics: {
        currentWeekMiles,
        previousWeekMiles,
        mileageIncreasePercent,
        sorenessMentionCount: sorenessMentions.length,
        hardRunRatio,
        paceDeclineSeconds,
        plannedWeeklyMileage: planContext?.plannedWeeklyMileage ?? null,
        activeGoal: planContext?.activeGoal ?? null,
        upcomingKeyWorkouts: upcomingKeyWorkouts.map((w) => `${w.runType} - ${w.title}`),
      },
    };

    const saved = await upsertInsight({
      userId,
      insightType: "injury_risk",
      periodStart: toIso(weekStart),
      periodEnd: toIso(weekEnd),
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build injury risk insight." }, { status: 500 });
  }
}
