"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_GOALS, DEFAULT_ROUTINES } from "@/lib/defaults";
import type { Goals, Preferences, RunLog, StretchRoutine, TrainingRecommendation, TrainingPlanMetadata } from "@/lib/types";
import { inferTrainingPlanMetadata } from "@/lib/aiData";
import { TrainingPlanMetadataModal } from "./TrainingPlanMetadataModal";

type RunTrackContextValue = {
  runs: RunLog[];
  trainingRecommendations: TrainingRecommendation[];
  trainingPlanName: string | null;
  goals: Goals;
  preferences: Preferences;
  routines: StretchRoutine[];
  addRun: (run: Omit<RunLog, "id" | "createdAt">) => void;
  updateRun: (id: string, run: Omit<RunLog, "id" | "createdAt">) => void;
  updateRunAiSummary: (id: string, summary: string, signals?: string[]) => void;
  replaceTrainingRecommendations: (planName: string, recommendations: Omit<TrainingRecommendation, "id">[]) => Promise<void>;
  clearTrainingPlan: () => void;
  deleteRun: (id: string) => void;
  updateGoals: (next: Goals) => void;
  updateTrainingPlanMetadata: (metadata: Partial<TrainingPlanMetadata>) => void;
  updatePreferences: (next: Partial<Preferences>) => void;
  updateRoutines: (next: StretchRoutine[]) => void;
  clearAllData: () => void;
};

const DEFAULT_PREFERENCES: Preferences = {
  darkMode: false,
  unit: "miles",
};

const RunTrackContext = createContext<RunTrackContextValue | undefined>(undefined);

function extractSorenessNotes(run: Omit<RunLog, "id" | "createdAt"> | RunLog): string[] {
  const notes: string[] = [];

  if (run.notes.trim()) {
    notes.push(run.notes.trim());
  }

  for (const entry of run.bodyCheck?.entries ?? []) {
    const parts = [entry.location, entry.painType, entry.notes].filter(Boolean);
    if (parts.length > 0) {
      notes.push(parts.join(" "));
    }
  }

  return notes.slice(0, 8);
}

