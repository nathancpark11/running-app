import { Timer } from "lucide-react";
import type { RunLog } from "@/lib/types";
import { formatDateTime, formatDuration, formatPace } from "@/lib/format";

type RunCardProps = {
  run: RunLog;
  onEdit?: (run: RunLog) => void;
  onRegenerateSummary?: (run: RunLog) => void;
  isRegeneratingSummary?: boolean;
  compact?: boolean;
};

export function RunCard({
  run,
  onEdit,
  onRegenerateSummary,
  isRegeneratingSummary = false,
  compact = false,
}: RunCardProps) {
  if (compact) {
    return (
      <article className="rounded-xl border border-slate-200/70 bg-white/65 px-3 py-3 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{run.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(run.date)}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
            {run.runType}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-800">
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{run.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(run.date)}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
          {run.runType}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
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

      <div className="mt-4">
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
        <div className="mt-4 flex justify-end gap-2">
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
