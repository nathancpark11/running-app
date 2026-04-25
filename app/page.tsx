"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProgressCard } from "@/components/ProgressCard";
import { RunCard } from "@/components/RunCard";
import { useRunTrack } from "@/components/RunTrackProvider";
import { isDateInCurrentWeek } from "@/lib/format";
import type { InjuryRiskPayload, StretchRecommendationPayload, TodayFocusPayload, WeeklyInsightsPayload } from "@/lib/types";

const WEEKLY_INSIGHTS_REFRESH_KEY = "runtrack:weekly-insights-refresh";
const DAILY_CHECKIN_STORAGE_KEY = "runtrack:daily-checkin";

type LegFeeling = "good" | "tight" | "pain";
type EnergyLevel = "high" | "medium" | "low";
type DailyCheckIn = { legs: LegFeeling; energy: EnergyLevel; date: string };
type WeeklyInsightTone = "POSITIVE" | "RISK" | "TREND" | "ACTION";

const WEEKLY_INSIGHT_STYLES: Record<WeeklyInsightTone, string> = {
  POSITIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  RISK: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  TREND: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  ACTION: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
};

function parseWeeklyInsight(insight: string): { tone: WeeklyInsightTone | null; text: string } {
  const match = insight.match(/^\[(POSITIVE|RISK|TREND|ACTION)\]\s*(.*)$/);
  if (!match) {
    return { tone: null, text: insight };
  }

  return {
    tone: match[1] as WeeklyInsightTone,
    text: match[2] || insight,
  };
}

function toTitleCase(value: string): string {
  return value.replace(/\b([a-z])/gi, (letter) => letter.toUpperCase());
}

function extractMainSetContent(notes: string): string {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const mainSetMatch = normalized.match(/Main\s*Set\s*:?\s*([\s\S]*?)(?=\n\s*(?:Cool\s*Down|Warm\s*Up)\s*:|$)/i);
  if (!mainSetMatch?.[1]) {
    return normalized;
  }

  return mainSetMatch[1].trim().replace(/^[:\-\s]+/, "");
}

function hasClearMainSetTarget(notes: string, targetPace?: string): boolean {
  const mainSet = extractMainSetContent(notes);
  if (!mainSet) {
    return false;
  }

  const hasDuration =
    /(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:min|mins|minute|minutes)/i.test(mainSet)
    || /\b\d{1,2}\s*(?:min|mins|minute|minutes)\b/i.test(mainSet);

  const hasPace =
    /(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)\s*(?:mph)?/i.test(mainSet)
    || /(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)/i.test(mainSet)
    || Boolean(targetPace?.trim());

  return hasDuration && hasPace;
}

