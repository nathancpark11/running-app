"use client";

import { useEffect, useState } from "react";
import { StretchTimer } from "@/components/StretchTimer";
import { useRunTrack } from "@/components/RunTrackProvider";
import type { StretchRecommendationPayload } from "@/lib/types";

export default function StretchTimerPage() {
  const { routines, updateRoutines } = useRunTrack();
  const [routineName, setRoutineName] = useState("");
  const [recommendation, setRecommendation] = useState<StretchRecommendationPayload | null>(null);
  const [recommendationError, setRecommendationError] = useState("");

  useEffect(() => {
    let canceled = false;

    async function loadRecommendation() {
      setRecommendationError("");
      try {
        const response = await fetch("/api/ai/stretch-recommendations", { cache: "no-store" });
        const data = (await response.json()) as { payload?: StretchRecommendationPayload; error?: string };

        if (canceled) {
          return;
        }

        if (response.ok && data.payload) {
          setRecommendation(data.payload);
          return;
        }

        setRecommendationError(data.error ?? "Could not load recommendation.");
      } catch {
        if (!canceled) {
          setRecommendationError("Could not load recommendation.");
        }
      }
    }

    void loadRecommendation();

    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <article className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">Recommended Focus</p>
        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{recommendation?.focus ?? "Load your latest run data to get a suggestion."}</p>
        {recommendation?.reason ? <p className="mt-1 text-xs text-blue-700 dark:text-blue-100">{recommendation.reason}</p> : null}
        {recommendationError ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{recommendationError}</p> : null}
      </article>

      <StretchTimer routines={routines} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Routine Builder (Scaffold)</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Full routine editing will be expanded later. You can already create named routine placeholders.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={routineName}
            onChange={(event) => setRoutineName(event.target.value)}
            placeholder="New routine name"
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={() => {
              if (!routineName.trim()) {
                return;
              }
              updateRoutines([
                ...routines,
                {
                  id: crypto.randomUUID(),
                  name: routineName.trim(),
                  items: [],
                },
              ]);
              setRoutineName("");
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add Routine
          </button>
        </div>
      </section>
    </div>
  );
}
