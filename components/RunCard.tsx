import { ChevronDown, Timer } from "lucide-react";
import type { RunLog, RunType } from "@/lib/types";
import { formatDateTime, formatDuration, formatPace } from "@/lib/format";

type RunCardProps = {
  run: RunLog;
  onEdit?: (run: RunLog) => void;
  onRegenerateSummary?: (run: RunLog) => void;
  isRegeneratingSummary?: boolean;
  compact?: boolean;
  expandable?: boolean;
};

const runTypeBadgeClasses: Record<RunType, string> = {
  Easy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  Long: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  Endurance: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  Tempo: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  Recovery: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200",
  Intervals: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  Hills: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  Hike: "bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-200",
  Race: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
};

const runTypeCardClasses: Record<RunType, string> = {
  Easy: "border-emerald-200/70 dark:border-emerald-500/30",
  Long: "border-indigo-200/70 dark:border-indigo-500/30",
  Endurance: "border-sky-200/70 dark:border-sky-500/30",
  Tempo: "border-amber-200/70 dark:border-amber-500/30",
  Recovery: "border-cyan-200/70 dark:border-cyan-500/30",
  Intervals: "border-rose-200/70 dark:border-rose-500/30",
  Hills: "border-orange-200/70 dark:border-orange-500/30",
  Hike: "border-lime-200/70 dark:border-lime-500/30",
  Race: "border-fuchsia-200/70 dark:border-fuchsia-500/30",
};

export function RunCard({
  run,
  onEdit,
  onRegenerateSummary,
  isRegeneratingSummary = false,
  compact = false,
  expandable = false,
}: RunCardProps) {
  const badgeClass = runTypeBadgeClasses[run.runType];
  const cardBorderClass = runTypeCardClasses[run.runType];
  const garminMetrics = [
    typeof run.heartRateBpm === "number" && run.heartRateBpm > 0 ? `HR ${run.heartRateBpm} bpm` : null,
    typeof run.caloriesBurned === "number" && run.caloriesBurned > 0 ? `${run.caloriesBurned} cal` : null,
    run.primaryBenefitEvaluation?.trim() ? run.primaryBenefitEvaluation.trim() : null,
  ].filter((item): item is string => Boolean(item));

  if (compact && expandable) {
    return (
      <details className={`group rounded-xl border bg-white/65 shadow-none backdrop-blur-sm dark:bg-slate-900/70 ${cardBorderClass}`}>
        <summary className="list-none cursor-pointer px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{run.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(run.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badgeClass}`}>
                {run.runType}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-1.5 dark:border-slate-800">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Distance</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{run.distanceMiles.toFixed(2)} mi</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Pace</p>
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">{formatPace(run.paceMinPerMile)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Time</p>
              <p className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Timer className="h-3.5 w-3.5 text-slate-400" />
                {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}
              </p>
            </div>
          </div>
        </summary>

        <div className="border-t border-slate-200/70 px-3 pb-2.5 pt-2 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Energy / Soreness</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {run.energyLevel} · {run.soreness}
              </p>
            </div>
            {run.treadmillPace && run.treadmillPaceDurationMinutes ? (
              <p className="text-xs font-medium text-violet-600 dark:text-violet-300">
                {run.surface === "Outdoor" ? "Pace" : "Treadmill pace"}: {run.treadmillPace}
                {run.surface === "Outdoor" ? "" : " mph"} for {run.treadmillPaceDurationMinutes} min
              </p>
            ) : null}
          </div>

          {run.intervalCount && run.restTimeMinutes ? (
            <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">
              Intervals: {run.intervalCount} with {run.restTimeMinutes} min rest
            </p>
          ) : null}

          {garminMetrics.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {garminMetrics.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {run.notes.trim().length > 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{run.notes}</p>
          ) : null}

          {run.aiSummary ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              {run.aiSummary}
            </p>
          ) : null}

          {onEdit || onRegenerateSummary ? (
            <div className="mt-3 flex justify-end gap-2">
              {onRegenerateSummary ? (
                <button
                  type="button"
                  onClick={() => onRegenerateSummary(run)}
                  disabled={isRegeneratingSummary}
                  className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                >
                  {isRegeneratingSummary ? "Regenerating..." : run.aiSummary ? "Regenerate Summary" : "Generate Summary"}
                </button>
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(run)}
                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                >
                  Edit
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
    );
  }

  if (compact) {
    return (
      <article className={`rounded-xl border bg-white/65 px-3 py-2.5 shadow-none backdrop-blur-sm dark:bg-slate-900/70 ${cardBorderClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{run.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(run.date)}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badgeClass}`}>
            {run.runType}
          </span>
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-1.5 dark:border-slate-800">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Distance</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{run.distanceMiles.toFixed(2)} mi</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Pace</p>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-300">{formatPace(run.paceMinPerMile)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Time</p>
            <p className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Timer className="h-3.5 w-3.5 text-slate-400" />
              {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm md:p-5 dark:bg-slate-900 ${cardBorderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{run.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(run.date)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
          {run.runType}
        </span>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-4 md:mt-4">
        <div>
          <p className="text-xs text-slate-500">Distance</p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{run.distanceMiles.toFixed(2)} mi</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Pace</p>
          <p className="text-base font-semibold text-violet-600 dark:text-violet-300">{formatPace(run.paceMinPerMile)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Time</p>
          <p className="flex items-center gap-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Timer className="h-4 w-4 text-slate-400" />
            {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Energy / Soreness</p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {run.energyLevel} · {run.soreness}
          </p>
        </div>
      </div>

      {garminMetrics.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {garminMetrics.map((item) => (
            <span
              key={item}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 md:mt-4">
        <div>
          {run.notes.trim().length > 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{run.notes}</p>
          ) : null}
          {run.aiSummary ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              {run.aiSummary}
            </p>
          ) : null}
          {run.treadmillPace && run.treadmillPaceDurationMinutes ? (
            <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-300">
              {run.surface === "Outdoor" ? "Pace" : "Treadmill pace"}: {run.treadmillPace}
              {run.surface === "Outdoor" ? "" : " mph"} for {run.treadmillPaceDurationMinutes} min
            </p>
          ) : null}
          {run.intervalCount && run.restTimeMinutes ? (
            <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              Intervals: {run.intervalCount} with {run.restTimeMinutes} min rest
            </p>
          ) : null}
        </div>
      </div>

      {onEdit || onRegenerateSummary ? (
        <div className="mt-3.5 flex justify-end gap-2 md:mt-4">
          {onRegenerateSummary ? (
            <button
              type="button"
              onClick={() => onRegenerateSummary(run)}
              disabled={isRegeneratingSummary}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              {isRegeneratingSummary ? "Regenerating..." : run.aiSummary ? "Regenerate Summary" : "Generate Summary"}
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(run)}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
