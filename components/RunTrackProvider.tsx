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
import type { Goals, PlanCheckResult, Preferences, RunLog, StretchRoutine, TrainingRecommendation, TrainingPlanMetadata } from "@/lib/types";
import { inferTrainingPlanMetadata } from "@/lib/aiData";
import { fallbackRunTitle } from "@/lib/aiFallbacks";
import { TrainingPlanMetadataModal } from "./TrainingPlanMetadataModal";

type RunAiSummaryUpdate = {
  title?: string;
  summary: string;
  signals?: string[];
};

type RunTrackContextValue = {
  runs: RunLog[];
  trainingRecommendations: TrainingRecommendation[];
  trainingPlanName: string | null;
  goals: Goals;
  preferences: Preferences;
  routines: StretchRoutine[];
  addRun: (run: Omit<RunLog, "id" | "createdAt">) => void;
  updateRun: (id: string, run: Omit<RunLog, "id" | "createdAt">) => void;
  updateRunAiSummary: (id: string, next: RunAiSummaryUpdate) => void;
  updateRunPlanCheck: (id: string, next: PlanCheckResult) => void;
  replaceTrainingRecommendations: (planName: string, recommendations: Omit<TrainingRecommendation, "id">[]) => Promise<void>;
  updateTrainingRecommendationAiCoachNote: (id: string, aiCoachNote: string) => void;
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

const WEEKLY_INSIGHTS_REFRESH_KEY = "runtrack:weekly-insights-refresh";

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

function looksLikeLegacyDefaultRoutine(routine: StretchRoutine): boolean {
  // Legacy placeholder data included "Neck Stretch" and several numbered labels.
  const hasNeckStretch = routine.items.some((item) => item.name.trim().toLowerCase() === "neck stretch");
  const numberedNameCount = routine.items.filter((item) => /\(\d+\)$/.test(item.name)).length;
  return hasNeckStretch && numberedNameCount >= 2;
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
        let routinesWereMigrated = false;
        let recommendationsWereMigrated = false;
        const resolvedRecommendations = (data.trainingRecommendations ?? []).map((recommendation) => {
          const legacyRecommendation = recommendation as TrainingRecommendation & { aiWorkoutRecommendation?: string };
          if (recommendation.aiCoachNote?.trim() || !legacyRecommendation.aiWorkoutRecommendation?.trim()) {
            return recommendation;
          }

          recommendationsWereMigrated = true;
          return {
            ...recommendation,
            aiCoachNote: legacyRecommendation.aiWorkoutRecommendation.trim().startsWith("AI Coach:")
              ? legacyRecommendation.aiWorkoutRecommendation.trim()
              : `AI Coach: ${legacyRecommendation.aiWorkoutRecommendation.trim()}`,
          };
        });

        const resolvedRoutines = incomingRoutines.map((routine) => {
          if (routine.id !== "routine-default") {
            return routine;
          }

          const isLegacyDefault = looksLikeLegacyDefaultRoutine(routine);

          if (isLegacyDefault) {
            routinesWereMigrated = true;
            return DEFAULT_ROUTINES.find((item) => item.id === "routine-default") ?? routine;
          }

          if (routine.name === "Post Run Mobility") {
            routinesWereMigrated = true;
            return {
              ...routine,
              name: "Post Run Stretch",
            };
          }

          return routine;
        });

        setRuns(data.runs ?? []);
  setTrainingRecommendations(resolvedRecommendations);
        setTrainingPlanName(data.trainingPlanName ?? null);
        setGoals(data.goals ?? DEFAULT_GOALS);
        setPreferences(data.preferences ?? DEFAULT_PREFERENCES);
        setRoutines(resolvedRoutines);

        if (routinesWereMigrated) {
          void fetch("/api/user-data", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ routines: resolvedRoutines }),
          }).catch(() => undefined);
        }

        if (recommendationsWereMigrated) {
          void fetch("/api/user-data", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trainingRecommendations: resolvedRecommendations }),
          }).catch(() => undefined);
        }
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

    const data = (await response.json()) as { title?: string; summary?: string; signals?: string[] };
    if (!data.title || typeof data.title !== "string" || !data.summary || typeof data.summary !== "string") {
      throw new Error("Run summary response missing title or summary text.");
    }

    return {
      title: data.title.trim(),
      summary: data.summary.trim(),
      signals: Array.isArray(data.signals)
        ? data.signals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : [],
    };
  }, []);

  const generatePlanCheckForRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/ai/plan-check?runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to generate plan check.");
    }

    const data = (await response.json()) as {
      payload?: {
        status?: PlanCheckResult["status"];
        summary?: string;
        score?: number;
      } | null;
    };

    const payload = data.payload;
    if (!payload) {
      return null;
    }

    if (typeof payload.status !== "string" || typeof payload.summary !== "string" || typeof payload.score !== "number") {
      throw new Error("Plan check response missing required fields.");
    }

    return {
      status: payload.status,
      summary: payload.summary.trim(),
      score: Math.max(0, Math.min(100, Math.round(payload.score))),
    } satisfies PlanCheckResult;
  }, []);

  const addRun = useCallback((run: Omit<RunLog, "id" | "createdAt">) => {
    const next: RunLog = {
      ...run,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: run.title.trim() || fallbackRunTitle({ distanceMiles: run.distanceMiles, runType: run.runType }),
    };

    setRuns((prev) => {
      const updated = [next, ...prev];
      void persistUserData({ runs: updated })
        .then(() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(WEEKLY_INSIGHTS_REFRESH_KEY, "1");
          }

          void generatePlanCheckForRun(next.id)
            .then((result) => {
              if (!result) {
                return;
              }

              setRuns((currentRuns) => {
                const nextRuns = currentRuns.map((item) =>
                  item.id === next.id ? { ...item, planCheck: result } : item
                );
                void persistUserData({ runs: nextRuns });
                return nextRuns;
              });
            })
            .catch(() => undefined);
        })
        .catch(() => undefined);
      return updated;
    });

    void generateRunSummary(next)
      .then((result) => {
        setRuns((prev) => {
          const updated = prev.map((item) =>
            item.id === next.id
              ? {
                  ...item,
                  title: result.title,
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
  }, [generatePlanCheckForRun, generateRunSummary, persistUserData]);

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
              planCheck: item.planCheck,
              structuredNotes: item.structuredNotes,
            }
          : item
      );
      void persistUserData({ runs: updated });
      return updated;
    });
  }, [persistUserData]);

  const updateRunAiSummary = useCallback((id: string, next: RunAiSummaryUpdate) => {
    setRuns((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: next.title?.trim() || item.title,
              aiSummary: next.summary,
              aiSignals: next.signals ?? [],
            }
          : item
      );
      void persistUserData({ runs: updated });
      return updated;
    });
  }, [persistUserData]);

  const updateRunPlanCheck = useCallback((id: string, next: PlanCheckResult) => {
    setRuns((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              planCheck: next,
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

  const updateTrainingRecommendationAiCoachNote = useCallback((id: string, aiCoachNote: string) => {
    setTrainingRecommendations((prev) => {
      const updated = prev.map((recommendation) =>
        recommendation.id === id
          ? {
              ...recommendation,
              aiCoachNote,
            }
          : recommendation
      );
      void persistUserData({ trainingRecommendations: updated });
      return updated;
    });
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
      updateRunPlanCheck,
      replaceTrainingRecommendations,
      updateTrainingRecommendationAiCoachNote,
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
      updateRunPlanCheck,
      replaceTrainingRecommendations,
      updateTrainingRecommendationAiCoachNote,
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
