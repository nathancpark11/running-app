import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  accent?: "blue" | "green" | "violet";
  icon: LucideIcon;
  helper?: string;
  compact?: boolean;
};

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
};

export function StatCard({ label, value, accent = "blue", icon: Icon, helper, compact = false }: StatCardProps) {
  if (compact) {
    return (
      <article className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 shadow-none backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center gap-2">
          <span className={`rounded-md p-1.5 ${accentClasses[accent]}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 md:mt-2 dark:text-slate-100">{value}</p>
          {helper ? <p className="mt-0.5 text-xs text-slate-500 md:mt-1 dark:text-slate-400">{helper}</p> : null}
        </div>
        <span className={`rounded-lg p-2 ${accentClasses[accent]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
