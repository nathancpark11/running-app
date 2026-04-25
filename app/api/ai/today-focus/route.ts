import { TODAY_FOCUS_PROMPT } from "@/lib/aiPrompts";
import { fallbackTodayFocus } from "@/lib/aiFallbacks";
import { getPlannedRunForDate, getPlanContext, getUserRunsAndRecommendations } from "@/lib/aiData";
import { getCachedInsight, makeCacheKey, startOfWeek, toDateKey, toIso, upsertInsight } from "@/lib/aiInsights";
import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { RunLog } from "@/lib/types";
import type { TodayFocusPayload } from "@/lib/types";

export const runtime = "nodejs";
const TODAY_FOCUS_CACHE_VERSION = "v4";

function tokenizeForComparison(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function looksLikeCopiedMainSet(mainSet: string, suggestion: string): boolean {
  const normalizedMainSet = mainSet.trim().toLowerCase();
  const normalizedSuggestion = suggestion.trim().toLowerCase();

  if (!normalizedMainSet || !normalizedSuggestion) {
    return false;
  }

  if (normalizedSuggestion.includes(normalizedMainSet)) {
    return true;
  }

  const mainTokens = tokenizeForComparison(normalizedMainSet);
  const suggestionTokens = tokenizeForComparison(normalizedSuggestion);
  const similarity = jaccardSimilarity(mainTokens, suggestionTokens);

  const hasStructureLanguage = /(\bx\b|with\s+\d+\s*(?:min|minutes|sec|seconds)|recovery|jog\s+recovery|easy\s+between|between\s+reps)/i.test(suggestion);

  return similarity >= 0.78 && !hasStructureLanguage;
}

function parseRequestedDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function extractTempoBlockMinutesFromNotes(notes: string): number | null {
  const text = notes.toLowerCase();
  const patterns = [
    /(\d{1,2})\s*(?:min|mins|minute|minutes)\s*(?:at\s*)?(?:tempo|threshold)/,
    /tempo\s*(?:for\s*)?(\d{1,2})\s*(?:min|mins|minute|minutes)/,
    /(\d{1,2})\s*(?:min|mins|minute|minutes)\s*(?:at\s*pace|at\s*effort)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isFinite(value) && value >= 5 && value <= 90) {
      return value;
    }
  }

  return null;
}

function extractMainSetText(notes: string): string | null {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return null;
  }

  const mainSetMatch = normalized.match(/Main\s*Set\s*:?\s*([\s\S]*?)(?=\n\s*(?:Cool\s*Down|Warm\s*Up)\s*:|$)/i);
  if (!mainSetMatch?.[1]) {
    return normalized;
  }

  const cleaned = mainSetMatch[1].trim().replace(/^[:\-\s]+/, "");
  return cleaned.length > 0 ? cleaned : null;
}

function roundToNearestFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function mphToMinPerMile(mph: number): string {
  if (!Number.isFinite(mph) || mph <= 0) {
    return "-";
  }

  const totalSeconds = Math.round(3600 / mph);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPaceRangeDisplay(paceRange: { low: number; high: number } | null, fallbackText: string | null): string {
  if (!paceRange) {
    return fallbackText ?? "target pace";
  }

  const lowMph = paceRange.low.toFixed(1);
  const highMph = paceRange.high.toFixed(1);
  const slowestMinPerMile = mphToMinPerMile(paceRange.low);
  const fastestMinPerMile = mphToMinPerMile(paceRange.high);

  return `${lowMph}-${highMph} mph (${slowestMinPerMile}-${fastestMinPerMile} min/mi)`;
}

function parseDurationRangeMinutes(input: string): { min: number; max: number } | null {
  const match = input.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:min|mins|minute|minutes)/i);
  if (!match) {
    return null;
  }

  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return null;
  }

  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

function parsePaceRange(input: string): { low: number; high: number } | null {
  const mphMatch = input.match(/(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)\s*(?:mph)?/i);
  if (mphMatch) {
    const first = Number(mphMatch[1]);
    const second = Number(mphMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second) && first >= 3 && second <= 20) {
      return {
        low: Math.min(first, second),
        high: Math.max(first, second),
      };
    }
  }

  const minPerMileMatch = input.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)/i);
  if (minPerMileMatch) {
    const toMph = (pace: string) => {
      const [mins, secs] = pace.split(":").map(Number);
      const minPerMile = mins + secs / 60;
      return 60 / minPerMile;
    };

    const first = toMph(minPerMileMatch[1]);
    const second = toMph(minPerMileMatch[2]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return {
        low: Math.min(first, second),
        high: Math.max(first, second),
      };
    }
  }

  const match = input.match(/(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)/i);
  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  return {
    low: Math.min(first, second),
    high: Math.max(first, second),
  };
}

