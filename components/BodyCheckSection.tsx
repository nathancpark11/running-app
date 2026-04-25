"use client";

import { useMemo, useState } from "react";
import { BodyMap } from "@/components/BodyMap";
import type {
  BodyRegionId,
  PainLocationId,
  PainTiming,
  PainType,
  RunHealthCheck,
  RunHealthCheckEntry,
} from "@/lib/types";

type BodyCheckSectionProps = {
  value: RunHealthCheck;
  onChange: (next: RunHealthCheck) => void;
  showHeader?: boolean;
};

type PainOption = {
  id: PainLocationId;
  label: string;
  shortLabel: string;
  group: "Hip" | "Upper Leg" | "Knee" | "Lower Leg" | "Foot";
};

const painOptions: PainOption[] = [
  { id: "hip_back", label: "Hip (back)", shortLabel: "Hip Back", group: "Hip" },
  { id: "hip_side", label: "Hip (side)", shortLabel: "Hip Side", group: "Hip" },
  { id: "hip_front", label: "Hip (front)", shortLabel: "Hip Front", group: "Hip" },
  { id: "hip_inside", label: "Hip (inside)", shortLabel: "Hip Inside", group: "Hip" },
  { id: "quad_front_thigh", label: "Quad", shortLabel: "Quad", group: "Upper Leg" },
  { id: "hamstring_back_thigh", label: "Hamstring", shortLabel: "Hamstring", group: "Upper Leg" },
  { id: "inner_thigh", label: "Inner thigh", shortLabel: "Inner", group: "Upper Leg" },
  { id: "outer_thigh_it_band", label: "Outer thigh / IT band", shortLabel: "Outer", group: "Upper Leg" },
  { id: "knee_front", label: "Front", shortLabel: "Knee (Front)", group: "Knee" },
  { id: "knee_inner", label: "Inner", shortLabel: "Knee (Inner)", group: "Knee" },
  { id: "knee_outer", label: "Outer", shortLabel: "Knee (Outer)", group: "Knee" },
  { id: "shin", label: "Shin", shortLabel: "Shin", group: "Lower Leg" },
  { id: "calf", label: "Calf", shortLabel: "Calf", group: "Lower Leg" },
  { id: "achilles", label: "Achilles", shortLabel: "Achilles", group: "Lower Leg" },
  { id: "ankle", label: "Ankle", shortLabel: "Ankle", group: "Foot" },
  { id: "heel", label: "Heel", shortLabel: "Heel", group: "Foot" },
  { id: "arch", label: "Arch", shortLabel: "Arch", group: "Foot" },
  { id: "toes", label: "Toes", shortLabel: "Toes", group: "Foot" },
];

const painTypes: PainType[] = ["soreness", "sharp", "dull ache", "tightness", "numbness", "swelling", "other"];
const painTimings: PainTiming[] = ["before run", "during run", "after run"];

const regionOrder: Record<BodyRegionId, number> = {
  head_neck: 0,
  left_shoulder: 1,
  right_shoulder: 2,
  shoulders: 3,
  chest: 4,
  abdomen: 5,
  upper_back: 6,
  lower_back: 7,
  left_hip: 8,
  right_hip: 9,
  hips_glutes: 10,
  left_upper_leg: 11,
  right_upper_leg: 12,
  left_knee: 13,
  right_knee: 14,
  left_lower_leg: 15,
  right_lower_leg: 16,
  left_ankle_foot: 17,
  right_ankle_foot: 18,
  back: 19,
  hips: 20,
};

const painPointRegionBySide: Record<"left" | "right", Record<PainLocationId, BodyRegionId>> = {
  left: {
    hip_back: "left_hip",
    hip_side: "left_hip",
    hip_front: "left_hip",
    hip_inside: "left_hip",
    quad_front_thigh: "left_upper_leg",
    hamstring_back_thigh: "left_upper_leg",
    inner_thigh: "left_upper_leg",
    outer_thigh_it_band: "left_upper_leg",
    knee_front: "left_knee",
    knee_inner: "left_knee",
    knee_outer: "left_knee",
    calf: "left_lower_leg",
    shin: "left_lower_leg",
    achilles: "left_lower_leg",
    ankle: "left_ankle_foot",
    heel: "left_ankle_foot",
    arch: "left_ankle_foot",
    toes: "left_ankle_foot",
  },
  right: {
    hip_back: "right_hip",
    hip_side: "right_hip",
    hip_front: "right_hip",
    hip_inside: "right_hip",
    quad_front_thigh: "right_upper_leg",
    hamstring_back_thigh: "right_upper_leg",
    inner_thigh: "right_upper_leg",
    outer_thigh_it_band: "right_upper_leg",
    knee_front: "right_knee",
    knee_inner: "right_knee",
    knee_outer: "right_knee",
    calf: "right_lower_leg",
    shin: "right_lower_leg",
    achilles: "right_lower_leg",
    ankle: "right_ankle_foot",
    heel: "right_ankle_foot",
    arch: "right_ankle_foot",
    toes: "right_ankle_foot",
  },
};

