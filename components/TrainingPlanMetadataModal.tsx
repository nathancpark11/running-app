"use client";

import { useState } from "react";
import type { TrainingGoal, TrainingPlanMetadata } from "@/lib/types";

type TrainingPlanMetadataModalProps = {
  isOpen: boolean;
  planName: string;
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
  inferred,
  onConfirm,
  onCancel,
}: TrainingPlanMetadataModalProps) {
  const [activeGoal, setActiveGoal] = useState<TrainingGoal | "">(inferred.activeGoal ?? "");
  const [raceDistance, setRaceDistance] = useState(inferred.raceDistance ?? "");
  const [targetRaceDate, setTargetRaceDate] = useState(inferred.targetRaceDate ? new Date(inferred.targetRaceDate).toISOString().split("T")[0] : "");
  const [plannedWeeklyMileage, setPlannedWeeklyMileage] = useState(inferred.plannedWeeklyMileage?.toString() ?? "");
  const [plannedLongRunDistance, setPlannedLongRunDistance] = useState(inferred.plannedLongRunDistance?.toString() ?? "");

  const handleConfirm = () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Confirm Training Plan Details
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Detected: <span className="font-medium">{planName}</span>
        </p>

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

        <div className="mt-6 flex justify-end gap-3">
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
            Confirm & Import
          </button>
        </div>
      </div>
    </div>
  );
}
