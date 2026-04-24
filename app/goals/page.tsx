"use client";

import { useState } from "react";
import { ProgressCard } from "@/components/ProgressCard";
import { useRunTrack } from "@/components/RunTrackProvider";
import { isDateInCurrentMonth, isDateInCurrentWeek } from "@/lib/format";

export default function GoalsPage() {
  const { goals, runs, updateGoals } = useRunTrack();
  const [draft, setDraft] = useState(goals);

  const weeklyMiles = runs
    .filter((run) => isDateInCurrentWeek(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);
  const monthlyMiles = runs
    .filter((run) => isDateInCurrentMonth(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);
  const longRun = runs.reduce((max, run) => Math.max(max, run.distanceMiles), 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Goal Targets</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Weekly mileage goal</span>
            <input
              type="number"
              value={draft.weeklyMileage}
              min="0"
              onChange={(event) => setDraft((prev) => ({ ...prev, weeklyMileage: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Monthly mileage goal</span>
            <input
              type="number"
              value={draft.monthlyMileage}
              min="0"
              onChange={(event) => setDraft((prev) => ({ ...prev, monthlyMileage: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Long run goal</span>
            <input
              type="number"
              value={draft.longRunGoal}
              min="0"
              onChange={(event) => setDraft((prev) => ({ ...prev, longRunGoal: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => updateGoals(draft)}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Save Goals
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProgressCard title="Weekly Mileage" current={weeklyMiles} goal={goals.weeklyMileage} color="green" />
        <ProgressCard title="Monthly Mileage" current={monthlyMiles} goal={goals.monthlyMileage} color="blue" />
        <ProgressCard title="Long Run" current={longRun} goal={goals.longRunGoal} color="blue" />
      </section>
    </div>
  );
}
