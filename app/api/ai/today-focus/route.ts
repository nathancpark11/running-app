import { TODAY_FOCUS_PROMPT } from "@/lib/aiPrompts";
import { fallbackTodayFocus } from "@/lib/aiFallbacks";
import { getPlannedRunForDate, getPlanContext, getUserRunsAndRecommendations } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { TodayFocusPayload } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const today = new Date();
    const dateKey = toDateKey(today);
    const cacheKey = makeCacheKey([dateKey]);

    if (!forceRefresh) {
      const cached = await getCachedInsight<TodayFocusPayload>(userId, "today_focus", cacheKey);
      if (cached) {
        return Response.json({ source: "cache", payload: cached.payload, updatedAt: cached.updatedAt });
      }
    }

    const { runs, recommendations, goals } = await getUserRunsAndRecommendations(userId);
    const recentRuns = [...runs]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 3);

    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrNext = [...recommendations]
      .filter((item) => new Date(item.date) >= startOfToday)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0] ?? null;

    const planContext = getPlanContext(goals);
    const plannedForToday = getPlannedRunForDate(recommendations, dateKey);

    const hasFastStarts = recentRuns.some((run) => {
      const note = run.notes.toLowerCase();
      return note.includes("fast start") || note.includes("started too fast") || note.includes("blew up");
    });

    const aiInput = {
      today: dateKey,
      upcomingRun: todayOrNext
        ? {
            date: todayOrNext.date,
            title: todayOrNext.title,
            runType: todayOrNext.runType,
            notes: todayOrNext.notes,
            distanceMiles: todayOrNext.distanceMiles ?? null,
          }
        : null,
      recentRuns: recentRuns.map((run) => ({
        date: run.date,
        title: run.title,
        runType: run.runType,
        distanceMiles: run.distanceMiles,
        paceMinPerMile: run.paceMinPerMile,
        notes: run.notes,
      })),
      hasFastStarts,
      // Plan context
      activeGoal: planContext?.activeGoal ?? null,
      plannedForToday: plannedForToday
        ? {
            runType: plannedForToday.runType,
            distance: plannedForToday.distanceMiles ?? null,
            pace: plannedForToday.targetPace ?? null,
          }
        : null,
    };

    const fallback = fallbackTodayFocus({
      upcomingTitle: todayOrNext?.title,
      upcomingRunType: todayOrNext?.runType,
      recentFastStarts: hasFastStarts,
      injuryRiskLevel: null,
    });

    const ai = process.env.OPENAI_API_KEY
      ? await requestAiJson<{ tip: string }>(TODAY_FOCUS_PROMPT, aiInput, 160).catch(() => null)
      : null;

    const payload: TodayFocusPayload = {
      tip: typeof ai?.tip === "string" && ai.tip.trim() ? ai.tip.trim() : fallback.tip,
      targetDate: todayOrNext?.date ?? null,
      trainingTitle: todayOrNext?.title ?? null,
      plannedRunType: plannedForToday?.runType ?? null,
      plannedDistance: plannedForToday?.distanceMiles ?? null,
    };

    const saved = await upsertInsight({
      userId,
      insightType: "today_focus",
      periodStart: toIso(startOfToday),
      periodEnd: toIso(startOfToday),
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build today's focus." }, { status: 500 });
  }
}
