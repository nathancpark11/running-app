"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useRunTrack } from "@/components/RunTrackProvider";
import type { RefinedMainSetPayload, RunLog, TrainingRecommendation } from "@/lib/types";

const REFINED_CACHE_KEY = "runtrack:refined-main-set-cache:v1";

type WorkoutSections = {
  warmUp: string;
  mainSet: string;
  coolDown: string;
};

type SimilarWorkoutStatus = "Completed" | "Faded" | "Struggled";

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseWorkoutSections(notes: string): WorkoutSections {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      warmUp: "Not provided",
      mainSet: "Not provided",
      coolDown: "Not provided",
    };
  }

  const capture = (label: "Warm Up" | "Main Set" | "Cool Down") => {
    const match = normalized.match(new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:Warm\\s*Up|Main\\s*Set|Cool\\s*Down)\\s*:?|$)`, "i"));
    const value = match?.[1]?.trim().replace(/^[:\-\s]+/, "");
    return value && value.length > 0 ? value : "Not provided";
  };

  return {
    warmUp: capture("Warm Up"),
    mainSet: capture("Main Set"),
    coolDown: capture("Cool Down"),
  };
}

function parseMainSetFromRun(run: RunLog): string {
  const notes = run.notes || run.structuredNotes?.notes || "";
  const sections = parseWorkoutSections(notes);
  if (sections.mainSet !== "Not provided") {
    return sections.mainSet;
  }
  return notes.trim() || "No structured main set in notes.";
}

function inferIntensityMinutes(run: RunLog): number | null {
  if (typeof run.treadmillPaceDurationMinutes === "number" && run.treadmillPaceDurationMinutes > 0) {
    const reps = typeof run.intervalCount === "number" && run.intervalCount > 0 ? run.intervalCount : 1;
    return Math.round(run.treadmillPaceDurationMinutes * reps);
  }

  const mainSet = parseMainSetFromRun(run);
  let total = 0;
  const repeatedMatches = [...mainSet.matchAll(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/gi)];
  for (const match of repeatedMatches) {
    const reps = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isFinite(reps) && Number.isFinite(minutes)) {
      total += reps * minutes;
    }
  }

  if (total > 0) {
    return Math.round(total);
  }

  const single = mainSet.match(/\b(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/i);
  if (single) {
    const minutes = Number(single[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      return Math.round(minutes);
    }
  }

  return null;
}

function inferSimilarWorkoutStatus(run: RunLog): SimilarWorkoutStatus {
  const planStatus = run.planCheck?.status;
  if (planStatus === "missed" || planStatus === "underperformed") {
    return "Struggled";
  }
  if (planStatus === "mostly_completed" || run.energyLevel <= 6 || run.soreness >= 5) {
    return "Faded";
  }
  return "Completed";
}

function buildWorkoutKey(workout: TrainingRecommendation): string {
  return `${workout.id}:${workout.date.slice(0, 10)}`;
}

function findInitialWorkout(recommendations: TrainingRecommendation[]): TrainingRecommendation | null {
  if (recommendations.length === 0) {
    return null;
  }

  const sorted = [...recommendations].sort((left, right) => +new Date(left.date) - +new Date(right.date));
  const now = new Date();
  const upcoming = sorted.find((item) => +new Date(item.date) >= +now);
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}

function statusBadgeClasses(status: RefinedMainSetPayload["status"]): string {
  switch (status) {
    case "progressed":
      return "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30";
    case "repeat_controlled":
      return "bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30";
    case "reduced":
      return "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30";
    case "caution":
      return "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30";
    default:
      return "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/30";
  }
}

function buildAiWorkoutText(payload: RefinedMainSetPayload): string {
  return [
    `${payload.mainSetTitle}: ${payload.recommendedMainSet.structure}`,
    `Speed: ${payload.recommendedMainSet.speedMph}`,
    `Recovery: ${payload.recommendedMainSet.recovery}`,
    `Work Time: ${payload.recommendedMainSet.totalMainSetWorkTime}`,
    `Effort: ${payload.recommendedMainSet.effort}`,
    `Cue: ${payload.recommendedMainSet.executionCue}`,
  ].join(" | ");
}

function intensityLabel(run: RunLog): string {
  const total = inferIntensityMinutes(run);
  return total ? `${total} min` : "Unknown";
}

function SkeletonCard() {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 shadow-[0_14px_50px_-28px_rgba(15,23,42,1)] md:p-5">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-700" />
      <div className="mt-4 h-9 w-full animate-pulse rounded-xl bg-slate-800" />
      <div className="mt-3 h-3 w-4/5 animate-pulse rounded bg-slate-700" />
      <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-slate-700" />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
      </div>
    </article>
  );
}

type RunGeneratorTabProps = {
  preselectedWorkoutId: string | null;
};

export function RunGeneratorTab({ preselectedWorkoutId }: RunGeneratorTabProps) {
  const router = useRouter();
  const {
    runs,
    trainingRecommendations,
    trainingPlanName,
    updateTrainingRecommendationAiCoachNote,
  } = useRunTrack();
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [cachedResults, setCachedResults] = useState<Record<string, RefinedMainSetPayload>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const sortedRecommendations = useMemo(
    () => [...trainingRecommendations].sort((left, right) => +new Date(left.date) - +new Date(right.date)),
    [trainingRecommendations]
  );

  const selectedWorkout = useMemo(() => {
    if (sortedRecommendations.length === 0) {
      return null;
    }

    const selected = selectedWorkoutId
      ? sortedRecommendations.find((item) => item.id === selectedWorkoutId)
      : null;

    return selected ?? findInitialWorkout(sortedRecommendations);
  }, [selectedWorkoutId, sortedRecommendations]);

  useEffect(() => {
    if (sortedRecommendations.length === 0) {
      setSelectedWorkoutId(null);
      return;
    }

    if (preselectedWorkoutId && sortedRecommendations.some((item) => item.id === preselectedWorkoutId)) {
      setSelectedWorkoutId(preselectedWorkoutId);
      return;
    }

    setSelectedWorkoutId((current) => {
      if (current && sortedRecommendations.some((item) => item.id === current)) {
        return current;
      }

      const initial = findInitialWorkout(sortedRecommendations);
      return initial?.id ?? null;
    });
  }, [sortedRecommendations, preselectedWorkoutId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(REFINED_CACHE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, RefinedMainSetPayload>;
      if (parsed && typeof parsed === "object") {
        setCachedResults(parsed);
      }
    } catch {
      // Ignore local cache parsing issues.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(REFINED_CACHE_KEY, JSON.stringify(cachedResults));
  }, [cachedResults]);

  const similarWorkouts = useMemo(() => {
    if (!selectedWorkout) {
      return [];
    }

    return [...runs]
      .filter((run) => run.runType === selectedWorkout.runType)
      .sort((left, right) => +new Date(right.date) - +new Date(left.date))
      .slice(0, 5);
  }, [runs, selectedWorkout]);

  const selectedWorkoutSections = useMemo(() => {
    return parseWorkoutSections(selectedWorkout?.notes ?? "");
  }, [selectedWorkout]);

  const workoutKey = selectedWorkout ? buildWorkoutKey(selectedWorkout) : "";
  const refinedResult = workoutKey ? cachedResults[workoutKey] ?? null : null;

  async function generateMainSet(withVariation: boolean) {
    if (!selectedWorkout) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setActionMessage("");

    const payload = {
      plannedWorkout: {
        id: selectedWorkout.id,
        date: selectedWorkout.date,
        title: selectedWorkout.title,
        runType: selectedWorkout.runType,
        surface: selectedWorkout.surface,
        totalDistanceMiles: selectedWorkout.distanceMiles ?? null,
        totalDurationMinutes: selectedWorkout.durationMinutes ?? null,
        speedRangeMph: selectedWorkout.targetPace ?? "Not specified",
        warmUp: selectedWorkoutSections.warmUp,
        mainSet: selectedWorkoutSections.mainSet,
        coolDown: selectedWorkoutSections.coolDown,
      },
      previousWorkouts: similarWorkouts.map((run) => ({
        id: run.id,
        date: run.date,
        runType: run.runType,
        structure: parseMainSetFromRun(run),
        totalMainSetWorkMinutes: inferIntensityMinutes(run),
        rpe: run.energyLevel,
        status: inferSimilarWorkoutStatus(run),
        notes: run.notes,
      })),
      context: {
        regenerate: withVariation,
        variationSeed: withVariation ? `${Date.now()}` : null,
        trainingPlanName,
        generatedAt: new Date().toISOString(),
      },
    };

    try {
      const response = await fetch("/api/refine-main-set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        payload?: RefinedMainSetPayload;
        error?: string;
      };

      if (!response.ok || !data.payload) {
        throw new Error(data.error || "Could not refine the main set.");
      }

      setCachedResults((prev) => ({
        ...prev,
        [workoutKey]: data.payload!,
      }));
      setActionMessage(withVariation ? "Generated a new variation." : "Refined main set generated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not refine the main set.");
    } finally {
      setIsGenerating(false);
    }
  }

  function useRefinedWorkout() {
    if (!selectedWorkout || !refinedResult) {
      return;
    }

    updateTrainingRecommendationAiCoachNote(selectedWorkout.id, `AI Coach: ${buildAiWorkoutText(refinedResult)}`);
    setActionMessage("AI Coach note saved to this planned workout.");
  }

  function saveToCalendar() {
    if (!selectedWorkout || !refinedResult) {
      return;
    }

    updateTrainingRecommendationAiCoachNote(selectedWorkout.id, `AI Coach: ${buildAiWorkoutText(refinedResult)}`);
    router.push("/calendar");
  }

  if (sortedRecommendations.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-linear-to-b from-[#0f172a] to-[#111827] p-5 text-slate-100 shadow-[0_20px_60px_-32px_rgba(15,23,42,1)]">
        <h2 className="text-lg font-semibold">Run Generator</h2>
        <p className="mt-2 text-sm text-slate-300">
          Upload a training plan in the Training Plan tab to generate a refined main set from your .ics workout.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 md:space-y-5">
      <article className="rounded-2xl border border-slate-700 bg-linear-to-b from-[#0b1c38] to-[#0f172a] p-4 text-slate-100 shadow-[0_20px_55px_-30px_rgba(30,64,175,0.65)] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-200/90">Planned Workout</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{selectedWorkout?.title || "Workout"}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {selectedWorkout?.runType} • {selectedWorkout?.distanceMiles ? `${selectedWorkout.distanceMiles.toFixed(1)} mi` : "Distance not set"} • {selectedWorkout?.durationMinutes ? `${Math.round(selectedWorkout.durationMinutes)} min` : "Duration not set"}
            </p>
          </div>
          <span className="rounded-full bg-slate-800/70 px-2.5 py-1 text-xs text-blue-100 ring-1 ring-blue-300/30">
            {selectedWorkout?.targetPace || "Speed range not set"}
          </span>
        </div>

        {sortedRecommendations.length > 1 ? (
          <label className="mt-4 block text-xs text-slate-300">
            Planned workout
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              value={selectedWorkout?.id || ""}
              onChange={(event) => {
                setSelectedWorkoutId(event.target.value);
                setActionMessage("");
                setErrorMessage("");
              }}
            >
              {sortedRecommendations.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateLabel(item.date)} • {item.runType}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-4 grid gap-2">
          <details className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">Warm-up (collapsed summary)</summary>
            <p className="mt-2 text-sm text-slate-300">{selectedWorkoutSections.warmUp}</p>
          </details>
          <div className="rounded-xl border border-blue-500/35 bg-blue-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-blue-200">Main Set (from .ics)</p>
            <p className="mt-1 text-base font-semibold text-white">{selectedWorkoutSections.mainSet}</p>
          </div>
          <details className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">Cool-down (collapsed)</summary>
            <p className="mt-2 text-sm text-slate-300">{selectedWorkoutSections.coolDown}</p>
          </details>
        </div>

        <button
          type="button"
          onClick={() => generateMainSet(false)}
          disabled={isGenerating}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Refining..." : "Refine Main Set"}
        </button>
      </article>

      <article className="rounded-2xl border border-slate-700 bg-slate-900/85 p-4 text-slate-100 shadow-[0_18px_45px_-32px_rgba(15,23,42,1)] md:p-5">
        <h3 className="text-base font-semibold text-white">Previous Similar Workouts</h3>
        <p className="mt-1 text-sm text-slate-300">Last 3-5 sessions of the same workout type.</p>

        <div className="mt-3 space-y-2.5">
          {similarWorkouts.length === 0 ? (
            <p className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
              No similar runs logged yet.
            </p>
          ) : (
            similarWorkouts.map((run) => (
              <article key={run.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">{formatDateLabel(run.date)}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                    {inferSimilarWorkoutStatus(run)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-200">{parseMainSetFromRun(run)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <p>Total time at intensity: {intensityLabel(run)}</p>
                  <p>RPE: {run.energyLevel || "N/A"}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      {isGenerating ? <SkeletonCard /> : null}

      {!isGenerating && refinedResult ? (
        <>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-slate-100 shadow-[0_16px_50px_-30px_rgba(15,23,42,1)] md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">Refined Main Set</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(refinedResult.status)}`}>
                {refinedResult.status}
              </span>
            </div>

            <p className="mt-2 text-lg font-semibold text-white">{refinedResult.mainSetTitle}</p>
            <p className="mt-2 rounded-xl border border-slate-600 bg-slate-950/75 px-3 py-3 text-lg font-bold text-blue-100">
              {refinedResult.recommendedMainSet.structure}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-200">
              <p className="rounded-lg bg-slate-800/80 p-2">Recovery: {refinedResult.recommendedMainSet.recovery}</p>
              <p className="rounded-lg bg-slate-800/80 p-2">Total work: {refinedResult.recommendedMainSet.totalMainSetWorkTime}</p>
              <p className="rounded-lg bg-slate-800/80 p-2">Effort: {refinedResult.recommendedMainSet.effort}</p>
              <p className="rounded-lg bg-slate-800/80 p-2">Cue: {refinedResult.recommendedMainSet.executionCue}</p>
            </div>

            <p className="mt-3 text-sm text-slate-300">{refinedResult.reasoningSummary}</p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-slate-100 shadow-[0_16px_50px_-32px_rgba(15,23,42,1)] md:p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Based on your previous run:</h4>
            <p className="mt-2 text-sm text-slate-200">Previous best: {refinedResult.comparisonToPrevious.previousBest}</p>
            <p className="mt-1 text-sm text-slate-200">What changed: {refinedResult.comparisonToPrevious.progression}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Risk level: {refinedResult.comparisonToPrevious.riskLevel}</p>

            <details className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">Fallback Option</summary>
              <p className="mt-2 text-sm text-slate-200">{refinedResult.fallbackOption.structure}</p>
              <p className="mt-1 text-xs text-slate-400">{refinedResult.fallbackOption.whenToUse}</p>
            </details>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={useRefinedWorkout}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Use This Workout
              </button>
              <button
                type="button"
                onClick={() => generateMainSet(true)}
                disabled={isGenerating}
                className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={saveToCalendar}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                Save to Calendar
              </button>
            </div>
          </article>
        </>
      ) : null}

      {errorMessage ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</p> : null}
      {actionMessage ? <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{actionMessage}</p> : null}
    </section>
  );
}
