"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { parseIcsToTrainingRecommendations } from "@/lib/icsImport";
import type { ImportConflictStrategy, TrainingRecommendation } from "@/lib/types";

const ICS_TEMPLATE_PATH = "/references/training-plan-template.ics";

type RecommendationDraft = Omit<TrainingRecommendation, "id">;

type IcsImportCardProps = {
  existingWorkoutDateKeys: string[];
  completedDateKeys: string[];
  existingPlanName: string | null;
  onImportRecommendations: (
    planName: string,
    recommendations: RecommendationDraft[],
    strategy: ImportConflictStrategy
  ) => Promise<void>;
};

export function IcsImportCard({
  existingWorkoutDateKeys,
  completedDateKeys,
  existingPlanName,
  onImportRecommendations,
}: IcsImportCardProps) {
  const [draftRecommendations, setDraftRecommendations] = useState<RecommendationDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [planName, setPlanName] = useState("");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importStrategy, setImportStrategy] = useState<ImportConflictStrategy>("override");

  const overlapSummary = useMemo(() => {
    if (draftRecommendations.length === 0) {
      return { overlapCount: 0, completedOverlapCount: 0 };
    }

    const existing = new Set(existingWorkoutDateKeys);
    const completed = new Set(completedDateKeys);
    const incomingDateKeys = new Set(draftRecommendations.map((item) => item.date.slice(0, 10)));

    let overlapCount = 0;
    let completedOverlapCount = 0;

    for (const key of incomingDateKeys) {
      if (existing.has(key)) {
        overlapCount += 1;
      }
      if (completed.has(key)) {
        completedOverlapCount += 1;
      }
    }

    return { overlapCount, completedOverlapCount };
  }, [completedDateKeys, draftRecommendations, existingWorkoutDateKeys]);

  const isUpdatingExistingPlan = Boolean(existingPlanName?.trim().length) && overlapSummary.overlapCount > 0;
  const effectivePlanName = isUpdatingExistingPlan ? (existingPlanName ?? "") : planName.trim();
  const canImport = draftRecommendations.length > 0 && effectivePlanName.length > 0;

  const previewText = useMemo(() => {
    if (draftRecommendations.length === 0) {
      return "No file parsed yet.";
    }
    return `${draftRecommendations.length} planned workout${draftRecommendations.length > 1 ? "s" : ""} ready.`;
  }, [draftRecommendations.length]);

  async function handleFileSelect(file: File | undefined) {
    setError("");
    setDraftRecommendations([]);

    if (!file) {
      setFileName("");
      return;
    }

    setFileName(file.name);

    try {
      const content = await file.text();
      const parsed = parseIcsToTrainingRecommendations(content);
      setDraftRecommendations(parsed);
      if (parsed.length === 0) {
        setError("No VEVENT blocks were found in this .ics file.");
      }
    } catch {
      setError("Could not parse this .ics file.");
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import Training Plan (.ics)</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Upload an exported training calendar to create recommended workouts.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <Upload className="h-4 w-4" />
          Choose .ics File
          <input
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(event) => handleFileSelect(event.target.files?.[0])}
          />
        </label>
        <a
          href={ICS_TEMPLATE_PATH}
          download
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Download Template
        </a>
        {fileName ? <span className="text-sm text-slate-600 dark:text-slate-300">{fileName}</span> : null}
      </div>

      {isUpdatingExistingPlan ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-slate-700 dark:text-slate-200">
            Updating current plan: <span className="font-semibold">{existingPlanName}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Plan name will stay the same for this update.
          </p>
        </div>
      ) : (
        <label className="mt-4 block space-y-1 text-sm">
          <span className="text-slate-600 dark:text-slate-300">Training Plan Name</span>
          <input
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            placeholder="Ultra Build Block"
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      )}

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{previewText}</p>
      {overlapSummary.overlapCount > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-900/20">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {overlapSummary.overlapCount} day{overlapSummary.overlapCount === 1 ? "" : "s"} overlap existing planned workouts.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-amber-900 dark:text-amber-100">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="import-strategy"
                value="override"
                checked={importStrategy === "override"}
                onChange={() => setImportStrategy("override")}
              />
              Override overlapping period
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="import-strategy"
                value="merge"
                checked={importStrategy === "merge"}
                onChange={() => setImportStrategy("merge")}
              />
              Merge with existing workouts
            </label>
          </div>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
            Completed dates are always preserved and are never modified.
          </p>
        </div>
      ) : null}
      {overlapSummary.completedOverlapCount > 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
          {overlapSummary.completedOverlapCount} imported day{overlapSummary.completedOverlapCount === 1 ? "" : "s"} match completed dates and will be skipped.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <div className="sticky bottom-(--mobile-nav-offset) mt-4 -mx-5 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur supports-backdrop-filter:bg-white/80 dark:border-slate-700 dark:bg-slate-900/95 dark:supports-backdrop-filter:bg-slate-900/80 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
        <button
          type="button"
          disabled={!canImport || saveState === "saving"}
          onClick={async () => {
            setSaveState("saving");
            try {
              await onImportRecommendations(effectivePlanName, draftRecommendations, importStrategy);
              setDraftRecommendations([]);
              setFileName("");
              setPlanName("");
              setError("");
              setSaveState("saved");
            } catch {
              setSaveState("error");
            }
          }}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 md:mt-4 md:w-auto"
        >
          {saveState === "saving" ? "Saving…" : "Save Training Plan"}
        </button>
        {saveState === "saved" ? (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">Training plan saved.</p>
        ) : null}
        {saveState === "error" ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Failed to save — check your connection or try signing out and back in.
          </p>
        ) : null}
      </div>
    </article>
  );
}
