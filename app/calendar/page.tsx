"use client";

import { useMemo, useState } from "react";
import { useRunTrack } from "@/components/RunTrackProvider";
import { formatDuration, formatPace } from "@/lib/format";

type WorkoutSection = {
  label: "Warm Up" | "Main Set" | "Cool Down";
  content: string;
};

function normalizeWorkoutSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingPeriods = trimmed.replace(/\.(?=\s|$)/g, "");
  return withoutTrailingPeriods.charAt(0).toUpperCase() + withoutTrailingPeriods.slice(1);
}

function parseWorkoutSections(notes: string): WorkoutSection[] {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const withoutMilesPreface = normalized.replace(/^\s*\d+(?:\.\d+)?\s*(?:mi|mile|miles)\s+total\.?\s*/i, "");

  const sectionRegex = /(Warm\s*Up|Main\s*Set|Cool\s*Down)\s*:??\s*/gi;
  const matches = [...withoutMilesPreface.matchAll(sectionRegex)];

  if (matches.length === 0) {
    return [];
  }

  const sections: WorkoutSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? withoutMilesPreface.length;
    const rawHeading = (match[1] ?? "").toLowerCase().replace(/\s+/g, "");
    const content = normalizeWorkoutSentence(withoutMilesPreface.slice(start, end).trim().replace(/^[:\-\s]+/, ""));

    if (!content) {
      continue;
    }

    const label: WorkoutSection["label"] =
      rawHeading === "warmup" ? "Warm Up" : rawHeading === "mainset" ? "Main Set" : "Cool Down";
    sections.push({ label, content });
  }

  return sections;
}

function keyForDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarPage() {
  const { runs, trainingRecommendations } = useRunTrack();
  const todayKey = keyForDate(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset + weekOffset * 7);

    return Array.from({ length: 7 }, (_, index) =>
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    );
  }, [weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const start = currentWeekDays[0];
    const end = currentWeekDays[currentWeekDays.length - 1];

    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString(undefined, {
        month: "long",
      })} ${start.getDate()}\u2013${end.getDate()}, ${end.getFullYear()}`;
    }

    return `${start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} \u2013 ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, [currentWeekDays]);

  const monthDays = useMemo(() => {
    if (view !== "month") return [];
    const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const firstDayOffset = (monthStart.getDay() + 6) % 7;
    const days: Array<Date | null> = [];
    for (let i = 0; i < firstDayOffset; i += 1) days.push(null);
    for (let d = 1; d <= monthEnd.getDate(); d += 1) {
      days.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d));
    }
    return days;
  }, [view, displayMonth]);

  const runsByDate = useMemo(() => {
    const map = new Map<string, typeof runs>();
    runs.forEach((run) => {
      const key = run.date.slice(0, 10);
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, run]);
    });
    return map;
  }, [runs]);

  const recommendationsByDate = useMemo(() => {
    const map = new Map<string, typeof trainingRecommendations>();
    trainingRecommendations.forEach((recommendation) => {
      const key = recommendation.date.slice(0, 10);
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, recommendation]);
    });
    return map;
  }, [trainingRecommendations]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            {view === "week" ? (
              <>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {weekOffset === 0 ? "Current week" : weekOffset < 0 ? `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? "s" : ""} ago` : `${weekOffset} week${weekOffset > 1 ? "s" : ""} ahead`}
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{weekRangeLabel}</h2>
              </>
            ) : (
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {displayMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                view === "week"
                  ? setWeekOffset((prev) => prev - 1)
                  : setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={view === "week" ? "Previous week" : "Previous month"}
            >
              <span aria-hidden="true">&larr;</span>
            </button>
            <button
              type="button"
              onClick={() =>
                view === "week"
                  ? setWeekOffset((prev) => prev + 1)
                  : setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={view === "week" ? "Next week" : "Next month"}
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden dark:border-slate-700">
              <button
                type="button"
                onClick={() => setView("week")}
                className={`px-3 py-1 text-xs font-medium transition ${
                  view === "week"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-3 py-1 text-xs font-medium transition ${
                  view === "month"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {view === "month" ? (
          <>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-slate-50 dark:bg-slate-800/40" />;
                }
                const key = keyForDate(day);
                const dayRuns = runsByDate.get(key) ?? [];
                const dayRecommendations = recommendationsByDate.get(key) ?? [];
                const isToday = key === todayKey;
                const hasCompletedRun = dayRuns.length > 0;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={`h-20 rounded-xl border p-2 text-left transition hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-400/60 ${
                      hasCompletedRun
                        ? "border-emerald-300 bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                        : isToday
                        ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{day.getDate()}</p>
                    {dayRuns.length > 0 ? (
                      <p className="mt-1 truncate rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                        {dayRuns[0].title}
                      </p>
                    ) : null}
                    {dayRecommendations.length > 0 ? (
                      <p className="mt-1 truncate rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                        {dayRecommendations[0].title}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {view === "week" ? null : null}{/* week grid rendered below when view===week */}

        <div className={view === "week" ? "mt-4 grid gap-3 lg:grid-cols-7 md:grid-cols-2" : "hidden"}>
          {currentWeekDays.map((day) => {
            const key = keyForDate(day);
            const dayRuns = runsByDate.get(key) ?? [];
            const dayRecommendations = recommendationsByDate.get(key) ?? [];
            const isToday = key === todayKey;
            const hasCompletedRun = dayRuns.length > 0;

            return (
              <article
                key={key}
                className={`rounded-xl border p-2.5 min-h-40 space-y-2.5 md:p-3 md:min-h-56 md:space-y-3 lg:min-h-72 ${
                  hasCompletedRun
                    ? "border-emerald-300 bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                    : isToday
                    ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>

                {dayRuns.length > 0 ? (
                  <p className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    {dayRuns.length} logged run{dayRuns.length > 1 ? "s" : ""}
                  </p>
                ) : null}
                {dayRecommendations.length > 0 ? (
                  <p className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    {dayRecommendations.length} planned workout{dayRecommendations.length > 1 ? "s" : ""}
                  </p>
                ) : null}

                {dayRecommendations.length > 0 ? (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    Planned workout
                  </p>
                  <div className="mt-2 space-y-2">
                      {dayRecommendations.map((recommendation) => {
                        const noteSections = recommendation.notes
                          ? parseWorkoutSections(recommendation.notes)
                          : [];

                        return (
                          <article
                            key={recommendation.id}
                            className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {recommendation.runType}
                            </p>
                            {recommendation.distanceMiles ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Distance: {recommendation.distanceMiles} mi
                              </p>
                            ) : null}
                            {recommendation.durationMinutes ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Duration:{" "}
                                {formatDuration(
                                  recommendation.durationMinutes,
                                  recommendation.runType === "Long" || recommendation.runType === "Race"
                                )}
                              </p>
                            ) : null}
                            {noteSections.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {noteSections.map((section) => (
                                  <div key={`${recommendation.id}-${section.label}`}>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                                      {section.label}
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                      {section.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : recommendation.notes ? (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {normalizeWorkoutSentence(recommendation.notes)}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                </section>
                ) : null}

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                    Logged runs
                  </p>
                  {dayRuns.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {dayRuns.map((run) => (
                        <article
                          key={run.id}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{run.title}</p>
                          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                            {run.runType} &middot; {run.surface} &middot; {run.distanceMiles} mi
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}{" "}
                            &middot; {formatPace(run.paceMinPerMile)}
                          </p>
                          {run.notes ? (
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{run.notes}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No runs logged for this day.</p>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      </section>

      {selectedDate && view === "month" ? (() => {
        const selectedKey = keyForDate(selectedDate);
        const modalRuns = runsByDate.get(selectedKey) ?? [];
        const modalRecommendations = recommendationsByDate.get(selectedKey) ?? [];
        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => setSelectedDate(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-modal-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Workout details</p>
                  <h3 id="calendar-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {modalRecommendations.length > 0 ? (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Planned workout</p>
                  <div className="mt-2 space-y-2">
                      {modalRecommendations.map((recommendation) => {
                        const noteSections = recommendation.notes ? parseWorkoutSections(recommendation.notes) : [];
                        return (
                          <article
                            key={recommendation.id}
                            className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{recommendation.runType}</p>
                            {recommendation.distanceMiles ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Distance: {recommendation.distanceMiles} mi</p>
                            ) : null}
                            {recommendation.durationMinutes ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Duration:{" "}
                                {formatDuration(
                                  recommendation.durationMinutes,
                                  recommendation.runType === "Long" || recommendation.runType === "Race"
                                )}
                              </p>
                            ) : null}
                            {noteSections.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {noteSections.map((section) => (
                                  <div key={`${recommendation.id}-${section.label}`}>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                                      {section.label}
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{section.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : recommendation.notes ? (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {normalizeWorkoutSentence(recommendation.notes)}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                </section>
                ) : null}

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Logged runs</p>
                  {modalRuns.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {modalRuns.map((run) => (
                        <article
                          key={run.id}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{run.title}</p>
                          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                            {run.runType} &middot; {run.surface} &middot; {run.distanceMiles} mi
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}{" "}
                            &middot; {formatPace(run.paceMinPerMile)}
                          </p>
                          {run.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{run.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No runs logged for this day.</p>
                  )}
                </section>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
