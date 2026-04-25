"use client";

import { useEffect, useMemo, useState } from "react";
import { BodyCheckSection } from "./BodyCheckSection";
import type { ParsedRunDetails, RunHealthCheck, RunSurface, RunType } from "@/lib/types";

type AddRunFormValues = {
  time: string;
  title: string;
  surface: RunSurface;
  durationHours: number;
  distanceMiles: number;
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
  structuredNotes?: ParsedRunDetails;
};

type AddRunFormProps = {
  onSubmit: (values: AddRunFormValues) => void;
  initialOpen?: boolean;
};

const runTypes: RunType[] = ["Easy", "Long", "Tempo", "Recovery", "Intervals", "Hills", "Hike", "Race"];
const ratingScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const paceOptionsMinMile = ["5:30/mi", "6:00/mi", "6:30/mi", "7:00/mi", "7:30/mi", "8:00/mi", "8:30/mi", "9:00/mi", "9:30/mi", "10:00/mi"];
const paceOptionsMph = Array.from({ length: 33 }, (_, index) => (6.8 + index * 0.1).toFixed(1));
const treadmillDurationOptions = Array.from({ length: 30 }, (_, index) => index + 1);
const intervalCountOptions = Array.from({ length: 15 }, (_, index) => index + 1);
const restTimeOptions = Array.from({ length: 15 }, (_, index) => index + 1);

function defaultPaceForSurface(surface: RunSurface): string {
  return surface === "Outdoor" ? "7:30/mi" : "8.0";
}

function defaultValues(): AddRunFormValues {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return {
    time,
    title: "",
    surface: "Treadmill",
    durationHours: 0,
    distanceMiles: 0,
    durationMinutes: 0,
    durationSeconds: 0,
    runType: "Easy",
    notes: "",
    shoe: "ASICS Gel Nimbus",
    energyLevel: 7,
    soreness: 3,
    treadmillPace: defaultPaceForSurface("Treadmill"),
    treadmillPaceDurationMinutes: 20,
    intervalCount: 4,
    restTimeMinutes: 2,
    bodyCheck: { entries: [] },
  };
}