const regionLabelMap = new Map<BodyRegionId, string>([
  ["head_neck", "Head/Neck"],
  ["left_shoulder", "Left Shoulder"],
  ["right_shoulder", "Right Shoulder"],
  ["shoulders", "Shoulders"],
  ["chest", "Chest"],
  ["abdomen", "Abdomen"],
  ["upper_back", "Upper Back"],
  ["lower_back", "Lower Back"],
  ["left_hip", "Left Hip"],
  ["right_hip", "Right Hip"],
  ["hips_glutes", "Hips/Glutes"],
  ["left_upper_leg", "Left Upper Leg"],
  ["right_upper_leg", "Right Upper Leg"],
  ["left_knee", "Left Knee"],
  ["right_knee", "Right Knee"],
  ["left_lower_leg", "Left Lower Leg"],
  ["right_lower_leg", "Right Lower Leg"],
  ["left_ankle_foot", "Left Foot"],
  ["right_ankle_foot", "Right Foot"],
  ["back", "Back"],
  ["hips", "Hips"],
]);

const painLabelMap = new Map<PainLocationId, string>(painOptions.map((point) => [point.id, point.shortLabel]));
const groupedPainOptions = {
  Hip: painOptions.filter((point) => point.group === "Hip"),
  "Upper Leg": painOptions.filter((point) => point.group === "Upper Leg"),
  Knee: painOptions.filter((point) => point.group === "Knee"),
  "Lower Leg": painOptions.filter((point) => point.group === "Lower Leg"),
  Foot: painOptions.filter((point) => point.group === "Foot"),
};

function isLegRegion(regionId: BodyRegionId): regionId is "left_upper_leg" | "left_knee" | "left_lower_leg" | "left_ankle_foot" | "right_upper_leg" | "right_knee" | "right_lower_leg" | "right_ankle_foot" {
  return (
    regionId === "left_upper_leg" ||
    regionId === "left_knee" ||
    regionId === "left_lower_leg" ||
    regionId === "left_ankle_foot" ||
    regionId === "right_upper_leg" ||
    regionId === "right_knee" ||
    regionId === "right_lower_leg" ||
    regionId === "right_ankle_foot"
  );
}

function sideForRegion(regionId: BodyRegionId): "left" | "right" | null {
  if (regionId.startsWith("left_")) return "left";
  if (regionId.startsWith("right_")) return "right";
  return null;
}

