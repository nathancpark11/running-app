import { STRETCH_RECOMMENDATION_PROMPT } from "@/lib/aiPrompts";
import { fallbackStretchRecommendation } from "@/lib/aiFallbacks";
import { gatherSorenessMentions, getUpcomingKeyWorkouts, getPlanContext, getUserRunsAndRecommendations } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { StretchRecommendationPayload } from "@/lib/types";

export const runtime = "nodejs";
const STRETCH_RECOMMENDATION_CACHE_VERSION = "v2";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const today = new Date();

    const cacheKey = runId
      ? makeCacheKey([STRETCH_RECOMMENDATION_CACHE_VERSION, "run", runId])
      : makeCacheKey([STRETCH_RECOMMENDATION_CACHE_VERSION, "date", toDateKey(today)]);

    if (!forceRefresh) {
      const cached = await getCachedInsight<StretchRecommendationPayload>(userId, "stretch_recommendation", cacheKey);
      if (cached) {
        return Response.json({ source: "cache", payload: cached.payload, updatedAt: cached.updatedAt });
      }
    }

    const { runs, recommendations, goals } = await getUserRunsAndRecommendations(userId);
    const sortedRuns = [...runs].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    const latestRun = runId ? sortedRuns.find((run) => run.id === runId) ?? sortedRuns[0] : sortedRuns[0];

    const nextRun = [...recommendations]
      .filter((item) => new Date(item.date) >= new Date())
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];

    const sorenessMentions = gatherSorenessMentions(sortedRuns.slice(0, 5));

    const planContext = getPlanContext(goals);
    const upcomingKeyWorkouts = getUpcomingKeyWorkouts({
      recommendations,
      start: today,
      end: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // next 7 days
      limit: 2,
    });

    const aiInput = {
      latestRun:
        latestRun
          ? {
              id: latestRun.id,
              runType: latestRun.runType,
              notes: latestRun.notes,
              bodyCheckEntries: latestRun.bodyCheck?.entries ?? [],
            }
          : null,
      upcomingRun: nextRun
        ? {
            date: nextRun.date,
            title: nextRun.title,
            runType: nextRun.runType,
          }
        : null,
      sorenessMentions: sorenessMentions.slice(0, 6),
      // Plan context
      upcomingKeyWorkouts: upcomingKeyWorkouts.map((w) => ({
        type: w.runType,
        title: w.title,
      })),
      activeGoal: planContext?.activeGoal ?? null,
    };

    const fallback = fallbackStretchRecommendation({
      sorenessMentions,
      latestRunType: latestRun?.runType,
      upcomingRunType: nextRun?.runType,
    });

    const ai = process.env.OPENAI_API_KEY
      ? await requestAiJson<{ focus: string; reason: string }>(STRETCH_RECOMMENDATION_PROMPT, aiInput, 180).catch(() => null)
      : null;

    const payload: StretchRecommendationPayload = {
      focus: typeof ai?.focus === "string" && ai.focus.trim() ? ai.focus.trim() : fallback.focus,
      reason: typeof ai?.reason === "string" && ai.reason.trim() ? ai.reason.trim() : fallback.reason,
      basedOnRunId: latestRun?.id ?? null,
    };

    const saved = await upsertInsight({
      userId,
      insightType: "stretch_recommendation",
      periodStart: toIso(today),
      periodEnd: toIso(today),
      relatedRunId: latestRun?.id ?? null,
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build stretch recommendation." }, { status: 500 });
  }
}