export function AddRunForm({ onSubmit, initialOpen = false }: AddRunFormProps) {
  const [values, setValues] = useState<AddRunFormValues>(defaultValues);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const showTreadmillFields = values.runType === "Tempo" || values.runType === "Intervals";
  const showHoursField = values.runType === "Long" || values.runType === "Race";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const pace = useMemo(() => {
    if (!values.distanceMiles || values.distanceMiles <= 0) {
      return "0:00/mi";
    }
    const totalDurationMinutes = values.durationHours * 60 + values.durationMinutes + values.durationSeconds / 60;
    const minPerMile = totalDurationMinutes / values.distanceMiles;
    const min = Math.floor(minPerMile);
    const sec = Math.round((minPerMile - min) * 60)
      .toString()
      .padStart(2, "0");
    return `${min}:${sec}/mi`;
  }, [values.distanceMiles, values.durationHours, values.durationMinutes, values.durationSeconds]);

  function update<K extends keyof AddRunFormValues>(key: K, value: AddRunFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
    setValues(defaultValues());
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setValues(defaultValues());
          setIsOpen(true);
        }}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Add New Run
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-10 backdrop-blur-sm md:items-center"
      onClick={() => setIsOpen(false)}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add New Run</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50" open>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span>Run Details</span>
              <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">▾</span>
            </div>
          </summary>

          <div className="mt-3 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Run Type</span>
                <select
                  value={values.runType}
                  onChange={(e) => {
                    const nextRunType = e.target.value as RunType;
                    update("runType", nextRunType);
                    if (!(nextRunType === "Long" || nextRunType === "Race")) {
                      update("durationHours", 0);
                    }
                    if (!(nextRunType === "Tempo" || nextRunType === "Intervals")) {
                      update("treadmillPace", defaultPaceForSurface(values.surface));
                      update("treadmillPaceDurationMinutes", 20);
                      update("intervalCount", 4);
                      update("restTimeMinutes", 2);
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
                <span className="text-slate-600 dark:text-slate-300">Surface</span>
                <select
                  value={values.surface}
                  onChange={(e) => {
                    const nextSurface = e.target.value as RunSurface;
                    update("surface", nextSurface);
                    if (showTreadmillFields) {
                      update("treadmillPace", defaultPaceForSurface(nextSurface));
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="Outdoor">Outdoor</option>
                  <option value="Treadmill">Treadmill</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Time</span>
                <input
                  type="time"
                  value={values.time}
                  onChange={(e) => update("time", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Distance (mi)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.distanceMiles === 0 ? "" : values.distanceMiles}
                  onChange={(e) => update("distanceMiles", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                  placeholder="Miles logged"
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
                      value={values.durationHours === 0 ? "" : values.durationHours}
                      onChange={(e) => update("durationHours", Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                      placeholder="Hours"
                      required
                    />
                  ) : null}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={values.durationMinutes === 0 ? "" : values.durationMinutes}
                    onChange={(e) => update("durationMinutes", Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                    placeholder="Minutes"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    value={values.durationSeconds === 0 ? "" : values.durationSeconds}
                    onChange={(e) => update("durationSeconds", Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                    placeholder="Seconds"
                    required
                  />
                </div>
              </label>

              <div className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Pace (min/mile)</span>
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300">
                  {pace}
                </div>
              </div>
            </div>

            {showTreadmillFields ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {values.surface === "Outdoor" ? "Pace (min/mile)" : "Treadmill Pace (mph)"}
                  </span>
                  <select
                    value={values.treadmillPace}
                    onChange={(e) => update("treadmillPace", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {(values.surface === "Outdoor" ? paceOptionsMinMile : paceOptionsMph).map((paceOption) => (
                      <option key={paceOption} value={paceOption}>
                        {values.surface === "Outdoor" ? paceOption : `${paceOption} mph`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {values.surface === "Outdoor" ? "Time At Pace (min)" : "Time At Treadmill Pace (min)"}
                  </span>
                  <select
                    value={values.treadmillPaceDurationMinutes}
                    onChange={(e) => update("treadmillPaceDurationMinutes", Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {treadmillDurationOptions.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {showTreadmillFields ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Number of Intervals</span>
                  <select
                    value={values.intervalCount}
                    onChange={(e) => update("intervalCount", Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {intervalCountOptions.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Rest Time (min)</span>
                  <select
                    value={values.restTimeMinutes}
                    onChange={(e) => update("restTimeMinutes", Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {restTimeOptions.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <textarea
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Running notes"
            />
          </div>
        </details>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50" open>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span>Gear</span>
              <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">▾</span>
            </div>
          </summary>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Shoe</span>
              <select
                value={values.shoe}
                onChange={(e) => update("shoe", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="ASICS Gel Nimbus">ASICS Gel Nimbus</option>
                <option value="Altra Torin 5">Altra Torin 5</option>
                <option value="Brooks Ghost">Brooks Ghost</option>
              </select>
            </label>
          </div>
        </details>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50" open>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span>Body Check</span>
              <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">▾</span>
            </div>
          </summary>

          <div className="mt-3 space-y-4">
            <div className="grid gap-3 grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Effort Level (1-10)</span>
                <select
                  value={values.energyLevel}
                  onChange={(e) => update("energyLevel", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  {ratingScale.map((rating) => (
                    <option key={`energy-${rating}`} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Soreness (1-10)</span>
                <select
                  value={values.soreness}
                  onChange={(e) => update("soreness", Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  {ratingScale.map((rating) => (
                    <option key={`soreness-${rating}`} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <BodyCheckSection
              value={values.bodyCheck}
              onChange={(next: RunHealthCheck) => update("bodyCheck", next)}
              showHeader={false}
            />
          </div>
        </details>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Save Run
        </button>
      </form>
    </div>
  );
}
