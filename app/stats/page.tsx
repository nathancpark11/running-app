"use client";

import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import { useRunTrack } from "@/components/RunTrackProvider";
import { formatPace, isDateInCurrentMonth, isDateInCurrentWeek } from "@/lib/format";
import { Activity, Gauge, Route, TrendingUp } from "lucide-react";

export default function StatsPage() {
  const { runs } = useRunTrack();

  const milesThisWeek = runs
    .filter((run) => isDateInCurrentWeek(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);

  const milesThisMonth = runs
    .filter((run) => isDateInCurrentMonth(run.date))
    .reduce((sum, run) => sum + run.distanceMiles, 0);

  const longestRun = runs.reduce((max, run) => Math.max(max, run.distanceMiles), 0);
  const fastestPace = runs.length ? Math.min(...runs.map((run) => run.paceMinPerMile)) : 0;

  const weeklySeries = useMemo(() => {
    const buckets: { label: string; miles: number }[] = [];
    const now = new Date();

    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      const day = start.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const miles = runs
        .filter((run) => {
          const date = new Date(run.date);
          return date >= start && date < end;
        })
        .reduce((sum, run) => sum + run.distanceMiles, 0);

      buckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        miles,
      });
    }

    return buckets;
  }, [runs]);

  const averageWeeklyMileage =
    weeklySeries.length > 0
      ? weeklySeries.reduce((sum, bucket) => sum + bucket.miles, 0) / weeklySeries.length
      : 0;

  const chartMax = Math.max(1, ...weeklySeries.map((item) => item.miles));

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Miles This Week" value={`${milesThisWeek.toFixed(1)} mi`} icon={Route} accent="green" />
        <StatCard label="Miles This Month" value={`${milesThisMonth.toFixed(1)} mi`} icon={TrendingUp} accent="blue" />
        <StatCard label="Longest Run" value={`${longestRun.toFixed(1)} mi`} icon={Activity} accent="blue" />
        <StatCard
          label="Fastest Pace"
          value={runs.length ? formatPace(fastestPace) : "0:00/mi"}
          icon={Gauge}
          accent="violet"
        />
        <StatCard
          label="Avg Weekly Mileage"
          value={`${averageWeeklyMileage.toFixed(1)} mi`}
          icon={Route}
          accent="green"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Weekly Mileage Trend</h2>
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {weeklySeries.map((bucket) => (
            <div key={bucket.label} className="flex flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
                <div
                  className="w-full rounded bg-blue-500"
                  style={{ height: `${Math.max(6, (bucket.miles / chartMax) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{bucket.label}</p>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{bucket.miles.toFixed(1)} mi</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
