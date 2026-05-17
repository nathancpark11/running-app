"use client";

import { TrainingRecommendation, RunType, RunSurface } from "@/lib/types";
import { useEffect, useState } from "react";

interface PlannedRunEditModalProps {
  isOpen: boolean;
  recommendation: TrainingRecommendation | null;
  onConfirm: (updates: Partial<Omit<TrainingRecommendation, "id" | "date">>) => void;
  onCancel: () => void;
}

const RUN_TYPES: RunType[] = ["Easy", "Long", "Endurance", "Tempo", "Recovery", "Intervals", "Race", "Hills", "Hike"];
const SURFACES: RunSurface[] = ["Outdoor", "Treadmill"];

export function PlannedRunEditModal({ isOpen, recommendation, onConfirm, onCancel }: PlannedRunEditModalProps) {
  const [title, setTitle] = useState("");
  const [runType, setRunType] = useState<RunType | "">("");
  const [surface, setSurface] = useState<RunSurface | "">("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [targetPace, setTargetPace] = useState("");
  const [intervalCount, setIntervalCount] = useState("");
  const [restTimeMinutes, setRestTimeMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [aiCoachNote, setAiCoachNote] = useState("");

  // Reset form when modal opens or recommendation changes
  useEffect(() => {
    if (isOpen && recommendation) {
      setTitle(recommendation.title);
      setRunType((recommendation.runType as RunType) || "");
      setSurface((recommendation.surface as RunSurface) || "");
      setDistanceMiles(recommendation.distanceMiles?.toString() || "");
      setDurationMinutes(recommendation.durationMinutes?.toString() || "");
      setTargetPace(recommendation.targetPace || "");
      setIntervalCount(recommendation.intervalCount?.toString() || "");
      setRestTimeMinutes(recommendation.restTimeMinutes?.toString() || "");
      setNotes(recommendation.notes || "");
      setAiCoachNote(recommendation.aiCoachNote || "");
    }
  }, [isOpen, recommendation]);

  const handleConfirm = () => {
    const updates: Partial<Omit<TrainingRecommendation, "id" | "date">> = {
      title,
      runType: runType || undefined,
      surface: surface || undefined,
      distanceMiles: distanceMiles ? parseFloat(distanceMiles) : undefined,
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
      targetPace: targetPace || undefined,
      intervalCount: intervalCount ? parseInt(intervalCount, 10) : undefined,
      restTimeMinutes: restTimeMinutes ? parseInt(restTimeMinutes, 10) : undefined,
      notes,
      aiCoachNote,
    };

    onConfirm(updates);
  };

  if (!isOpen || !recommendation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Edit Planned Workout
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {new Date(recommendation.date).toLocaleDateString()}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Workout Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning run"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Run Type */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Run Type
            </label>
            <select 
              value={runType} 
              onChange={(e) => setRunType(e.target.value as RunType | "")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select run type...</option>
              {RUN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Surface */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Surface
            </label>
            <select 
              value={surface} 
              onChange={(e) => setSurface(e.target.value as RunSurface | "")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select surface...</option>
              {SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Distance and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Distance (miles)
              </label>
              <input
                type="number"
                step="0.1"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Target Pace */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Target Pace (e.g., 8:30/mile)
            </label>
            <input
              type="text"
              value={targetPace}
              onChange={(e) => setTargetPace(e.target.value)}
              placeholder="e.g., 8:30/mile"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Interval Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Interval Count
              </label>
              <input
                type="number"
                value={intervalCount}
                onChange={(e) => setIntervalCount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Rest Time (minutes)
              </label>
              <input
                type="number"
                value={restTimeMinutes}
                onChange={(e) => setRestTimeMinutes(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this workout..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* AI Coach Note */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              AI Coach Note
            </label>
            <textarea
              value={aiCoachNote}
              onChange={(e) => setAiCoachNote(e.target.value)}
              placeholder="Notes from AI coach..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4 flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 dark:border-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
