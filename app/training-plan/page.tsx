"use client";

import { IcsImportCard } from "@/components/IcsImportCard";
import { useRunTrack } from "@/components/RunTrackProvider";

export default function TrainingPlanPage() {
  const { replaceTrainingRecommendations, clearTrainingPlan, trainingRecommendations, trainingPlanName } = useRunTrack();

  return (
    <div className="space-y-5">
      <IcsImportCard
        onImportRecommendations={async (planName, recommendations) => {
          await replaceTrainingRecommendations(planName, recommendations);
        }}
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Active Training Plan</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Plan name: {trainingPlanName ?? "None"}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Planned workouts: {trainingRecommendations.length}
        </p>

        <button
          type="button"
          onClick={() => clearTrainingPlan()}
          disabled={!trainingPlanName && trainingRecommendations.length === 0}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          Delete Uploaded Plan
        </button>
      </article>
    </div>
  );
}
