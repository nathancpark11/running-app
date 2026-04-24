"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { parseIcsToTrainingRecommendations } from "@/lib/icsImport";
import type { TrainingRecommendation } from "@/lib/types";

type RecommendationDraft = Omit<TrainingRecommendation, "id">;

type IcsImportCardProps = {
  onImportRecommendations: (planName: string, recommendations: RecommendationDraft[]) => Promise<void>;
};

export function IcsImportCard({ onImportRecommendations }: IcsImportCardProps) {
  const [draftRecommendations, setDraftRecommendations] = useState<RecommendationDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [planName, setPlanName] = useState("");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const canImport = draftRecommendations.length > 0 && planName.trim().length > 0;

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
        {fileName ? <span className="text-sm text-slate-600 dark:text-slate-300">{fileName}</span> : null}
      </div>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="text-slate-600 dark:text-slate-300">Training Plan Name</span>
        <input
          value={planName}
          onChange={(event) => setPlanName(event.target.value)}
          placeholder="Ultra Build Block"
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{previewText}</p>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <button
        type="button"
        disabled={!canImport || saveState === "saving"}
        onClick={async () => {
          setSaveState("saving");
          try {
            await onImportRecommendations(planName.trim(), draftRecommendations);
            setDraftRecommendations([]);
            setFileName("");
            setPlanName("");
            setError("");
            setSaveState("saved");
          } catch {
            setSaveState("error");
          }
        }}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
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
    </article>
  );
}