export function BodyCheckSection({ value, onChange, showHeader = true }: BodyCheckSectionProps) {
  const [activeRegion, setActiveRegion] = useState<BodyRegionId | null>(null);
  const [draftEntries, setDraftEntries] = useState<RunHealthCheckEntry[]>([]);
  const [mapView, setMapView] = useState<"front" | "back">("front");

  const selectedRegions = useMemo(() => {
    const selected = new Set<BodyRegionId>(value.entries.map((entry) => entry.region));
    if (activeRegion) {
      selected.add(activeRegion);
    }
    return selected;
  }, [value.entries, activeRegion]);

  const selectedRegionList = useMemo(() => [...selectedRegions], [selectedRegions]);

  const sortedEntries = useMemo(() => {
    return [...value.entries].sort((a, b) => {
      const regionDelta = regionOrder[a.region] - regionOrder[b.region];
      if (regionDelta !== 0) return regionDelta;
      return painOptions.findIndex((point) => point.id === a.location) - painOptions.findIndex((point) => point.id === b.location);
    });
  }, [value.entries]);

  function upsertDraftEntry(side: "left" | "right", location: PainLocationId) {
    const id = `${side}:${location}`;
    const exists = draftEntries.some((entry) => entry.id === id);
    if (exists) {
      setDraftEntries((prev) => prev.filter((entry) => entry.id !== id));
      return;
    }

    const nextEntry: RunHealthCheckEntry = {
      id,
      side,
      location,
      region: painPointRegionBySide[side][location],
      severity: 4,
      painType: "soreness",
      timing: "during run",
      trend: "stayed same",
      notes: "",
    };

    setDraftEntries((prev) => [...prev, nextEntry]);
  }

  function updateDraftEntry(id: string, updates: Partial<RunHealthCheckEntry>) {
    setDraftEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
  }

  function openRegion(regionId: BodyRegionId) {
    setActiveRegion(regionId);
    const side = sideForRegion(regionId);
    if (!side) {
      setDraftEntries([]);
      return;
    }
    setDraftEntries(value.entries.filter((entry) => entry.side === side));
  }

  function closeModal() {
    setActiveRegion(null);
    setDraftEntries([]);
  }

  function saveModal() {
    if (!activeRegion) {
      return;
    }
    const side = sideForRegion(activeRegion);
    if (!side) {
      closeModal();
      return;
    }
    const persistedWithoutSide = value.entries.filter((entry) => entry.side !== side);
    onChange({ entries: [...persistedWithoutSide, ...draftEntries] });
    closeModal();
  }

  function removeEntry(id: string) {
    onChange({ entries: value.entries.filter((entry) => entry.id !== id) });
  }

  const activeSide = activeRegion ? sideForRegion(activeRegion) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-linear-to-b from-slate-900 to-slate-950 p-4 dark:border-slate-700">
      {showHeader ? (
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-100">Body Check</h3>
          <p className="text-xs text-slate-300">Tap a body region, choose locations, and save.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Body map</p>
          <button
            type="button"
            onClick={() => setMapView((current) => (current === "front" ? "back" : "front"))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Show {mapView === "front" ? "Back" : "Front"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <p className="mb-3 text-center text-sm font-semibold text-slate-400">{mapView.toUpperCase()}</p>
          <BodyMap
            view={mapView}
            selectedRegions={selectedRegionList}
            onRegionClick={openRegion}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Selected areas</p>
        {sortedEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900 p-2 text-xs text-slate-400">
            No pain locations selected.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedEntries.map((entry) => {
              const locationLabel = painLabelMap.get(entry.location) ?? entry.location;
              const timingLabel =
                entry.timing === "before run"
                  ? "Before"
                  : entry.timing === "during run"
                    ? "During"
                    : "After";
              const display = `${entry.side === "left" ? "Left" : "Right"} ${locationLabel} • ${entry.severity}/10 • ${timingLabel}`;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                >
                  <span>{display}</span>
                  <button
                    type="button"
                    onClick={() => openRegion(entry.region)}
                    className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-full bg-rose-900/40 px-2 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-900/60"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeRegion ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center" onClick={closeModal}>
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{regionLabelMap.get(activeRegion) ?? "Body Region"}</h4>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {isLegRegion(activeRegion) && activeSide ? (
              <LegRegionModal
                side={activeSide}
                entries={draftEntries}
                onToggleLocation={(location) => upsertDraftEntry(activeSide, location)}
                onUpdateEntry={updateDraftEntry}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Detailed location tracking for this area will be added in a future update.
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveModal}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LegRegionModal({
  side,
  entries,
  onToggleLocation,
  onUpdateEntry,
}: {
  side: "left" | "right";
  entries: RunHealthCheckEntry[];
  onToggleLocation: (location: PainLocationId) => void;
  onUpdateEntry: (id: string, updates: Partial<RunHealthCheckEntry>) => void;
}) {
  const activeIds = new Set(entries.map((entry) => entry.location));

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{side === "left" ? "Left" : "Right"} leg</p>

      <div className="space-y-3">
        {(Object.keys(groupedPainOptions) as Array<keyof typeof groupedPainOptions>).map((groupName) => (
          <section key={groupName} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{groupName}</p>
            <div className="flex flex-wrap gap-2">
              {groupedPainOptions[groupName].map((option) => {
                const selected = activeIds.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onToggleLocation(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            Select one or more locations above.
          </p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{painLabelMap.get(entry.location)}</p>

              <label className="space-y-1 text-xs">
                <span className="text-slate-600 dark:text-slate-300">Severity: {entry.severity}/10</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={entry.severity}
                  onChange={(event) => onUpdateEntry(entry.id, { severity: Number(event.target.value) })}
                  className="w-full"
                />
              </label>

              <div className="space-y-1">
                <p className="text-xs text-slate-600 dark:text-slate-300">Pain type</p>
                <div className="flex flex-wrap gap-2">
                  {painTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onUpdateEntry(entry.id, { painType: type })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        entry.painType === type
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-600 dark:text-slate-300">Timing</p>
                <div className="flex flex-wrap gap-2">
                  {painTimings.map((timing) => (
                    <button
                      key={timing}
                      type="button"
                      onClick={() => onUpdateEntry(entry.id, { timing })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        entry.timing === timing
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-200"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {timing}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