export function RunTrackProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [trainingRecommendations, setTrainingRecommendations] = useState<TrainingRecommendation[]>([]);
  const [trainingPlanName, setTrainingPlanName] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [routines, setRoutines] = useState<StretchRoutine[]>(DEFAULT_ROUTINES);
  const [hydrated, setHydrated] = useState(false);

  // Modal state for training plan metadata confirmation
  const [showPlanMetadataModal, setShowPlanMetadataModal] = useState(false);
  const [pendingPlanName, setPendingPlanName] = useState<string>("");
  const [pendingRecommendations, setPendingRecommendations] = useState<TrainingRecommendation[]>([]);
  const [inferredMetadata, setInferredMetadata] = useState<Partial<TrainingPlanMetadata>>({});

  useEffect(() => {
    let canceled = false;

    async function loadUserData() {
      try {
        const response = await fetch("/api/user-data", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          runs?: RunLog[];
          trainingRecommendations?: TrainingRecommendation[];
          trainingPlanName?: string | null;
          goals?: Goals;
          preferences?: Preferences;
          routines?: StretchRoutine[];
        };

        if (canceled) return;

        const incomingRoutines = data.routines ?? DEFAULT_ROUTINES;
        const resolvedRoutines = incomingRoutines.map((routine) => {
          if (routine.id !== "routine-default") {
            return routine;
          }

          if (routine.name === "Post Run Mobility") {
            return {
              ...routine,
              name: "Post Run Stretch",
            };
          }

          const looksLikeLegacyDefaultRoutine =
            routine.items.some((item) => item.name === "Neck Stretch") ||
            routine.items.some((item) => /\(\d+\)$/.test(item.name));

          if (!looksLikeLegacyDefaultRoutine) {
            return routine;
          }

          return DEFAULT_ROUTINES.find((item) => item.id === "routine-default") ?? routine;
        });

        setRuns(data.runs ?? []);
        setTrainingRecommendations(data.trainingRecommendations ?? []);
        setTrainingPlanName(data.trainingPlanName ?? null);
        setGoals(data.goals ?? DEFAULT_GOALS);
        setPreferences(data.preferences ?? DEFAULT_PREFERENCES);
        setRoutines(resolvedRoutines);
      } finally {
        if (!canceled) {
          setHydrated(true);
        }
      }
    }

    loadUserData();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    document.documentElement.classList.toggle("dark", preferences.darkMode);
  }, [preferences, hydrated]);

  const persistUserData = useCallback(
    async (partial: {
      runs?: RunLog[];
      trainingRecommendations?: TrainingRecommendation[];
      trainingPlanName?: string | null;
      goals?: Goals;
      preferences?: Preferences;
      routines?: StretchRoutine[];
    }) => {
      if (!hydrated) return;

      const res = await fetch("/api/user-data", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        throw new Error(`Failed to save data (${res.status})`);
      }
    },
    [hydrated]
  );

  const generateRunSummary = useCallback(async (run: Omit<RunLog, "id" | "createdAt"> | RunLog) => {
    const response = await fetch("/api/ai/run-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        distance: run.distanceMiles,
        duration: run.durationMinutes,
        pace: run.paceMinPerMile,
        runType: run.runType,
        notes: run.notes,
        sorenessNotes: extractSorenessNotes(run),
        effortLevel: run.energyLevel,
        weather: run.structuredNotes?.weather ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate run summary.");
    }

    const data = (await response.json()) as { summary?: string; signals?: string[] };
    if (!data.summary || typeof data.summary !== "string") {
      throw new Error("Run summary response missing summary text.");
    }

    return {
      summary: data.summary.trim(),
      signals: Array.isArray(data.signals)
        ? data.signals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : [],
    };
  }, []);

  const addRun = useCallback((run: Omit<RunLog, "id" | "createdAt">) => {
    const next: RunLog = {
      ...run,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    setRuns((prev) => {
      const updated = [next, ...prev];
      void persistUserData({ runs: updated });
      return updated;
    });

    void generateRunSummary(next)
      .then((result) => {
        setRuns((prev) => {
          const updated = prev.map((item) =>
            item.id === next.id
              ? {
                  ...item,
                  aiSummary: result.summary,
                  aiSignals: result.signals,
                }
              : item
          );
          void persistUserData({ runs: updated });
          return updated;
        });
      })
      .catch(() => undefined);
  }, [generateRunSummary, persistUserData]);

  const deleteRun = useCallback((id: string) => {
    setRuns((prev) => {
      const updated = prev.filter((run) => run.id !== id);
      void persistUserData({ runs: updated });
      return updated;
    });
  }, [persistUserData]);

  const updateRun = useCallback((id: string, run: Omit<RunLog, "id" | "createdAt">) => {
    setRuns((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...run,
              id,
              createdAt: item.createdAt,
              aiSummary: item.aiSummary,
              aiSignals: item.aiSignals,
              structuredNotes: item.structuredNotes,
            }
          : item
      );
      void persistUserData({ runs: updated });
      return updated;
    });
  }, [persistUserData]);

  const updateRunAiSummary = useCallback((id: string, summary: string, signals: string[] = []) => {
    setRuns((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              aiSummary: summary,
              aiSignals: signals,
            }
          : item
      );
      void persistUserData({ runs: updated });
      return updated;
    });
  }, [persistUserData]);

  const replaceTrainingRecommendations = useCallback(
    async (planName: string, recommendations: Omit<TrainingRecommendation, "id">[]) => {
      const next = recommendations
        .map((recommendation) => ({
          ...recommendation,
          id: crypto.randomUUID(),
        }))
        .sort((a, b) => +new Date(a.date) - +new Date(b.date));
      const nextName = planName.trim() || "Untitled Plan";

      // Infer metadata from the plan
      const metadata = inferTrainingPlanMetadata(nextName, next);

      // Store pending data and show modal for user confirmation
      setPendingPlanName(nextName);
      setPendingRecommendations(next);
      setInferredMetadata(metadata);
      setShowPlanMetadataModal(true);
    },
    []
  );

  const confirmTrainingPlanMetadata = useCallback(
    async (metadata: Partial<TrainingPlanMetadata>) => {
      setTrainingPlanName(pendingPlanName);
      setTrainingRecommendations(pendingRecommendations);

      setGoals((prev) => {
        const updated = {
          ...prev,
          trainingPlan: {
            ...prev.trainingPlan,
            ...metadata,
          },
        };
        void persistUserData({
          trainingPlanName: pendingPlanName,
          trainingRecommendations: pendingRecommendations,
          goals: updated,
        });
        return updated;
      });

      // Clear modal state
      setShowPlanMetadataModal(false);
      setPendingPlanName("");
      setPendingRecommendations([]);
      setInferredMetadata({});
    },
    [pendingPlanName, pendingRecommendations, persistUserData]
  );

  const cancelTrainingPlanMetadata = useCallback(() => {
    setShowPlanMetadataModal(false);
    setPendingPlanName("");
    setPendingRecommendations([]);
    setInferredMetadata({});
  }, []);

  const clearTrainingPlan = useCallback(() => {
    setTrainingRecommendations([]);
    setTrainingPlanName(null);
    void persistUserData({ trainingRecommendations: [], trainingPlanName: null });
  }, [persistUserData]);

  const updateGoals = useCallback((next: Goals) => {
    setGoals(next);
    void persistUserData({ goals: next });
  }, [persistUserData]);

  const updateTrainingPlanMetadata = useCallback((metadata: Partial<TrainingPlanMetadata>) => {
    setGoals((prev) => {
      const updated = {
        ...prev,
        trainingPlan: {
          ...prev.trainingPlan,
          ...metadata,
        },
      };
      void persistUserData({ goals: updated });
      return updated;
    });
  }, [persistUserData]);

  const updatePreferences = useCallback((next: Partial<Preferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...next };
      void persistUserData({ preferences: updated });
      return updated;
    });
  }, [persistUserData]);

  const updateRoutines = useCallback((next: StretchRoutine[]) => {
    setRoutines(next);
    void persistUserData({ routines: next });
  }, [persistUserData]);

  const clearAllData = useCallback(() => {
    setRuns([]);
    setTrainingRecommendations([]);
    setTrainingPlanName(null);
    setGoals(DEFAULT_GOALS);
    setPreferences(DEFAULT_PREFERENCES);
    setRoutines(DEFAULT_ROUTINES);

    void fetch("/api/user-data", { method: "DELETE" }).catch(() => undefined);
  }, []);

  const value = useMemo<RunTrackContextValue>(
    () => ({
      runs,
      trainingRecommendations,
      trainingPlanName,
      goals,
      preferences,
      routines,
      addRun,
      updateRun,
      updateRunAiSummary,
      replaceTrainingRecommendations,
      clearTrainingPlan,
      deleteRun,
      updateGoals,
      updateTrainingPlanMetadata,
      updatePreferences,
      updateRoutines,
      clearAllData,
    }),
    [
      runs,
      trainingRecommendations,
      trainingPlanName,
      goals,
      preferences,
      routines,
      addRun,
      updateRun,
      updateRunAiSummary,
      replaceTrainingRecommendations,
      clearTrainingPlan,
      deleteRun,
      updateGoals,
      updateTrainingPlanMetadata,
      updatePreferences,
      updateRoutines,
      clearAllData,
    ]
  );

  return (
    <>
      <RunTrackContext.Provider value={value}>{children}</RunTrackContext.Provider>
      <TrainingPlanMetadataModal
        isOpen={showPlanMetadataModal}
        planName={pendingPlanName}
        inferred={inferredMetadata}
        onConfirm={confirmTrainingPlanMetadata}
        onCancel={cancelTrainingPlanMetadata}
      />
    </>
  );
}

export function useRunTrack() {
  const context = useContext(RunTrackContext);
  if (!context) {
    throw new Error("useRunTrack must be used within RunTrackProvider");
  }
  return context;
}
