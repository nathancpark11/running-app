import { INJURY_RISK_PROMPT } from "@/lib/aiPrompts";
import { fallbackInjuryRisk } from "@/lib/aiFallbacks";
import { averagePace, gatherSorenessMentions, getPlanContext, getUpcomingKeyWorkouts, getUserRunsAndRecommendations, isInRange, parseIsoDateSafe, sumMiles } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, startOfWeek, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { InjuryRiskPayload } from "@/lib/types";

export const runtime = "nodejs";

function toWeekWindow(now: Date) {
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  thisWeekEnd.setHours(23, 59, 59, 999);

  // Analyze completed weeks only.
  const currentStart = new Date(thisWeekStart);
  currentStart.setDate(thisWeekStart.getDate() - 7);
  const currentEnd = new Date(currentStart);
  currentEnd.setDate(currentStart.getDate() + 6);
  currentEnd.setHours(23, 59, 59, 999);

  const previousStart = new Date(currentStart);
  previousStart.setDate(currentStart.getDate() - 7);
  const previousEnd = new Date(currentEnd);
  previousEnd.setDate(currentEnd.getDate() - 7);

  return { thisWeekStart, thisWeekEnd, currentStart, currentEnd, previousStart, previousEnd };
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
    const { thisWeekStart, thisWeekEnd, currentStart, currentEnd, previousStart, previousEnd } = toWeekWindow(now);
    const cacheKey = makeCacheKey([toDateKey(currentStart)]);

    if (!forceRefresh) {
      const cached = await getCachedInsight<InjuryRiskPayload>(userId, "injury_risk", cacheKey);
      if (cached) {
        return Response.json({ source: "cache", payload: cached.payload, updatedAt: cached.updatedAt });
      }
    }

    const { runs, recommendations, goals } = await getUserRunsAndRecommendations(userId);

    const currentRuns = runs.filter((run) => {
      const date = parseIsoDateSafe(run.date);
      return date ? isInRange(date, currentStart, currentEnd) : false;
    });

    const prevRuns = runs.filter((run) => {
      const date = parseIsoDateSafe(run.date);
      return date ? isInRange(date, previousStart, previousEnd) : false;
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

    const thisWeekActualMiles = sumMiles(
      runs.filter((run) => {
        const date = parseIsoDateSafe(run.date);
        return date ? isInRange(date, thisWeekStart, thisWeekEnd) : false;
      })
    );
    const thisWeekPlannedMiles = recommendations
      .filter((item) => {
        const date = parseIsoDateSafe(item.date);
        return date ? isInRange(date, thisWeekStart, thisWeekEnd) : false;
      })
      .reduce((sum, item) => sum + (item.distanceMiles ?? 0), 0);
    const projectedWeekMiles = Number(Math.max(thisWeekActualMiles, thisWeekPlannedMiles).toFixed(2));
    const projectedMileageIncreasePercent =
      currentWeekMiles > 0 ? Number((((projectedWeekMiles - currentWeekMiles) / currentWeekMiles) * 100).toFixed(2)) : 0;

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
      projectedWeekMiles,
      projectedMileageIncreasePercent,
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
      projectedMileageIncreasePercent,
      sorenessMentionCount: sorenessMentions.length,
      paceDeclineSeconds,
      hardRunRatio,
    });

    const ai = process.env.OPENAI_API_KEY
      ? await requestAiJson<Pick<InjuryRiskPayload, "riskLevel" | "suggestion">>(
          INJURY_RISK_PROMPT,
          aiInput,
          120
        ).catch(() => null)
      : null;

    const payload: InjuryRiskPayload = {
      riskLevel: ai?.riskLevel === "low" || ai?.riskLevel === "moderate" || ai?.riskLevel === "high" ? ai.riskLevel : fallback.riskLevel,
      suggestion: typeof ai?.suggestion === "string" && ai.suggestion.trim() ? ai.suggestion.trim() : fallback.suggestion ?? null,
      metrics: {
        currentWeekMiles,
        previousWeekMiles,
        mileageIncreasePercent,
        projectedWeekMiles,
        projectedMileageIncreasePercent,
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
      periodStart: toIso(currentStart),
      periodEnd: toIso(currentEnd),
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build injury risk insight." }, { status: 500 });
  }
}
