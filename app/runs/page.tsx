"use client";

import { useState } from "react";
import { AddRunForm } from "@/components/AddRunForm";
import { RunCard } from "@/components/RunCard";
import { useRunTrack } from "@/components/RunTrackProvider";
import type { RunHealthCheck, RunLog, RunSurface, RunType } from "@/lib/types";

type EditRunValues = {
  date: string;
  time: string;
  title: string;
  surface: RunSurface;
  distanceMiles: number;
  durationHours: number;
  durationMinutes: number;
  durationSeconds: number;
  runType: RunType;
  notes: string;
  shoe: string;
  energyLevel: number;
  soreness: number;
  treadmillPace: string;
  treadmillPaceDurationMinutes: number;
  intervalCount: number;
  restTimeMinutes: number;
  bodyCheck: RunHealthCheck;
};

const runTypes: RunType[] = ["Easy", "Long", "Tempo", "Recovery", "Intervals", "Hills", "Hike", "Race"];

function defaultPaceForSurface(surface: RunSurface): string {
  return surface === "Outdoor" ? "7:30/mi" : "8.0";
}

function toEditValues(run: RunLog): EditRunValues {
  const date = new Date(run.date);
  const runDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  const totalSeconds = Math.round(run.durationMinutes * 60);

  return {
    date: runDate,
    time,
    title: run.title,
    surface: run.surface,
    distanceMiles: run.distanceMiles,
    durationHours: Math.floor(totalSeconds / 3600),
    durationMinutes: Math.floor((totalSeconds % 3600) / 60),
    durationSeconds: totalSeconds % 60,
    runType: run.runType,
    notes: run.notes,
    shoe: run.shoe ?? "ASICS Gel Nimbus",
    energyLevel: run.energyLevel,
    soreness: run.soreness,
    treadmillPace: run.treadmillPace ?? defaultPaceForSurface(run.surface),
    treadmillPaceDurationMinutes: run.treadmillPaceDurationMinutes ?? 20,
    intervalCount: run.intervalCount ?? 4,
    restTimeMinutes: run.restTimeMinutes ?? 2,
    bodyCheck: run.bodyCheck ?? { entries: [] },
  };
}