export default function DashboardPage() {
  const { runs, goals, trainingRecommendations, trainingPlanName } = useRunTrack();
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsightsPayload | null>(null);
  const [injuryRisk, setInjuryRisk] = useState<InjuryRiskPayload | null>(null);
  const [todayFocus, setTodayFocus] = useState<TodayFocusPayload | null>(null);
  const [stretchRecommendation, setStretchRecommendation] = useState<StretchRecommendationPayload | null>(null);
  const [aiCardError, setAiCardError] = useState("");
  const [stretchRecommendationError, setStretchRecommendationError] = useState("");
  const [selectedTrendDay, setSelectedTrendDay] = useState<{
    date: Date;
    label: string;
    runs: typeof runs;
  } | null>(null);
  const [checkIn, setCheckIn] = useState<DailyCheckIn | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(DAILY_CHECKIN_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as DailyCheckIn;
      return parsed.date === new Date().toISOString().slice(0, 10) ? parsed : null;
    } catch {
      return null;
    }
  });
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [pendingLegs, setPendingLegs] = useState<LegFeeling | null>(null);
  const [pendingEnergy, setPendingEnergy] = useState<EnergyLevel | null>(null);

  const sortedRuns = [...runs].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const recentRuns = sortedRuns.slice(0, 1);

  const weeklyMiles = runs
    .filter((run) => isDateInCurrentWeek(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);

  const localInjuryMetrics = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - diffToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(currentWeekStart.getDate() - 7);

    const currentRuns = runs.filter((run) => new Date(run.date) >= currentWeekStart);
    const prevRuns = runs.filter((run) => {
      const d = new Date(run.date);
      return d >= prevWeekStart && d < currentWeekStart;
    });

    const currMiles = currentRuns.reduce((sum, r) => sum + r.distanceMiles, 0);
    const prevMiles = prevRuns.reduce((sum, r) => sum + r.distanceMiles, 0);
    const mileageChangePercent = prevMiles > 0
      ? Number((((currMiles - prevMiles) / prevMiles) * 100).toFixed(1))
      : 0;

    const hardTypes = ["Tempo", "Intervals", "Hills", "Race"];
    const hardCount = currentRuns.filter((r) => hardTypes.includes(r.runType)).length;
    const hardRunRatio = currentRuns.length > 0 ? Number((hardCount / currentRuns.length).toFixed(2)) : 0;

    const rawLocalLevel: "low" | "moderate" | "high" =
      mileageChangePercent >= 30 || hardRunRatio >= 0.55
        ? "high"
        : mileageChangePercent >= 20 || hardRunRatio >= 0.4
          ? "moderate"
          : "low";

    let checkInPressure = 0;
    if (checkIn) {
      if (checkIn.legs === "pain") checkInPressure += 2;
      else if (checkIn.legs === "tight") checkInPressure += 1;
      if (checkIn.energy === "low") checkInPressure += 1;
    }

    const localLevel: "low" | "moderate" | "high" =
      rawLocalLevel === "high" || checkInPressure >= 2
        ? "high"
        : rawLocalLevel === "moderate" || checkInPressure >= 1
          ? "moderate"
          : "low";

    return { mileageChangePercent, hardRunRatio, localLevel, checkInPressure };
  }, [runs, checkIn]);

  const weeklyMileageSeries = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return labels.map((label, index) => {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + index);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const dayRuns = runs
        .filter((run) => {
          const runDate = new Date(run.date);
          return runDate >= dayStart && runDate < dayEnd;
        })
        .sort((left, right) => +new Date(right.date) - +new Date(left.date));

      const miles = dayRuns.reduce((sum, run) => sum + run.distanceMiles, 0);

      return { label, miles, date: new Date(dayStart), runs: dayRuns };
    });
  }, [runs]);

  const weeklyMileageMax = Math.max(1, ...weeklyMileageSeries.map((item) => item.miles));

  const weeklyPlannedMiles = trainingRecommendations
    .filter((recommendation) => isDateInCurrentWeek(recommendation.date))
    .reduce((sum, recommendation) => sum + (recommendation.distanceMiles ?? 0), 0);

  const weeklyRecommendationCount = trainingRecommendations.filter((recommendation) =>
    isDateInCurrentWeek(recommendation.date)
  ).length;

  const usingPlanForWeeklyGoal = weeklyRecommendationCount > 0 && weeklyPlannedMiles > 0;
  const weeklyGoalTarget = Number((usingPlanForWeeklyGoal ? weeklyPlannedMiles : goals.weeklyMileage).toFixed(1));

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysRecommendation = trainingRecommendations.find(
    (recommendation) => recommendation.date.slice(0, 10) === todayKey
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const nextRecommendation = todaysRecommendation
    ? null
    : [...trainingRecommendations]
        .filter((recommendation) => new Date(recommendation.date) >= startOfToday)
        .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];

  const nextRecommendationDay = nextRecommendation
    ? new Date(nextRecommendation.date).toLocaleDateString(undefined, {
        weekday: "long",
      })
    : "";

  function submitCheckIn() {
    if (!pendingLegs || !pendingEnergy) return;
    const entry: DailyCheckIn = { legs: pendingLegs, energy: pendingEnergy, date: todayKey };
    setCheckIn(entry);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DAILY_CHECKIN_STORAGE_KEY, JSON.stringify(entry));
    }
    setCheckInSuccess(true);
    setTimeout(() => {
      setShowCheckInModal(false);
      setCheckInSuccess(false);
      setPendingLegs(null);
      setPendingEnergy(null);
    }, 1200);
  }

  useEffect(() => {
    let canceled = false;
    const shouldForceWeeklyRefresh =
      typeof window !== "undefined" && window.localStorage.getItem(WEEKLY_INSIGHTS_REFRESH_KEY) === "1";

    if (shouldForceWeeklyRefresh && typeof window !== "undefined") {
      window.localStorage.removeItem(WEEKLY_INSIGHTS_REFRESH_KEY);
    }

    const weeklyInsightsUrl = shouldForceWeeklyRefresh
      ? "/api/ai/weekly-insights?refresh=1"
      : "/api/ai/weekly-insights";

    async function loadAiCards() {
      setAiCardError("");
      setStretchRecommendationError("");

      try {
        const [weeklyRes, injuryRes, focusRes, stretchRes] = await Promise.all([
          fetch(weeklyInsightsUrl, { cache: "no-store" }),
          fetch("/api/ai/injury-risk", { cache: "no-store" }),
          fetch("/api/ai/today-focus", { cache: "no-store" }),
          fetch("/api/ai/stretch-recommendations", { cache: "no-store" }),
        ]);

        const [weeklyData, injuryData, focusData, stretchData] = (await Promise.all([
          weeklyRes.json(),
          injuryRes.json(),
          focusRes.json(),
          stretchRes.json(),
        ])) as [
          { payload?: WeeklyInsightsPayload; error?: string },
          { payload?: InjuryRiskPayload; error?: string },
          { payload?: TodayFocusPayload; error?: string },
          { payload?: StretchRecommendationPayload; error?: string }
        ];

        if (canceled) {
          return;
        }

        if (weeklyRes.ok && weeklyData.payload) {
          setWeeklyInsights(weeklyData.payload);
        }

        if (injuryRes.ok && injuryData.payload) {
          setInjuryRisk(injuryData.payload);
        }

        if (focusRes.ok && focusData.payload) {
          setTodayFocus(focusData.payload);
        }

        if (stretchRes.ok && stretchData.payload) {
          setStretchRecommendation(stretchData.payload);
        } else if (!stretchRes.ok && stretchData.error) {
          setStretchRecommendationError(stretchData.error);
        }

        const fallbackError = weeklyData.error ?? injuryData.error ?? focusData.error;
        if ((!weeklyRes.ok || !injuryRes.ok || !focusRes.ok) && fallbackError) {
          setAiCardError(fallbackError);
        }
      } catch {
        if (!canceled) {
          setAiCardError("AI insights are temporarily unavailable.");
        }
      }
    }

    void loadAiCards();

    return () => {
      canceled = true;
    };
  }, [runs.length]);

  return (
    <div className="space-y-2.5">
      <article className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {todaysRecommendation ? "Run on deck" : "Rest Day / Recovery Day"}
          </p>
          {trainingPlanName ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{trainingPlanName}</p> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {todaysRecommendation
            ? `${todaysRecommendation.title} • ${todaysRecommendation.runType}`
            : nextRecommendation
              ? `Next: ${nextRecommendation.title} (${nextRecommendationDay.slice(0, 3)})`
              : "Rest Day / Recovery Day"}
        </p>
        {todaysRecommendation && todayFocus?.tip ? (
          <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-200">Today&apos;s focus: {todayFocus.tip}</p>
        ) : null}
        {todaysRecommendation?.runType === "Tempo" && todayFocus?.tempoAtPaceSuggestion && !hasClearMainSetTarget(todaysRecommendation.notes, todaysRecommendation.targetPace) ? (
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">At pace: {todayFocus.tempoAtPaceSuggestion}</p>
        ) : null}
        {(todaysRecommendation?.runType === "Tempo" || todaysRecommendation?.runType === "Intervals") && todayFocus?.plannedWorkoutSuggestion ? (
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">Suggested workout: {todayFocus.plannedWorkoutSuggestion}</p>
        ) : null}
        {todaysRecommendation ? (
          <div className="mt-2">
            <Link
              href="/runs?add=1"
              className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            >
              Add run
            </Link>
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 shadow-none dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">Recommended Stretch</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {stretchRecommendation?.focus ? toTitleCase(stretchRecommendation.focus) : "Load your latest run data to get a suggestion."}
        </p>
        {stretchRecommendation?.reason ? <p className="mt-1 text-xs text-blue-700 dark:text-blue-100">{stretchRecommendation.reason}</p> : null}
        {stretchRecommendationError ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{stretchRecommendationError}</p> : null}
      </article>

      {!checkIn ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowCheckInModal(true)}
            className="rounded-xl border border-slate-200/70 bg-white/60 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-none backdrop-blur-sm transition hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Complete daily check-in
          </button>
        </div>
      ) : null}

      <ProgressCard
        title={usingPlanForWeeklyGoal ? "Weekly plan" : "Weekly goal"}
        current={weeklyMiles}
        goal={weeklyGoalTarget}
        color="green"
        compact
      />

      <article className="rounded-xl border border-slate-200/70 bg-white/60 p-2.5 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Weekly Mileage Trend</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">This week</p>
        </div>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5">
          {weeklyMileageSeries.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.runs.length === 0) {
                  return;
                }

                setSelectedTrendDay({
                  date: item.date,
                  label: item.label,
                  runs: item.runs,
                });
              }}
              disabled={item.runs.length === 0}
              className={`flex flex-col items-center gap-1 rounded-lg transition ${
                item.runs.length > 0
                  ? "cursor-pointer hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:hover:bg-slate-800/60"
                  : "cursor-default"
              }`}
              aria-label={
                item.runs.length > 0
                  ? `View ${item.runs.length === 1 ? "run" : "runs"} for ${item.label}`
                  : `${item.label} has no logged run`
              }
            >
              <div className="flex h-18 w-full items-end rounded-md bg-slate-100/80 px-1.5 py-1 dark:bg-slate-800/70">
                <div
                  className="w-full rounded bg-emerald-500/90"
                  style={{ height: `${Math.max(6, (item.miles / weeklyMileageMax) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200">{item.miles.toFixed(1)}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-slate-200/70 bg-white/60 p-2.5 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        {(() => {
            const level = injuryRisk?.riskLevel ?? localInjuryMetrics.localLevel;
            const mileagePct = injuryRisk?.metrics?.mileageIncreasePercent ?? localInjuryMetrics.mileageChangePercent;
            const hardRatio = injuryRisk?.metrics?.hardRunRatio ?? localInjuryMetrics.hardRunRatio;
            const sorenessCt = injuryRisk?.metrics?.sorenessMentionCount ?? null;

            const mileageLabel = mileagePct === 0 ? "0%" : `${mileagePct > 0 ? "+" : ""}${mileagePct.toFixed(0)}%`;
            const intensityLabel = `${Math.round(hardRatio * 100)}% hard`;
            const recoveryLabel = sorenessCt === null ? "—" : sorenessCt === 0 ? "None" : `${sorenessCt} flag${sorenessCt !== 1 ? "s" : ""}`;

            const mileageColor =
              Math.abs(mileagePct) >= 25
                ? "text-rose-600 dark:text-rose-300"
                : Math.abs(mileagePct) >= 12
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-emerald-600 dark:text-emerald-300";

            const intensityColor =
              hardRatio >= 0.55
                ? "text-rose-600 dark:text-rose-300"
                : hardRatio >= 0.4
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-emerald-600 dark:text-emerald-300";

            const recoveryColor =
              (sorenessCt ?? 0) >= 4
                ? "text-rose-600 dark:text-rose-300"
                : (sorenessCt ?? 0) >= 2
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-emerald-600 dark:text-emerald-300";

            const levelLabel = level === "high" ? "High" : level === "moderate" ? "Moderate" : "Low";
            const levelBadgeClass =
              level === "high"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                : level === "moderate"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";

            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Injury Risk</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${levelBadgeClass}`}>
                    {levelLabel}
                  </span>
                </div>

                <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full">
                  <div className={`flex-1 rounded-l-full transition-colors ${
                    level === "low" ? "bg-emerald-500" : "bg-emerald-200/60 dark:bg-emerald-500/20"
                  }`} />
                  <div className={`flex-1 transition-colors ${
                    level === "moderate" ? "bg-amber-400" : "bg-amber-200/60 dark:bg-amber-500/20"
                  }`} />
                  <div className={`flex-1 rounded-r-full transition-colors ${
                    level === "high" ? "bg-rose-500" : "bg-rose-200/60 dark:bg-rose-500/20"
                  }`} />
                </div>

                <dl className="mt-2 grid grid-cols-3 gap-1">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Mileage</dt>
                    <dd className={`text-xs font-semibold ${mileageColor}`}>{mileageLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Intensity</dt>
                    <dd className={`text-xs font-semibold ${intensityColor}`}>{intensityLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Recovery</dt>
                    <dd className={`text-xs font-semibold ${recoveryColor}`}>{recoveryLabel}</dd>
                  </div>
                </dl>

                {injuryRisk ? (
                  <>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">{injuryRisk.explanation}</p>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">{injuryRisk.recommendation}</p>
                  </>
                ) : null}
                {checkIn ? (
                  <p className={`mt-2 text-xs font-medium ${
                    checkIn.legs === "pain"
                      ? "text-rose-600 dark:text-rose-300"
                      : checkIn.legs === "tight" || checkIn.energy === "low"
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-emerald-600 dark:text-emerald-300"
                  }`}>
                    {checkIn.legs === "pain"
                      ? "\u26a0\ufe0f Leg pain reported \u2014 consider rest or easy effort today."
                      : checkIn.legs === "tight" && checkIn.energy === "low"
                        ? "Tight legs + low energy \u2014 prioritize recovery today."
                        : checkIn.legs === "tight"
                          ? "Legs feeling tight \u2014 warm up thoroughly before any intensity."
                          : checkIn.energy === "low"
                            ? "Low energy today \u2014 keep effort controlled."
                            : "Feeling good \u2014 cleared for today\u2019s plan."}
                  </p>
                ) : null}
              </>
            );
          })()}
      </article>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
          <a href="/runs" className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-300">
            View all
          </a>
        </div>
        <div className="space-y-2">
          {recentRuns.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300/70 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No runs yet. Add one from the Runs page.
            </p>
          ) : (
            recentRuns.map((run) => <RunCard key={run.id} run={run} compact />)
          )}
        </div>
      </section>

      <article className="rounded-xl border border-slate-200/70 bg-white/60 p-2.5 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Weekly Insights</h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">AI</span>
          </div>
          {checkIn ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Today: Legs{" "}
              <span className="font-semibold capitalize">{checkIn.legs}</span>
              {" "}&middot;{" "}
              Energy{" "}
              <span className="font-semibold capitalize">{checkIn.energy}</span>
            </p>
          ) : null}
          <ul className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200">
            {(weeklyInsights?.insights ?? []).slice(0, 6).map((insight) => {
              const parsed = parseWeeklyInsight(insight);

              return (
                <li key={insight} className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-start gap-2">
                    {parsed.tone ? (
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${WEEKLY_INSIGHT_STYLES[parsed.tone]}`}>
                        {parsed.tone}
                      </span>
                    ) : null}
                    <span className="leading-5 text-slate-700 dark:text-slate-200">{parsed.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {!weeklyInsights ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No insight available yet.</p> : null}
      </article>

      {aiCardError ? <p className="text-xs text-rose-600 dark:text-rose-300">{aiCardError}</p> : null}

      {showCheckInModal ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => { if (!checkInSuccess) setShowCheckInModal(false); }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-modal-title"
          >
            {checkInSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                  <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="4,12 9,17 20,6" />
                  </svg>
                </span>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Check-In Complete</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h3 id="checkin-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    How do you feel today?
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCheckInModal(false)}
                    className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Legs</p>
                    <div className="flex gap-2">
                      {(["good", "tight", "pain"] as LegFeeling[]).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setPendingLegs(opt)}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                            pendingLegs === opt
                              ? opt === "good"
                                ? "bg-emerald-500 text-white"
                                : opt === "tight"
                                  ? "bg-amber-400 text-white"
                                  : "bg-rose-500 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Energy</p>
                    <div className="flex gap-2">
                      {(["high", "medium", "low"] as EnergyLevel[]).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setPendingEnergy(opt)}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                            pendingEnergy === opt
                              ? opt === "high"
                                ? "bg-emerald-500 text-white"
                                : opt === "medium"
                                  ? "bg-amber-400 text-white"
                                  : "bg-rose-500 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitCheckIn}
                  disabled={!pendingLegs || !pendingEnergy}
                  className="mt-5 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Log check-in
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedTrendDay ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setSelectedTrendDay(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-trend-modal-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Logged runs</p>
                <h3 id="weekly-trend-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTrendDay.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrendDay(null)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selectedTrendDay.runs.map((run) => (
                <RunCard key={run.id} run={run} compact expandable />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
