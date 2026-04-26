"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BodyCheckSection } from "./BodyCheckSection";
import type { ParsedRunDetails, RunHealthCheck, RunSurface, RunType } from "@/lib/types";

type AddRunFormValues = {
  date: string;
  time: string;
  title: string;
  surface: RunSurface;
  durationHours: number;
  distanceMiles: number;
  durationMinutes: number;
  durationSeconds: number;
  runType: RunType;
  notes: string;
  heartRateBpm: number;
  caloriesBurned: number;
  shoe: string;
  fuelingStrategy: string;
  energyLevel: number;
  soreness: number;
  treadmillPace: string;
  treadmillPaceDurationMinutes: number;
  intervalCount: number;
  restTimeMinutes: number;
  primaryBenefitEvaluation: string;
  bodyCheck: RunHealthCheck;
  structuredNotes?: ParsedRunDetails;
};

type FuelingDrinkEntry = {
  amount: string;
  notes: string;
};

type FuelingGelEntry = {
  gel: string;
  timeIntoRun: string;
};

type FuelingFormValues = {
  hydration: {
    water: FuelingDrinkEntry;
    electrolyte: FuelingDrinkEntry;
  };
  gels: FuelingGelEntry[];
};

type GarminScreenshotParseResponse = {
  surface: RunSurface | null;
  distanceMiles: number | null;
  heartRateBpm: number | null;
  caloriesBurned: number | null;
  totalDurationSeconds: number | null;
  runDate: string | null;
  startTime: string | null;
  primaryBenefitEvaluation: string | null;
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

function defaultFuelingFormValues(): FuelingFormValues {
  return {
    hydration: {
      water: { amount: "", notes: "" },
      electrolyte: { amount: "", notes: "" },
    },
    gels: [{ gel: "", timeIntoRun: "" }],
  };
}

function serializeFuelingStrategy(fueling: FuelingFormValues): string {
  const lines: string[] = [];
  const water = fueling.hydration.water;
  const electrolyte = fueling.hydration.electrolyte;
  const gels = fueling.gels.filter((entry) => entry.gel.trim() || entry.timeIntoRun.trim());

  if (water.amount.trim() || water.notes.trim() || electrolyte.amount.trim() || electrolyte.notes.trim()) {
    lines.push("Hydration:");
    if (water.amount.trim() || water.notes.trim()) {
      lines.push(`Water: ${water.amount.trim() || "unspecified"}${water.notes.trim() ? ` | Notes: ${water.notes.trim()}` : ""}`);
    }
    if (electrolyte.amount.trim() || electrolyte.notes.trim()) {
      lines.push(`Electrolyte: ${electrolyte.amount.trim() || "unspecified"}${electrolyte.notes.trim() ? ` | Notes: ${electrolyte.notes.trim()}` : ""}`);
    }
  }

  if (gels.length > 0) {
    lines.push("Food:");
    gels.forEach((entry, index) => {
      lines.push(`Gel ${index + 1}: ${entry.gel.trim() || "unspecified"}${entry.timeIntoRun.trim() ? ` | Time into run: ${entry.timeIntoRun.trim()}` : ""}`);
    });
  }

  return lines.join("\n");
}

function defaultValues(): AddRunFormValues {
  const now = new Date();
  const date = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
    .getDate()
    .toString()
    .padStart(2, "0")}`;
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return {
    date,
    time,
    title: "",
    surface: "Treadmill",
    durationHours: 0,
    distanceMiles: 0,
    durationMinutes: 0,
    durationSeconds: 0,
    runType: "Easy",
    notes: "",
    heartRateBpm: 0,
    caloriesBurned: 0,
    shoe: "ASICS Gel Nimbus",
    fuelingStrategy: "",
    energyLevel: 7,
    soreness: 3,
    treadmillPace: defaultPaceForSurface("Treadmill"),
    treadmillPaceDurationMinutes: 20,
    intervalCount: 4,
    restTimeMinutes: 2,
    primaryBenefitEvaluation: "",
    bodyCheck: { entries: [] },
  };
}

export function AddRunForm({ onSubmit, initialOpen = false }: AddRunFormProps) {
  const [values, setValues] = useState<AddRunFormValues>(defaultValues);
  const [fuelingValues, setFuelingValues] = useState<FuelingFormValues>(defaultFuelingFormValues);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isParsingScreenshot, setIsParsingScreenshot] = useState(false);
  const [garminParseError, setGarminParseError] = useState("");
  const [garminFileName, setGarminFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const showTreadmillFields = values.runType === "Tempo" || values.runType === "Intervals";
  const showHoursField = values.runType === "Long" || values.runType === "Race";
  const serializedFuelingStrategy = useMemo(() => serializeFuelingStrategy(fuelingValues), [fuelingValues]);

  function resetFormState() {
    setValues(defaultValues());
    setFuelingValues(defaultFuelingFormValues());
    setGarminParseError("");
    setGarminFileName("");
  }

  function closeModal() {
    setIsOpen(false);
    setGarminParseError("");
    setGarminFileName("");
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
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

  const visibleGels = useMemo(() => {
    const lastEntry = fuelingValues.gels[fuelingValues.gels.length - 1];
    if (!lastEntry || lastEntry.gel.trim() || lastEntry.timeIntoRun.trim()) {
      return [...fuelingValues.gels, { gel: "", timeIntoRun: "" }];
    }

    return fuelingValues.gels;
  }, [fuelingValues.gels]);

  useEffect(() => {
    setValues((prev) => (prev.fuelingStrategy === serializedFuelingStrategy ? prev : { ...prev, fuelingStrategy: serializedFuelingStrategy }));
  }, [serializedFuelingStrategy]);

  function update<K extends keyof AddRunFormValues>(key: K, value: AddRunFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateHydration(kind: keyof FuelingFormValues["hydration"], field: keyof FuelingDrinkEntry, value: string) {
    setFuelingValues((prev) => ({
      ...prev,
      hydration: {
        ...prev.hydration,
        [kind]: {
          ...prev.hydration[kind],
          [field]: value,
        },
      },
    }));
  }

  function updateGel(index: number, field: keyof FuelingGelEntry, value: string) {
    setFuelingValues((prev) => {
      const gels = [...prev.gels];
      while (gels.length <= index) {
        gels.push({ gel: "", timeIntoRun: "" });
      }
      gels[index] = { ...gels[index], [field]: value };

      while (
        gels.length > 1 &&
        !gels[gels.length - 1].gel.trim() &&
        !gels[gels.length - 1].timeIntoRun.trim() &&
        !gels[gels.length - 2].gel.trim() &&
        !gels[gels.length - 2].timeIntoRun.trim()
      ) {
        gels.pop();
      }

      return { ...prev, gels };
    });
  }

  async function handleGarminScreenshot(file: File) {
    if (!file.type.startsWith("image/")) {
      setGarminParseError("Choose an image file from Garmin.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setGarminParseError("Screenshot must be 8 MB or smaller.");
      return;
    }

    setIsParsingScreenshot(true);
    setGarminParseError("");
    setGarminFileName(file.name);

    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Could not read screenshot."));
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/ai/parse-garmin-screenshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });

      const data = (await response.json()) as GarminScreenshotParseResponse | { error?: string };
      if (!response.ok || !("surface" in data)) {
        throw new Error("error" in data && typeof data.error === "string" ? data.error : "Failed to parse Garmin screenshot.");
      }

      setValues((prev) => {
        const next = { ...prev };
        if (data.surface) {
          next.surface = data.surface;
          if (prev.runType === "Tempo" || prev.runType === "Intervals") {
            next.treadmillPace = defaultPaceForSurface(data.surface);
          }
        }
        if (typeof data.distanceMiles === "number" && data.distanceMiles > 0) {
          next.distanceMiles = data.distanceMiles;
        }
        if (typeof data.heartRateBpm === "number" && data.heartRateBpm > 0) {
          next.heartRateBpm = data.heartRateBpm;
        }
        if (typeof data.caloriesBurned === "number" && data.caloriesBurned > 0) {
          next.caloriesBurned = data.caloriesBurned;
        }
        if (typeof data.totalDurationSeconds === "number" && data.totalDurationSeconds > 0) {
          next.durationHours = Math.floor(data.totalDurationSeconds / 3600);
          next.durationMinutes = Math.floor((data.totalDurationSeconds % 3600) / 60);
          next.durationSeconds = data.totalDurationSeconds % 60;
        }
        if (data.runDate) {
          next.date = data.runDate;
        }
        if (data.startTime) {
          next.time = data.startTime;
        }
        const primaryBenefitEvaluation = data.primaryBenefitEvaluation?.trim() ?? "";
        if (primaryBenefitEvaluation) {
          next.primaryBenefitEvaluation = primaryBenefitEvaluation;
          next.notes = primaryBenefitEvaluation;
        }
        return next;
      });
    } catch (error) {
      setGarminParseError(error instanceof Error ? error.message : "Failed to parse Garmin screenshot.");
    } finally {
      setIsParsingScreenshot(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
    resetFormState();
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          resetFormState();
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
      onClick={closeModal}
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
            onClick={closeModal}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-500/30 dark:bg-sky-500/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import Garmin screenshot</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Upload a Garmin run screenshot to prefill surface, distance, time, heart rate, calories, and primary benefit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleGarminScreenshot(file);
                  }
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingScreenshot}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
              >
                {isParsingScreenshot ? "Reading screenshot..." : "Upload Screenshot"}
              </button>
              {garminFileName ? <span className="text-xs text-slate-500 dark:text-slate-400">{garminFileName}</span> : null}
            </div>
          </div>
          {garminParseError ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{garminParseError}</p> : null}
        </section>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50" open>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span>Run Details</span>
              <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">▾</span>
            </div>
          </summary>

          <div className="mt-3 space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Run Type</span>
                <select
                  value={values.runType}
                  onChange={(e) => {
                    const nextRunType = e.target.value as RunType;
                    update("runType", nextRunType);
                    if (!(nextRunType === "Long" || nextRunType === "Race")) {
                      update("durationHours", 0);
                      update("fuelingStrategy", "");
                      setFuelingValues(defaultFuelingFormValues());
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
                <span className="text-slate-600 dark:text-slate-300">Date</span>
                <input
                  type="date"
                  value={values.date}
                  onChange={(e) => update("date", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
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

            <div className="grid gap-3 md:grid-cols-5">
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

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Heart Rate (bpm)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.heartRateBpm === 0 ? "" : values.heartRateBpm}
                  onChange={(e) => update("heartRateBpm", Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                  placeholder="Avg HR"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Calories</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.caloriesBurned === 0 ? "" : values.caloriesBurned}
                  onChange={(e) => update("caloriesBurned", Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 placeholder:italic placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-500"
                  placeholder="Calories"
                />
              </label>
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
              placeholder="Running notes or Garmin primary benefit"
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

        {showHoursField ? (
          <details className="group rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50" open>
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-slate-100">
              <div className="flex items-center justify-between">
                <span>Fueling Strategy</span>
                <span className="text-xs text-slate-500 transition group-open:rotate-180 dark:text-slate-400">▾</span>
              </div>
            </summary>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hydration</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Log total consumed and any relevant notes.</p>
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Water</span>
                      <input
                        type="text"
                        value={fuelingValues.hydration.water.amount}
                        onChange={(e) => updateHydration("water", "amount", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        placeholder="Total amount, e.g. 20 oz"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Water Notes</span>
                      <input
                        type="text"
                        value={fuelingValues.hydration.water.notes}
                        onChange={(e) => updateHydration("water", "notes", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        placeholder="Sips every 15 min"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Electrolyte</span>
                      <input
                        type="text"
                        value={fuelingValues.hydration.electrolyte.amount}
                        onChange={(e) => updateHydration("electrolyte", "amount", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        placeholder="Total amount, e.g. 12 oz"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Electrolyte Notes</span>
                      <input
                        type="text"
                        value={fuelingValues.hydration.electrolyte.notes}
                        onChange={(e) => updateHydration("electrolyte", "notes", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        placeholder="One bottle with sodium mix"
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Food</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add gels as you log them. A new row appears after you start filling the current one.</p>
                </div>

                <div className="space-y-3">
                  {visibleGels.map((entry, index) => (
                    <div key={`gel-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Gel {index + 1}</span>
                        <input
                          type="text"
                          value={entry.gel}
                          onChange={(e) => updateGel(index, "gel", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          placeholder="What you took"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Time Into Run</span>
                        <input
                          type="text"
                          value={entry.timeIntoRun}
                          onChange={(e) => updateGel(index, "timeIntoRun", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                          placeholder="e.g. 00:35 or mile 8"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </details>
        ) : null}

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
