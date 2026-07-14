"use client";

import { useEffect, useState } from "react";
import type { ImportConflictStrategy, TrainingGoal, TrainingPlanMetadata } from "@/lib/types";

type DeletionPreviewItem = {
  id: string;
  date: string;
  title: string;
};

type TrainingPlanMetadataModalProps = {
  isOpen: boolean;
  planName: string;
  requiresMetadataSetup: boolean;
  importStrategy: ImportConflictStrategy;
  deletionPreview: DeletionPreviewItem[];
  additionPreview: DeletionPreviewItem[];
  inferred: Partial<TrainingPlanMetadata>;
  onConfirm: (metadata: Partial<TrainingPlanMetadata>) => void;
  onCancel: () => void;
};

const GOAL_OPTIONS: Array<{ value: TrainingGoal; label: string }> = [
  { value: "5K", label: "5K" },
  { value: "10K", label: "10K" },
  { value: "half-marathon", label: "Half Marathon (13.1 mi)" },
  { value: "marathon", label: "Marathon (26.2 mi)" },
  { value: "50K", label: "50K / Ultra" },
  { value: "general-fitness", label: "General Fitness" },
  { value: "base-building", label: "Base Building" },
];

export function TrainingPlanMetadataModal({
  isOpen,
  planName,
  requiresMetadataSetup,
  importStrategy,
  deletionPreview,
  additionPreview,
  inferred,
  onConfirm,
  onCancel,
}: TrainingPlanMetadataModalProps) {
  const [activeGoal, setActiveGoal] = useState<TrainingGoal | "">("");
  const [raceDistance, setRaceDistance] = useState("");
  const [targetRaceDate, setTargetRaceDate] = useState<string>("");
  const [plannedWeeklyMileage, setPlannedWeeklyMileage] = useState("");
  const [plannedLongRunDistance, setPlannedLongRunDistance] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveGoal(inferred.activeGoal ?? "");
    setRaceDistance(inferred.raceDistance ?? "");
    setTargetRaceDate(() => {
      if (inferred.targetRaceDate) {
        try {
          return new Date(inferred.targetRaceDate).toISOString().split("T")[0];
        } catch {
          return "";
        }
      }
      return "";
    });
    setPlannedWeeklyMileage(inferred.plannedWeeklyMileage?.toString() ?? "");
    setPlannedLongRunDistance(inferred.plannedLongRunDistance?.toString() ?? "");
  }, [inferred, isOpen]);

  const handleConfirm = () => {
    if (!requiresMetadataSetup) {
      onConfirm({
        ...inferred,
        planName: planName.trim(),
      });
      return;
    }

    const metadata: Partial<TrainingPlanMetadata> = {
      activeGoal: activeGoal || null,
      raceDistance: raceDistance || null,
      targetRaceDate: targetRaceDate ? new Date(targetRaceDate).toISOString() : null,
      plannedWeeklyMileage: plannedWeeklyMileage ? parseFloat(plannedWeeklyMileage) : null,
      plannedLongRunDistance: plannedLongRunDistance ? parseFloat(plannedLongRunDistance) : null,
      planName: planName.trim(),
      planStartDate: inferred.planStartDate,
      currentPlanWeek: inferred.currentPlanWeek ?? 1,
    };

    onConfirm(metadata);
  };

  if (!isOpen) return null;

  const sortedDeletionPreview = [...deletionPreview].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const sortedAdditionPreview = [...additionPreview].sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const formatDateLabel = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value.slice(0, 10);
    }
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-lg dark:bg-slate-900">
        <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {requiresMetadataSetup ? "Confirm Training Plan Details" : "Confirm Training Plan Update"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Detected: <span className="font-medium">{planName}</span>
        </p>

        {importStrategy === "override" ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-700/40 dark:bg-rose-900/20">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              {sortedDeletionPreview.length > 0
                ? `${sortedDeletionPreview.length} planned workout${sortedDeletionPreview.length === 1 ? "" : "s"} will be deleted on import.`
                : "No existing planned workouts will be deleted."}
            </p>
            {sortedDeletionPreview.length > 0 ? (
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-rose-900 dark:text-rose-100">
                {sortedDeletionPreview.map((item) => (
                  <li key={item.id}>
                    {formatDateLabel(item.date)}: {item.title}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-rose-800 dark:text-rose-200/90">
              Completed workout dates are protected and never deleted.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-700/40 dark:bg-emerald-900/20">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Merge mode selected. Existing planned workouts will be kept.
            </p>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200/90">
              Completed workout dates are also preserved.
            </p>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700/40 dark:bg-blue-900/20">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            {sortedAdditionPreview.length} workout{sortedAdditionPreview.length === 1 ? "" : "s"} will be added from this import.
          </p>
          {sortedAdditionPreview.length > 0 ? (
            <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-blue-900 dark:text-blue-100">
              {sortedAdditionPreview.map((item) => (
                <li key={item.id}>
                  {formatDateLabel(item.date)}: {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-blue-800 dark:text-blue-200/90">
              No new workouts will be added from this file.
            </p>
          )}
        </div>

        {requiresMetadataSetup ? (
          <div className="mt-6 space-y-4">
          {/* Training Goal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Training Goal
            </label>
            <select
              value={activeGoal}
              onChange={(e) => setActiveGoal(e.target.value as TrainingGoal | "")}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">-- Not specified --</option>
              {GOAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {inferred.activeGoal && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inferred: {inferred.activeGoal}
              </p>
            )}
          </div>

          {/* Race Distance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Race Distance
            </label>
            <input
              type="text"
              value={raceDistance}
              onChange={(e) => setRaceDistance(e.target.value)}
              placeholder="e.g., 50 km, 26.2 miles"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {inferred.raceDistance && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inferred: {inferred.raceDistance}
              </p>
            )}
          </div>

          {/* Target Race Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Target Race Date
            </label>
            <input
              type="date"
              value={targetRaceDate}
              onChange={(e) => setTargetRaceDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {inferred.targetRaceDate && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inferred: {new Date(inferred.targetRaceDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Planned Weekly Mileage */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Planned Weekly Mileage
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={plannedWeeklyMileage}
              onChange={(e) => setPlannedWeeklyMileage(e.target.value)}
              placeholder="e.g., 45"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {inferred.plannedWeeklyMileage && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inferred: {inferred.plannedWeeklyMileage} miles
              </p>
            )}
          </div>

          {/* Planned Long Run Distance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Planned Long Run Distance
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={plannedLongRunDistance}
              onChange={(e) => setPlannedLongRunDistance(e.target.value)}
              placeholder="e.g., 15"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {inferred.plannedLongRunDistance && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Inferred: {inferred.plannedLongRunDistance} miles
              </p>
            )}
          </div>
          </div>
        ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {requiresMetadataSetup ? "Confirm & Import" : "Confirm Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