function summarizeTempoHistory(tempoRuns: RunLog[]): {
  averageEffort: number | null;
  averageTempoMph: number | null;
  averageTempoBlockMinutes: number | null;
} {
  const withEffort = tempoRuns
    .map((run) => run.effortLevel)
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  const withPace = tempoRuns
    .map((run) => run.paceMinPerMile)
    .filter((value): value is number => Number.isFinite(value) && value > 0)
    .map((minPerMile) => 60 / minPerMile);

  const withBlocks = tempoRuns
    .map((run) => extractTempoBlockMinutesFromNotes(run.notes))
    .filter((value): value is number => value !== null);

  return {
    averageEffort:
      withEffort.length > 0
        ? Number((withEffort.reduce((sum, value) => sum + value, 0) / withEffort.length).toFixed(1))
        : null,
    averageTempoMph:
      withPace.length > 0
        ? Number((withPace.reduce((sum, value) => sum + value, 0) / withPace.length).toFixed(2))
        : null,
    averageTempoBlockMinutes:
      withBlocks.length > 0
        ? Number((withBlocks.reduce((sum, value) => sum + value, 0) / withBlocks.length).toFixed(1))
        : null,
  };
}

function buildPlannedWorkoutSuggestion(args: {
  runType: "Tempo" | "Intervals";
  durationRange: { min: number; max: number } | null;
  paceDisplayText: string;
  paceRange: { low: number; high: number } | null;
  averageEffort: number | null;
  averageTempoMph: number | null;
  averageTempoBlockMinutes: number | null;
}): string | null {
  const durationRangeText = args.durationRange ? `${args.durationRange.min}-${args.durationRange.max}` : null;
  const paceText = args.paceDisplayText;
  const targetMidpoint = args.durationRange
    ? roundToNearestFive((args.durationRange.min + args.durationRange.max) / 2)
    : args.averageTempoBlockMinutes
      ? roundToNearestFive(args.averageTempoBlockMinutes)
      : 25;
  const effortHigh = args.averageEffort !== null && args.averageEffort >= 7.5;
  const likelyFast =
    args.paceRange !== null && args.averageTempoMph !== null
      ? args.averageTempoMph >= args.paceRange.low - 0.1
      : false;

  if (args.runType === "Tempo") {
    if (effortHigh || !likelyFast) {
      const rep = Math.max(8, Math.round(targetMidpoint / 3));
      const reps = Math.max(2, Math.round(targetMidpoint / rep));
      return `Based on recent tempo effort, try ${reps} x ${rep} min at ${paceText} with 3-4 min easy between reps (total quality ${targetMidpoint} min).`;
    }

    const block = Math.max(12, Math.round(targetMidpoint / 2));
    return `Based on recent tempo performance, try 2 x ${block} min at ${paceText} with 5 min easy between blocks (total quality ${targetMidpoint} min).`;
  }

  if (durationRangeText) {
    const rep = Math.max(3, Math.round(targetMidpoint / 5));
    const reps = Math.max(4, Math.round(targetMidpoint / rep));
    return `Try ${reps} x ${rep} min at ${paceText} with 2 min jog recovery to match ${durationRangeText} min of quality work.`;
  }

  return `Try 6 x 3 min at ${paceText} with 90 sec jog; keep effort around recent tempo-day effort.`;
}