export default function RunsPage() {
  const { runs, addRun, updateRun, updateRunAiSummary, deleteRun } = useRunTrack();
  const [editingRun, setEditingRun] = useState<RunLog | null>(null);
  const [editValues, setEditValues] = useState<EditRunValues | null>(null);
  const [regeneratingRunId, setRegeneratingRunId] = useState<string | null>(null);

  const sortedRuns = [...runs].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const showHoursField = editValues ? editValues.runType === "Long" || editValues.runType === "Race" : false;

  function startEdit(run: RunLog) {
    setEditingRun(run);
    setEditValues(toEditValues(run));
  }

  function closeEdit() {
    setEditingRun(null);
    setEditValues(null);
  }

  function updateEdit<K extends keyof EditRunValues>(key: K, value: EditRunValues[K]) {
    setEditValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function regenerateSummary(run: RunLog) {
    setRegeneratingRunId(run.id);

    try {
      const sorenessNotes = [
        run.notes,
        ...(run.bodyCheck?.entries ?? []).map((entry) => [entry.location, entry.painType, entry.notes].filter(Boolean).join(" ")),
      ].filter((item) => item.trim().length > 0);

      const response = await fetch("/api/ai/run-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          distance: run.distanceMiles,
          duration: run.durationMinutes,
          pace: run.paceMinPerMile,
          runType: run.runType,
          notes: run.notes,
          sorenessNotes,
          effortLevel: run.energyLevel,
          weather: run.structuredNotes?.weather ?? null,
        }),
      });

      const data = (await response.json()) as { summary?: string; signals?: string[] };
      if (!response.ok || !data.summary) {
        return;
      }

      updateRunAiSummary(
        run.id,
        data.summary,
        Array.isArray(data.signals)
          ? data.signals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
          : []
      );
    } finally {
      setRegeneratingRunId(null);
    }
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRun || !editValues) {
      return;
    }

    const {
      date,
      time,
      durationHours,
      durationMinutes,
      durationSeconds,
      treadmillPace,
      treadmillPaceDurationMinutes,
      intervalCount,
      restTimeMinutes,
      ...runPayload
    } = editValues;

    const totalDurationMinutes = durationHours * 60 + durationMinutes + durationSeconds / 60;
    const paceMinPerMile = runPayload.distanceMiles > 0 ? totalDurationMinutes / runPayload.distanceMiles : 0;
    const [hours, minutes] = time.split(":").map(Number);
    const runDate = new Date(editingRun.date);
    const [year, month, day] = date.split("-").map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      runDate.setFullYear(year, Math.max(0, month - 1), day);
    }
    runDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);

    const isTempoOrIntervals = runPayload.runType === "Tempo" || runPayload.runType === "Intervals";
    const defaultWorkoutPace = defaultPaceForSurface(runPayload.surface);
    const hasEditedWorkoutDetails =
      treadmillPace !== defaultWorkoutPace ||
      treadmillPaceDurationMinutes !== 20 ||
      intervalCount !== 4 ||
      restTimeMinutes !== 2;

    updateRun(editingRun.id, {
      ...runPayload,
      ...(isTempoOrIntervals && hasEditedWorkoutDetails
        ? {
            treadmillPace,
            treadmillPaceDurationMinutes,
            intervalCount,
            restTimeMinutes,
          }
        : {}),
      durationMinutes: totalDurationMinutes,
      date: runDate.toISOString(),
      paceMinPerMile,
    });

    closeEdit();
  }

  return (
    <div className="space-y-5">
      <AddRunForm
        onSubmit={(values) => {
          const { time, durationHours, durationSeconds, ...payload } = values;
          const {
            treadmillPace,
            treadmillPaceDurationMinutes,
            intervalCount,
            restTimeMinutes,
            ...runPayload
          } = payload;
          const durationMinutes = durationHours * 60 + payload.durationMinutes + durationSeconds / 60;
          const paceMinPerMile = values.distanceMiles > 0 ? durationMinutes / values.distanceMiles : 0;
          const [hours, minutes] = time.split(":").map(Number);
          const runDate = new Date();
          runDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
          const isTempoOrIntervals = payload.runType === "Tempo" || payload.runType === "Intervals";
          const defaultWorkoutPace = payload.surface === "Outdoor" ? "7:30/mi" : "8.0";
          const hasEditedWorkoutDetails =
            treadmillPace !== defaultWorkoutPace ||
            treadmillPaceDurationMinutes !== 20 ||
            intervalCount !== 4 ||
            restTimeMinutes !== 2;

          addRun({
            ...runPayload,
            ...(isTempoOrIntervals && hasEditedWorkoutDetails
              ? {
                  treadmillPace,
                  treadmillPaceDurationMinutes,
                  intervalCount,
                  restTimeMinutes,
                }
              : {}),
            durationMinutes,
            date: runDate.toISOString(),
            paceMinPerMile,
          });
        }}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Logged Runs</h2>
        {sortedRuns.length === 0 ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No runs saved yet.
          </article>
        ) : (
          sortedRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onEdit={startEdit}
              onRegenerateSummary={(nextRun) => {
                void regenerateSummary(nextRun);
              }}
              isRegeneratingSummary={regeneratingRunId === run.id}
            />
          ))
        )}
      </section>

      {editingRun && editValues ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-10 backdrop-blur-sm md:items-center"
          onClick={closeEdit}
        >
          <form
            onSubmit={saveEdit}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Run</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Run Title</span>
                <input
                  value={editValues.title}
                  onChange={(e) => updateEdit("title", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Run Type</span>
                <select
                  value={editValues.runType}
                  onChange={(e) => {
                    const nextRunType = e.target.value as RunType;
                    updateEdit("runType", nextRunType);
                    if (!(nextRunType === "Long" || nextRunType === "Race")) {
                      updateEdit("durationHours", 0);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  {runTypes.map((runType) => (
                    <option key={runType} value={runType}>
                      {runType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Date</span>
                <input
                  type="date"
                  value={editValues.date}
                  onChange={(e) => updateEdit("date", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Time</span>
                <input
                  type="time"
                  value={editValues.time}
                  onChange={(e) => updateEdit("time", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Surface</span>
                <select
                  value={editValues.surface}
                  onChange={(e) => updateEdit("surface", e.target.value as RunSurface)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="Outdoor">Outdoor</option>
                  <option value="Treadmill">Treadmill</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Distance (mi)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editValues.distanceMiles}
                  onChange={(e) => updateEdit("distanceMiles", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Duration</span>
                <div className={`grid gap-2 ${showHoursField ? "grid-cols-3" : "grid-cols-2"}`}>
                  {showHoursField ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editValues.durationHours}
                      onChange={(e) => updateEdit("durationHours", Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                      placeholder="Hr"
                      required
                    />
                  ) : null}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editValues.durationMinutes}
                    onChange={(e) => updateEdit("durationMinutes", Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Min"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    value={editValues.durationSeconds}
                    onChange={(e) => updateEdit("durationSeconds", Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Sec"
                    required
                  />
                </div>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Notes</span>
              <textarea
                value={editValues.notes}
                onChange={(e) => updateEdit("notes", e.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  deleteRun(editingRun.id);
                  closeEdit();
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Delete Run
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
