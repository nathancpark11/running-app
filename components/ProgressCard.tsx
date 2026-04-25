type ProgressCardProps = {
  title: string;
  current: number;
  goal: number;
  unit?: string;
  color?: "blue" | "green";
  compact?: boolean;
};

export function ProgressCard({ title, current, goal, unit = "mi", color = "blue", compact = false }: ProgressCardProps) {
  const progress = goal <= 0 ? 0 : Math.min(100, Math.round((current / goal) * 100));
  const barColor = color === "green" ? "bg-emerald-500" : "bg-blue-500";

  if (compact) {
    return (
      <article className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{title}</h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {current.toFixed(1)} / {goal} {unit} • {progress}%
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2.5 flex items-center justify-between md:mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</h3>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{progress}%</p>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2.5 text-sm text-slate-600 md:mt-3 dark:text-slate-300">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{current.toFixed(1)} {unit}</span> of {goal} {unit}
      </p>
    </article>
  );
}