function fallbackTempoAtPaceSuggestion(tempoRuns: RunLog[]): string | null {
  if (tempoRuns.length === 0) {
    return null;
  }

  const noteDerived = tempoRuns
    .map((run) => extractTempoBlockMinutesFromNotes(run.notes))
    .filter((value): value is number => value !== null);

  const inferredMinutes =
    noteDerived.length > 0
      ? noteDerived.reduce((sum, value) => sum + value, 0) / noteDerived.length
      : tempoRuns
          .map((run) => run.durationMinutes)
          .filter((value) => Number.isFinite(value) && value > 0)
          .slice(0, 4)
          .reduce((sum, value) => sum + value * 0.55, 0) / Math.max(1, Math.min(4, tempoRuns.length));

  if (!Number.isFinite(inferredMinutes) || inferredMinutes <= 0) {
    return null;
  }

  const minutes = Math.max(10, Math.min(45, roundToNearestFive(inferredMinutes)));
  return `Aim for about ${minutes} minutes at tempo pace.`;
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const targetDate = parseRequestedDate(url.searchParams.get("date")) ?? new Date();
    const currentWeekKey = toDateKey(startOfWeek(new Date()));
    const dateKey = toDateKey(targetDate);
    const cacheKey = makeCacheKey([TODAY_FOCUS_CACHE_VERSION, dateKey, currentWeekKey]);

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

    const startOfTargetDate = new Date(targetDate);
    startOfTargetDate.setHours(0, 0, 0, 0);

    const todayOrNext = [...recommendations]
      .filter((item) => new Date(item.date) >= startOfTargetDate)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0] ?? null;

    const planContext = getPlanContext(goals);
    const plannedForToday = getPlannedRunForDate(recommendations, dateKey);
    const isTempoDay = plannedForToday?.runType === "Tempo";
    const isQualityDay = plannedForToday?.runType === "Tempo" || plannedForToday?.runType === "Intervals";
    const recentTempoRuns = [...runs]
      .filter((run) => run.runType === "Tempo")
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 6);
    const tempoHistorySummary = summarizeTempoHistory(recentTempoRuns);

    const fallbackTempoSuggestion = isTempoDay ? fallbackTempoAtPaceSuggestion(recentTempoRuns) : null;
    const mainSetText = extractMainSetText(plannedForToday?.notes ?? "") ?? "";
    const planText = `${mainSetText} ${plannedForToday?.targetPace ?? ""}`;
    const durationRange = parseDurationRangeMinutes(planText);
    const paceRange = parsePaceRange(planText);
    const paceDisplayText = formatPaceRangeDisplay(paceRange, plannedForToday?.targetPace ?? null);
    const fallbackPlannedWorkoutSuggestion =
      isQualityDay && plannedForToday
        ? buildPlannedWorkoutSuggestion({
            runType: plannedForToday.runType as "Tempo" | "Intervals",
            durationRange,
            paceDisplayText,
            paceRange,
            averageEffort: tempoHistorySummary.averageEffort,
            averageTempoMph: tempoHistorySummary.averageTempoMph,
            averageTempoBlockMinutes: tempoHistorySummary.averageTempoBlockMinutes,
          })
        : null;

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
            mainSet: mainSetText || null,
            durationRange,
            paceRange,
          }
        : null,
      tempoHistory: recentTempoRuns.map((run) => ({
        date: run.date,
        durationMinutes: run.durationMinutes,
        paceMinPerMile: run.paceMinPerMile,
        effortLevel: run.effortLevel,
        estimatedTempoBlockMinutes: extractTempoBlockMinutesFromNotes(run.notes),
        notes: run.notes.slice(0, 140),
      })),
      tempoHistorySummary,
    };

    const fallback = fallbackTodayFocus({
      upcomingTitle: todayOrNext?.title,
      upcomingRunType: todayOrNext?.runType,
      recentFastStarts: hasFastStarts,
      injuryRiskLevel: null,
      tempoAtPaceSuggestion: fallbackTempoSuggestion,
      plannedWorkoutSuggestion: fallbackPlannedWorkoutSuggestion,
    });

    const ai = process.env.OPENAI_API_KEY
      ? await requestAiJson<{ tip: string; tempoAtPaceSuggestion?: string | null; plannedWorkoutSuggestion?: string | null }>(TODAY_FOCUS_PROMPT, aiInput, 280).catch(() => null)
      : null;

    const aiTempoSuggestion =
      typeof ai?.tempoAtPaceSuggestion === "string" && ai.tempoAtPaceSuggestion.trim()
        ? ai.tempoAtPaceSuggestion.trim()
        : null;
    const aiPlannedWorkoutSuggestion =
      typeof ai?.plannedWorkoutSuggestion === "string" && ai.plannedWorkoutSuggestion.trim()
        ? ai.plannedWorkoutSuggestion.trim()
        : null;
    const sanitizedAiPlannedWorkoutSuggestion =
      aiPlannedWorkoutSuggestion && mainSetText && looksLikeCopiedMainSet(mainSetText, aiPlannedWorkoutSuggestion)
        ? null
        : aiPlannedWorkoutSuggestion;

    const payload: TodayFocusPayload = {
      tip: typeof ai?.tip === "string" && ai.tip.trim() ? ai.tip.trim() : fallback.tip,
      targetDate: todayOrNext?.date ?? null,
      trainingTitle: todayOrNext?.title ?? null,
      plannedRunType: plannedForToday?.runType ?? null,
      plannedDistance: plannedForToday?.distanceMiles ?? null,
      tempoAtPaceSuggestion: isTempoDay ? aiTempoSuggestion ?? fallback.tempoAtPaceSuggestion ?? null : null,
      plannedWorkoutSuggestion: isQualityDay ? sanitizedAiPlannedWorkoutSuggestion ?? fallback.plannedWorkoutSuggestion ?? null : null,
    };

    const saved = await upsertInsight({
      userId,
      insightType: "today_focus",
      periodStart: toIso(startOfTargetDate),
      periodEnd: toIso(startOfTargetDate),
      cacheKey,
      payload,
    });

    return Response.json({ source: "fresh", payload, updatedAt: saved.updatedAt });
  } catch {
    return Response.json({ error: "Failed to build today's focus." }, { status: 500 });
  }
}
