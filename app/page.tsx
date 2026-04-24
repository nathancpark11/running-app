"use client";

import { useEffect, useState } from "react";
import { Clock3, Gauge, Route, TrendingUp } from "lucide-react";
import { ProgressCard } from "@/components/ProgressCard";
import { RunCard } from "@/components/RunCard";
import { StatCard } from "@/components/StatCard";
import { useRunTrack } from "@/components/RunTrackProvider";
import { formatDuration, formatPace, isDateInCurrentWeek } from "@/lib/format";
import type { InjuryRiskPayload, TodayFocusPayload, WeeklyInsightsPayload } from "@/lib/types";

export default function DashboardPage() {
  const { runs, goals, trainingRecommendations, trainingPlanName } = useRunTrack();
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsightsPayload | null>(null);
  const [injuryRisk, setInjuryRisk] = useState<InjuryRiskPayload | null>(null);
  const [todayFocus, setTodayFocus] = useState<TodayFocusPayload | null>(null);
  const [aiCardError, setAiCardError] = useState("");

  const sortedRuns = [...runs].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const recentRuns = sortedRuns.slice(0, 3);
  const lastRun = sortedRuns[0];

  const totalMiles = runs.reduce((sum, run) => sum + run.distanceMiles, 0);
  const totalMinutes = runs.reduce((sum, run) => sum + run.durationMinutes, 0);
  const averagePace = runs.length ? runs.reduce((sum, run) => sum + run.paceMinPerMile, 0) / runs.length : 0;

  const weeklyMiles = runs
    .filter((run) => isDateInCurrentWeek(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);

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

  const weeklyDelta = weeklyGoalTarget > 0 ? weeklyMiles - weeklyGoalTarget : weeklyMiles;
  const weeklyTrendLabel =
    weeklyDelta >= 0
      ? `+${weeklyDelta.toFixed(1)} mi vs target`
      : `${Math.abs(weeklyDelta).toFixed(1)} mi to target`;

  useEffect(() => {
    let canceled = false;

    async function loadAiCards() {
      setAiCardError("");

      try {
        const [weeklyRes, injuryRes, focusRes] = await Promise.all([
          fetch("/api/ai/weekly-insights", { cache: "no-store" }),
          fetch("/api/ai/injury-risk", { cache: "no-store" }),
          fetch("/api/ai/today-focus", { cache: "no-store" }),
        ]);

        const [weeklyData, injuryData, focusData] = (await Promise.all([
          weeklyRes.json(),
          injuryRes.json(),
          focusRes.json(),
        ])) as [
          { payload?: WeeklyInsightsPayload; error?: string },
          { payload?: InjuryRiskPayload; error?: string },
          { payload?: TodayFocusPayload; error?: string }
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
  }, []);

  return (
    <div className="space-y-3">
      <article className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2.5 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {todaysRecommendation ? "Run on deck" : "No run today"}
          </p>
          {trainingPlanName ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{trainingPlanName}</p> : null}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {todaysRecommendation
            ? `${todaysRecommendation.title} • ${todaysRecommendation.runType}`
            : nextRecommendation
              ? `Next: ${nextRecommendation.title} (${nextRecommendationDay.slice(0, 3)})`
              : "Next: Recovery Day"}
        </p>
        {todayFocus?.tip ? <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-200">Today&apos;s focus: {todayFocus.tip}</p> : null}
      </article>

      <section className="grid grid-cols-2 gap-2.5">
        <StatCard label="Miles" value={`${totalMiles.toFixed(1)} mi`} icon={Route} accent="blue" compact />
        <StatCard label="Runs" value={`${runs.length}`} icon={TrendingUp} accent="green" compact />
        <StatCard label="Avg Pace" value={runs.length ? formatPace(averagePace) : "0:00/mi"} icon={Gauge} accent="violet" compact />
        <StatCard label="Time" value={formatDuration(totalMinutes)} icon={Clock3} accent="blue" compact />
      </section>

      <ProgressCard
        title={usingPlanForWeeklyGoal ? "Weekly plan" : "Weekly goal"}
        current={weeklyMiles}
        goal={weeklyGoalTarget}
        color="green"
        compact
      />

      {lastRun ? (
        <article className="rounded-xl border border-slate-200/70 bg-white/60 p-3 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Last Run Summary</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lastRun.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(lastRun.date).toLocaleDateString()}</p>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {lastRun.distanceMiles.toFixed(1)} mi • {formatPace(lastRun.paceMinPerMile)} • {formatDuration(lastRun.durationMinutes)}
          </p>
        </article>
      ) : null}

      <article className="rounded-xl border border-slate-200/70 bg-white/60 p-3 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Weekly Snapshot</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{weeklyTrendLabel}</p>
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="h-3 w-1.5 rounded bg-emerald-500/80" />
          <span className="h-5 w-1.5 rounded bg-emerald-500/70" />
          <span className="h-2 w-1.5 rounded bg-emerald-500/70" />
          <span className="h-6 w-1.5 rounded bg-emerald-500/90" />
          <span className="h-4 w-1.5 rounded bg-emerald-500/70" />
          <span className="h-7 w-1.5 rounded bg-emerald-500/90" />
          <span className="h-3 w-1.5 rounded bg-emerald-500/70" />
        </div>
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
            <p className="rounded-xl border border-dashed border-slate-300/70 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No runs yet. Add one from the Runs page.
            </p>
          ) : (
            recentRuns.map((run) => <RunCard key={run.id} run={run} compact />)
          )}
        </div>
      </section>

      <section className="grid gap-2.5 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200/70 bg-white/60 p-3 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Weekly Insights</h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">AI</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
            {(weeklyInsights?.insights ?? []).slice(0, 5).map((insight) => (
              <li key={insight}>• {insight}</li>
            ))}
          </ul>
          {!weeklyInsights ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No insight available yet.</p> : null}
        </article>

        <article className="rounded-xl border border-slate-200/70 bg-white/60 p-3 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Injury Risk</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                injuryRisk?.riskLevel === "high"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                  : injuryRisk?.riskLevel === "moderate"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
              }`}
            >
              {injuryRisk?.riskLevel ?? "low"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">{injuryRisk?.explanation ?? "No injury risk signal yet."}</p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">{injuryRisk?.recommendation ?? ""}</p>
        </article>
      </section>

      {aiCardError ? <p className="text-xs text-rose-600 dark:text-rose-300">{aiCardError}</p> : null}
    </div>
  );
}
