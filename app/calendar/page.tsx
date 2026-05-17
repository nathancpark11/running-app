"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRunTrack } from "@/components/RunTrackProvider";
import { PlannedRunEditModal } from "@/components/PlannedRunEditModal";
import { formatDuration, formatPace } from "@/lib/format";
import type { PlanCheckResult, RunLog, TrainingRecommendation } from "@/lib/types";

type WorkoutSection = {
  label: "Warm Up" | "Main Set" | "Cool Down";
  content: string;
};

type DayPlanCheckTone = "success" | "partial" | "missed" | "unplanned";

type DayPlanCheck = {
  tone: DayPlanCheckTone;
  status: string;
  summary: string;
  suggestion: string;
};

type PlanCheckStatus = "completed_as_planned" | "mostly_completed" | "overperformed" | "underperformed" | "missed" | "needs_review";

type PlanCheckCard = {
  status: PlanCheckStatus;
  summary: string;
  score: number;
};

function resolveStoredPlanCheck(dayRuns: RunLog[], dayRecommendations: TrainingRecommendation[]): PlanCheckCard | null {
  if (dayRuns.length === 0) {
    return null;
  }

  const preferredRun =
    dayRecommendations.length > 0
      ? dayRuns.find((run) => run.runType === dayRecommendations[0].runType)
      : dayRuns[0];

  const runWithPlanCheck =
    preferredRun?.planCheck
      ? preferredRun
      : dayRuns.find((run) => Boolean(run.planCheck));

  const planCheck = runWithPlanCheck?.planCheck;
  if (!planCheck) {
    return null;
  }

  return {
    status: planCheck.status,
    summary: planCheck.summary,
    score: planCheck.score,
  };
}

function normalizeWorkoutSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingPeriods = trimmed.replace(/\.(?=\s|$)/g, "");
  return withoutTrailingPeriods.charAt(0).toUpperCase() + withoutTrailingPeriods.slice(1);
}

function parseWorkoutSections(notes: string): WorkoutSection[] {
  const normalized = notes.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const withoutMilesPreface = normalized.replace(/^\s*\d+(?:\.\d+)?\s*(?:mi|mile|miles)\s+total\.?\s*/i, "");

  const sectionRegex = /(Warm\s*Up|Main\s*Set|Cool\s*Down)\s*:??\s*/gi;
  const matches = [...withoutMilesPreface.matchAll(sectionRegex)];

  if (matches.length === 0) {
    return [];
  }

  const sections: WorkoutSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? withoutMilesPreface.length;
    const rawHeading = (match[1] ?? "").toLowerCase().replace(/\s+/g, "");
    const content = normalizeWorkoutSentence(withoutMilesPreface.slice(start, end).trim().replace(/^[:\-\s]+/, ""));

    if (!content) {
      continue;
    }

    const label: WorkoutSection["label"] =
      rawHeading === "warmup" ? "Warm Up" : rawHeading === "mainset" ? "Main Set" : "Cool Down";
    sections.push({ label, content });
  }

  return sections;
}

function extractMainSetContent(notes: string): string {
  const sections = parseWorkoutSections(notes);
  const mainSet = sections.find((section) => section.label === "Main Set");
  if (mainSet) {
    return mainSet.content;
  }

  return notes.trim();
}

function hasClearMainSetTarget(notes: string, targetPace?: string): boolean {
  const mainSet = extractMainSetContent(notes);
  if (!mainSet) {
    return false;
  }

  const hasDuration =
    /(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:min|mins|minute|minutes)/i.test(mainSet)
    || /\b\d{1,2}\s*(?:min|mins|minute|minutes)\b/i.test(mainSet);

  const hasPace =
    /(\d{1,2}(?:\.\d)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d)?)\s*(?:mph)?/i.test(mainSet)
    || /(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:\/mi|min\/mi|per mile)/i.test(mainSet)
    || Boolean(targetPace?.trim());

  return hasDuration && hasPace;
}

function keyForDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKeyToLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function keyForRunDate(value: string): string {
  const directKeyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directKeyMatch) {
    return directKeyMatch[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return keyForDate(parsed);
}

function shiftIsoDateByDays(value: string, days: number): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function isDateKeyInRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

function weekStartKeyForDate(value: Date): string {
  const day = new Date(value);
  const mondayOffset = (day.getDay() + 6) % 7;
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - mondayOffset);
  return keyForDate(day);
}

function formatWeekOverWeekChange(current: number, previous: number): string {
  if (previous === 0) {
    if (current === 0) {
      return "0%";
    }
    return "N/A";
  }

  const percent = ((current - previous) / previous) * 100;
  const rounded = Math.round(percent);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function resolveAiCoachNoteForRecommendation(recommendation: { aiCoachNote?: string }): string | null {
  const coachNote = recommendation.aiCoachNote?.trim();
  if (coachNote) {
    return coachNote;
  }

  return null;
}

function isQualityWorkout(runType: TrainingRecommendation["runType"]): boolean {
  return runType === "Tempo" || runType === "Intervals" || runType === "Hills" || runType === "Race";
}

function getNextRunSuggestion(runType: TrainingRecommendation["runType"], tone: DayPlanCheckTone): string {
  if (tone === "success") {
    switch (runType) {
      case "Long":
        return "Next long run: add 0.5-1.0 mi only if recovery feels good.";
      case "Tempo":
      case "Intervals":
      case "Hills":
        return "Next session: keep quality high and add one short repeat if effort stayed controlled.";
      case "Easy":
      case "Recovery":
      case "Endurance":
        return "Next run: keep effort easy and add 5-10 minutes if legs feel fresh.";
      case "Race":
        return "Next race-focused run: keep volume steady and prioritize race-pace control.";
      case "Hike":
        return "Next hike: keep cadence steady and add gradual elevation only if soreness stays low.";
      default:
        return "Next run: keep progression small and consistent.";
    }
  }

  if (tone === "missed") {
    return `Next ${runType.toLowerCase()} run: prioritize completion over pace and start slightly conservative.`;
  }

  return `Next ${runType.toLowerCase()} run: match the planned type first, then build back to full volume.`;
}

function findBestMatchingRun(recommendation: TrainingRecommendation, runs: RunLog[]): RunLog | null {
  if (runs.length === 0) {
    return null;
  }

  const sameTypeRuns = runs.filter((run) => run.runType === recommendation.runType);
  if (sameTypeRuns.length > 0) {
    return sameTypeRuns.reduce((best, current) =>
      current.distanceMiles > best.distanceMiles ? current : best
    );
  }

  return runs.reduce((best, current) =>
    current.distanceMiles > best.distanceMiles ? current : best
  );
}

function resolveDisplayedWorkoutMileage(recommendation: TrainingRecommendation, dayRuns: RunLog[]): number | null {
  const matchedRun = findBestMatchingRun(recommendation, dayRuns);
  if (matchedRun && typeof matchedRun.distanceMiles === "number" && matchedRun.distanceMiles > 0) {
    return matchedRun.distanceMiles;
  }

  if (typeof recommendation.distanceMiles === "number" && recommendation.distanceMiles > 0) {
    return recommendation.distanceMiles;
  }

  return null;
}

function buildDayPlanCheck(dayRuns: RunLog[], dayRecommendations: TrainingRecommendation[]): DayPlanCheck | null {
  if (dayRuns.length === 0 && dayRecommendations.length === 0) {
    return null;
  }

  if (dayRecommendations.length === 0) {
    const primaryRun = dayRuns[0];
    return {
      tone: "unplanned",
      status: "Completed (unplanned)",
      summary: `Logged a ${primaryRun.runType.toLowerCase()} run with no planned workout for the day.`,
      suggestion: getNextRunSuggestion(primaryRun.runType, "unplanned"),
    };
  }

  const primaryRecommendation = dayRecommendations[0];

  if (dayRuns.length === 0) {
    return {
      tone: "missed",
      status: "Not completed",
      summary: `Planned ${primaryRecommendation.runType.toLowerCase()} workout was not logged.`,
      suggestion: getNextRunSuggestion(primaryRecommendation.runType, "missed"),
    };
  }

  const matchedRun = findBestMatchingRun(primaryRecommendation, dayRuns);
  if (!matchedRun) {
    return {
      tone: "partial",
      status: "Partially completed",
      summary: `Run logged, but it did not match the planned ${primaryRecommendation.runType.toLowerCase()} workout.`,
      suggestion: getNextRunSuggestion(primaryRecommendation.runType, "partial"),
    };
  }

  const typeMatched = matchedRun.runType === primaryRecommendation.runType;
  const meetsDistance =
    typeof primaryRecommendation.distanceMiles !== "number"
    || primaryRecommendation.distanceMiles <= 0
    || matchedRun.distanceMiles >= primaryRecommendation.distanceMiles * 0.85;
  const meetsDuration =
    typeof primaryRecommendation.durationMinutes !== "number"
    || primaryRecommendation.durationMinutes <= 0
    || matchedRun.durationMinutes >= primaryRecommendation.durationMinutes * 0.85;

  const wasSuccessful = typeMatched && meetsDistance && meetsDuration;

  if (wasSuccessful) {
    return {
      tone: "success",
      status: "Completed as planned",
      summary: `Planned ${primaryRecommendation.runType.toLowerCase()} workout was completed with similar volume.`,
      suggestion: getNextRunSuggestion(primaryRecommendation.runType, "success"),
    };
  }

  const mismatchReason = !typeMatched
    ? `logged ${matchedRun.runType.toLowerCase()} instead`
    : !meetsDistance && !meetsDuration
    ? "lower distance and duration"
    : !meetsDistance
    ? "lower distance"
    : "shorter duration";

  return {
    tone: "partial",
    status: "Partially completed",
    summary: `Planned ${primaryRecommendation.runType.toLowerCase()} workout was modified (${mismatchReason}).`,
    suggestion: getNextRunSuggestion(primaryRecommendation.runType, "partial"),
  };
}

export default function CalendarPage() {
  // All state/hooks must be declared first!
  // (removed duplicate useRunTrack destructuring)
  // (removed duplicate todayKey declaration)
  const [view, setView] = useState<"week" | "month">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [tempoAtPaceByDate, setTempoAtPaceByDate] = useState<Record<string, string>>({});
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [draftRecommendations, setDraftRecommendations] = useState<TrainingRecommendation[] | null>(null);
  const [editHistory, setEditHistory] = useState<TrainingRecommendation[][]>([]);
  const [editStatusMessage, setEditStatusMessage] = useState<string>("");
  const editStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedTempoDateKeysRef = useRef<Set<string>>(new Set());
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  // Multi-day swap state
  const [selectedSwapDays, setSelectedSwapDays] = useState<string[]>([]);
  const [swapTargetDays, setSwapTargetDays] = useState<string[]>([]);
  const [isSelectingSwapTargets, setIsSelectingSwapTargets] = useState(false);
  const [moveConflictStrategy, setMoveConflictStrategy] = useState<"override" | "swap">("override");
  const [weekCardSourceIndex, setWeekCardSourceIndex] = useState<number | null>(null);
  const [weekCardTargetIndex, setWeekCardTargetIndex] = useState<number | null>(null);
  // Reset swap state when edit mode changes or week changes
  useEffect(() => {
    setSelectedSwapDays([]);
    setSwapTargetDays([]);
    setIsSelectingSwapTargets(false);
    setMoveConflictStrategy("override");
    setWeekCardSourceIndex(null);
    setWeekCardTargetIndex(null);
  }, [isEditingPlan, weekOffset]);

  useEffect(() => {
    return () => {
      if (editStatusTimeoutRef.current) {
        clearTimeout(editStatusTimeoutRef.current);
      }
    };
  }, []);

  function setTemporaryEditStatus(message: string, timeoutMs = 4000) {
    if (editStatusTimeoutRef.current) {
      clearTimeout(editStatusTimeoutRef.current);
    }

    setEditStatusMessage(message);
    editStatusTimeoutRef.current = setTimeout(() => {
      setEditStatusMessage("");
      editStatusTimeoutRef.current = null;
    }, timeoutMs);
  }
    function toggleSwapDay(key: string) {
      setWeekCardSourceIndex(null);
      setWeekCardTargetIndex(null);
      setSelectedSwapDays((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    }

    function toggleSwapTargetDay(key: string) {
      setSwapTargetDays((prev) =>
        prev.includes(key)
          ? prev.filter((k) => k !== key)
          : prev.length < selectedSwapDays.length
          ? [...prev, key]
          : prev
      );
    }

    function beginSelectSwapTargets() {
      setIsSelectingSwapTargets(true);
      setSwapTargetDays([]);
      setWeekCardTargetIndex(null);
    }

    function cancelSwapSelection() {
      setSelectedSwapDays([]);
      setSwapTargetDays([]);
      setIsSelectingSwapTargets(false);
      setMoveConflictStrategy("override");
      setWeekCardSourceIndex(null);
      setWeekCardTargetIndex(null);
    }

    function handleSwapDays(strategy: "override" | "swap") {
      if (selectedSwapDays.length !== swapTargetDays.length || selectedSwapDays.length === 0) return;
      applyDraftEdit((current) => {
        // Map dateKey to recs
        const recsByDate: Record<string, TrainingRecommendation[]> = {};
        current.forEach((rec) => {
          const key = rec.date.slice(0, 10);
          if (!recsByDate[key]) recsByDate[key] = [];
          recsByDate[key].push(rec);
        });
        // Only move if all selected days are editable
        const allEditable = [...selectedSwapDays, ...swapTargetDays].every((key) => !completedRunDateKeys.has(key));
        if (!allEditable) {
          return { next: current, changedCount: 0, message: "Only uncompleted days can be moved." };
        }

        // Move recs from selected source days to chosen target days.
        const before = JSON.stringify(current);
        const sourceRecs = selectedSwapDays.map((key) => recsByDate[key] ?? []);
        const targetRecs = swapTargetDays.map((key) => recsByDate[key] ?? []);

        // Remove all recs for selected/target days
        let next = current.filter((rec) => {
          const key = rec.date.slice(0, 10);
          return !selectedSwapDays.includes(key) && !swapTargetDays.includes(key);
        });

        // Assign source recs to target days in click order.
        swapTargetDays.forEach((key, i) => {
          sourceRecs[i].forEach((rec) => next.push({ ...rec, date: key + rec.date.slice(10) }));
        });

        // Optionally keep destination workouts by swapping them back to source days.
        if (strategy === "swap") {
          selectedSwapDays.forEach((key, i) => {
            targetRecs[i].forEach((rec) => next.push({ ...rec, date: key + rec.date.slice(10) }));
          });
        }

        const changedCount = before === JSON.stringify(next) ? 0 : 1;
        return {
          next,
          changedCount,
          message:
            changedCount
              ? strategy === "swap"
                ? `Swapped workouts for ${selectedSwapDays.length} day(s).`
                : `Moved workouts for ${selectedSwapDays.length} day(s).`
              : "No changes made.",
        };
      });
      setSelectedSwapDays([]);
      setSwapTargetDays([]);
      setIsSelectingSwapTargets(false);
      setMoveConflictStrategy("override");
      setWeekCardSourceIndex(null);
      setWeekCardTargetIndex(null);
    }
  const { runs, trainingRecommendations, updateRunPlanCheck, updateTrainingRecommendations, updateTrainingRecommendation } = useRunTrack();
  const [editingRecommendation, setEditingRecommendation] = useState<TrainingRecommendation | null>(null);
  const todayKey = keyForDate(new Date());
  // (removed duplicate state declarations)

  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset + weekOffset * 7);

    return Array.from({ length: 7 }, (_, index) =>
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    );
  }, [weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const start = currentWeekDays[0];
    const end = currentWeekDays[currentWeekDays.length - 1];

    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString(undefined, {
        month: "long",
      })} ${start.getDate()}\u2013${end.getDate()}, ${end.getFullYear()}`;
    }

    return `${start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} \u2013 ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }, [currentWeekDays]);

  const runsByDate = useMemo(() => {
    const map = new Map<string, typeof runs>();
    runs.forEach((run) => {
      const key = keyForRunDate(run.date);
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, run]);
    });
    return map;
  }, [runs]);

  const completedRunDateKeys = useMemo(() => {
    return new Set(runsByDate.keys());
  }, [runsByDate]);

  const activeRecommendations = useMemo(() => {
    if (isEditingPlan) {
      return draftRecommendations ?? trainingRecommendations;
    }

    return trainingRecommendations;
  }, [draftRecommendations, isEditingPlan, trainingRecommendations]);

  const hasPlanRecommendations = activeRecommendations.length > 0;

  const mileageByWeekStart = useMemo(() => {
    const map = new Map<string, number>();

    // Aggregate planned mileage by day, then override with completed mileage when runs exist.
    // Include unplanned run days as well so weekly totals match actual completed mileage.
    const plannedByDate = new Map<string, number>();
    activeRecommendations.forEach((recommendation) => {
      const dateKey = recommendation.date.slice(0, 10);
      plannedByDate.set(dateKey, (plannedByDate.get(dateKey) ?? 0) + (recommendation.distanceMiles ?? 0));
    });

    const allDateKeys = new Set<string>([...plannedByDate.keys(), ...runsByDate.keys()]);

    allDateKeys.forEach((dateKey) => {
      const parsed = parseDateKeyToLocalDate(dateKey);
      if (!parsed) {
        return;
      }

      const dayRuns = runsByDate.get(dateKey) ?? [];
      const completedMiles = dayRuns.reduce((total, run) => total + (run.distanceMiles ?? 0), 0);
      const plannedMiles = plannedByDate.get(dateKey) ?? 0;
      const dayMiles = dayRuns.length > 0 ? completedMiles : plannedMiles;
      const weekStartKey = weekStartKeyForDate(parsed);
      map.set(weekStartKey, (map.get(weekStartKey) ?? 0) + dayMiles);
    });

    return map;
  }, [activeRecommendations, runsByDate]);

  const currentWeekStartKey = useMemo(() => weekStartKeyForDate(currentWeekDays[0]), [currentWeekDays]);
  const previousWeekStartKey = useMemo(() => {
    const previousWeekDate = new Date(currentWeekDays[0]);
    previousWeekDate.setDate(previousWeekDate.getDate() - 7);
    return weekStartKeyForDate(previousWeekDate);
  }, [currentWeekDays]);

  const currentWeekPlannedMileage = useMemo(() => {
    return mileageByWeekStart.get(currentWeekStartKey) ?? 0;
  }, [currentWeekStartKey, mileageByWeekStart]);

  const currentWeekPreviousMileage = useMemo(() => {
    return mileageByWeekStart.get(previousWeekStartKey) ?? 0;
  }, [mileageByWeekStart, previousWeekStartKey]);

  const currentWeekChangeLabel = useMemo(() => {
    const percentText = formatWeekOverWeekChange(currentWeekPlannedMileage, currentWeekPreviousMileage);
    const trendWord = currentWeekPlannedMileage >= currentWeekPreviousMileage ? "increase" : "decrease";
    return `${percentText} ${trendWord}`;
  }, [currentWeekPlannedMileage, currentWeekPreviousMileage]);

  const monthWeekRows = useMemo(() => {
    if (view !== "month") {
      return [] as Array<{ days: Array<Date | null>; mileage: number; previousMileage: number; changeLabel: string }>;
    }

    const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    const monthStartOffset = (monthStart.getDay() + 6) % 7;
    const monthEndOffset = (monthEnd.getDay() + 6) % 7;

    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - monthStartOffset);

    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - monthEndOffset));

    const rows: Array<{ days: Array<Date | null>; mileage: number; previousMileage: number; changeLabel: string }> = [];

    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 7)) {
      const weekStart = new Date(cursor);
      const weekStartKey = keyForDate(weekStart);
      const mileage = mileageByWeekStart.get(weekStartKey) ?? 0;

      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      const previousMileage = mileageByWeekStart.get(keyForDate(previousWeekStart)) ?? 0;

      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + dayIndex);
        return day.getMonth() === displayMonth.getMonth() ? day : null;
      });

      const percentText = formatWeekOverWeekChange(mileage, previousMileage);
      const trendWord = mileage >= previousMileage ? "increase" : "decrease";
      rows.push({
        days,
        mileage,
        previousMileage,
        changeLabel: `${percentText} ${trendWord}`,
      });
    }

    return rows;
  }, [displayMonth, mileageByWeekStart, view]);

  const monthlyPlannedMileage = useMemo(() => {
    const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const monthEnd = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
    let total = 0;

    const plannedByDate = new Map<string, number>();
    activeRecommendations.forEach((recommendation) => {
      const dateKey = recommendation.date.slice(0, 10);
      plannedByDate.set(dateKey, (plannedByDate.get(dateKey) ?? 0) + (recommendation.distanceMiles ?? 0));
    });

    const allDateKeys = new Set<string>([...plannedByDate.keys(), ...runsByDate.keys()]);

    allDateKeys.forEach((dateKey) => {
      const parsed = parseDateKeyToLocalDate(dateKey);
      if (!parsed) {
        return;
      }

      // Only include dates within this month
      if (parsed < monthStart || parsed > monthEnd) {
        return;
      }

      const dayRuns = runsByDate.get(dateKey) ?? [];
      const completedMiles = dayRuns.reduce((acc, run) => acc + (run.distanceMiles ?? 0), 0);
      const plannedMiles = plannedByDate.get(dateKey) ?? 0;
      const dayMiles = dayRuns.length > 0 ? completedMiles : plannedMiles;
      total += dayMiles;
    });

    return total;
  }, [displayMonth, activeRecommendations, runsByDate]);

  const recommendationsByDate = useMemo(() => {
    const map = new Map<string, typeof trainingRecommendations>();
    activeRecommendations.forEach((recommendation) => {
      const key = recommendation.date.slice(0, 10);
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, recommendation]);
    });
    return map;
  }, [activeRecommendations]);

  function beginPlanEdit() {
    setIsEditingPlan(true);
    setDraftRecommendations(trainingRecommendations);
    setEditHistory([]);
    setEditStatusMessage("Edit mode enabled. Changes are staged until you save.");
    // Remain on current view, but editing is only allowed in month view
  }

  function cancelPlanEdit() {
    setIsEditingPlan(false);
    setDraftRecommendations(null);
    setEditHistory([]);
    setTemporaryEditStatus("Edit canceled. No changes were saved.");
  }

  function savePlanEdit() {
    if (!isEditingPlan || !draftRecommendations) {
      return;
    }

    const sorted = [...draftRecommendations].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    updateTrainingRecommendations(sorted);
    setIsEditingPlan(false);
    setDraftRecommendations(null);
    setEditHistory([]);
    setEditStatusMessage("Training plan updates saved.");
  }

  function applyDraftEdit(mutate: (current: TrainingRecommendation[]) => { next: TrainingRecommendation[]; changedCount: number; message: string }) {
    if (!isEditingPlan) {
      return;
    }

    const base = draftRecommendations ?? trainingRecommendations;
    const { next, changedCount, message } = mutate(base);

    if (changedCount <= 0) {
      setEditStatusMessage(message);
      return;
    }

    setEditHistory((prev) => [...prev, base]);
    setDraftRecommendations(next);
    setEditStatusMessage(message);
  }

  function undoLastEditAction() {
    if (!isEditingPlan || editHistory.length === 0) {
      return;
    }

    const previous = editHistory[editHistory.length - 1];
    setDraftRecommendations(previous);
    setEditHistory((prev) => prev.slice(0, -1));
    setEditStatusMessage("Last edit action was undone.");
  }

  function deleteWorkoutsForDate(dateKey: string) {
    applyDraftEdit((current) => {
      const next = current.filter((recommendation) => {
        const recommendationDateKey = recommendation.date.slice(0, 10);
        if (recommendationDateKey !== dateKey) {
          return true;
        }

        return completedRunDateKeys.has(recommendationDateKey);
      });

      const changedCount = current.length - next.length;
      return {
        next,
        changedCount,
        message:
          changedCount > 0
            ? `Removed ${changedCount} workout${changedCount > 1 ? "s" : ""} from ${dateKey}.`
            : "This day is completed or has no editable workouts.",
      };
    });
  }

  function confirmDeleteWorkoutsForDate(dateKey: string) {
    const confirmed = window.confirm(`Delete all editable workouts on ${dateKey}? This can be undone while still in edit mode.`);
    if (!confirmed) {
      return;
    }

    deleteWorkoutsForDate(dateKey);
  }

  function deleteCurrentWeekBlock() {
    const startKey = keyForDate(currentWeekDays[0]);
    const endKey = keyForDate(currentWeekDays[currentWeekDays.length - 1]);

    applyDraftEdit((current) => {
      const next = current.filter((recommendation) => {
        const recommendationDateKey = recommendation.date.slice(0, 10);
        if (!isDateKeyInRange(recommendationDateKey, startKey, endKey)) {
          return true;
        }

        return completedRunDateKeys.has(recommendationDateKey);
      });

      const changedCount = current.length - next.length;
      return {
        next,
        changedCount,
        message:
          changedCount > 0
            ? `Deleted ${changedCount} workout${changedCount > 1 ? "s" : ""} from this week block.`
            : "No editable workouts were available in this week block.",
      };
    });
  }

  function confirmDeleteCurrentWeekBlock() {
    const confirmed = window.confirm("Delete all editable workouts in the current week block? This can be undone while still in edit mode.");
    if (!confirmed) {
      return;
    }

    deleteCurrentWeekBlock();
  }

  function moveSpecificDay(dateKey: string, deltaDays: number) {
    applyDraftEdit((current) => {
      let changedCount = 0;
      const next = current.map((recommendation) => {
        const recommendationDateKey = recommendation.date.slice(0, 10);
        if (recommendationDateKey !== dateKey || completedRunDateKeys.has(recommendationDateKey)) {
          return recommendation;
        }

        const shiftedDate = shiftIsoDateByDays(recommendation.date, deltaDays);
        const shiftedDateKey = shiftedDate.slice(0, 10);
        if (completedRunDateKeys.has(shiftedDateKey)) {
          return recommendation;
        }

        changedCount += 1;
        return {
          ...recommendation,
          date: shiftedDate,
        };
      });

      return {
        next,
        changedCount,
        message:
          changedCount > 0
            ? `Moved ${changedCount} workout${changedCount > 1 ? "s" : ""} on ${dateKey} by ${Math.abs(deltaDays)} day${Math.abs(deltaDays) > 1 ? "s" : ""}.`
            : "Could not move this day because it is completed or target day has completed runs.",
      };
    });
  }

  function moveCurrentWeek(deltaWeeks: number) {
    const startKey = keyForDate(currentWeekDays[0]);
    const endKey = keyForDate(currentWeekDays[currentWeekDays.length - 1]);
    const deltaDays = deltaWeeks * 7;

    applyDraftEdit((current) => {
      let changedCount = 0;
      const next = current.map((recommendation) => {
        const recommendationDateKey = recommendation.date.slice(0, 10);
        if (!isDateKeyInRange(recommendationDateKey, startKey, endKey) || completedRunDateKeys.has(recommendationDateKey)) {
          return recommendation;
        }

        const shiftedDate = shiftIsoDateByDays(recommendation.date, deltaDays);
        const shiftedDateKey = shiftedDate.slice(0, 10);
        if (completedRunDateKeys.has(shiftedDateKey)) {
          return recommendation;
        }

        changedCount += 1;
        return {
          ...recommendation,
          date: shiftedDate,
        };
      });

      return {
        next,
        changedCount,
        message:
          changedCount > 0
            ? `Moved ${changedCount} workout${changedCount > 1 ? "s" : ""} from this week ${deltaWeeks < 0 ? "earlier" : "later"}.`
            : "No editable workouts in this week could be moved.",
      };
    });
  }

  function moveFutureWeeksUp() {
    const nextWeekStart = new Date(currentWeekDays[0]);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekStartKey = keyForDate(nextWeekStart);

    applyDraftEdit((current) => {
      let changedCount = 0;
      const next = current.map((recommendation) => {
        const recommendationDateKey = recommendation.date.slice(0, 10);
        if (recommendationDateKey < nextWeekStartKey || completedRunDateKeys.has(recommendationDateKey)) {
          return recommendation;
        }

        const shiftedDate = shiftIsoDateByDays(recommendation.date, -7);
        const shiftedDateKey = shiftedDate.slice(0, 10);
        if (completedRunDateKeys.has(shiftedDateKey)) {
          return recommendation;
        }

        changedCount += 1;
        return {
          ...recommendation,
          date: shiftedDate,
        };
      });

      return {
        next,
        changedCount,
        message:
          changedCount > 0
            ? `Moved ${changedCount} workout${changedCount > 1 ? "s" : ""} from future weeks up by one week.`
            : "No editable future workouts could be moved up.",
      };
    });
  }

  useEffect(() => {
    const keysNeedingTempoSuggestion = new Set<string>();

    if (view === "week") {
      currentWeekDays.forEach((day) => {
        const key = keyForDate(day);
        const dayRecommendations = recommendationsByDate.get(key) ?? [];
        if (dayRecommendations.some((recommendation) => recommendation.runType === "Tempo")) {
          keysNeedingTempoSuggestion.add(key);
        }
      });
    }

    if (selectedDate) {
      const selectedKey = keyForDate(selectedDate);
      const modalRecommendations = recommendationsByDate.get(selectedKey) ?? [];
      if (modalRecommendations.some((recommendation) => recommendation.runType === "Tempo")) {
        keysNeedingTempoSuggestion.add(selectedKey);
      }
    }

    const keysToFetch = [...keysNeedingTempoSuggestion].filter((key) => !fetchedTempoDateKeysRef.current.has(key));
    if (keysToFetch.length === 0) {
      return;
    }

    keysToFetch.forEach((key) => fetchedTempoDateKeysRef.current.add(key));

    let canceled = false;

    async function loadTempoSuggestions() {
      const results = await Promise.all(
        keysToFetch.map(async (dateKey) => {
          try {
            const response = await fetch(`/api/ai/today-focus?date=${dateKey}`, { cache: "no-store" });
            const data = (await response.json()) as {
              payload?: { tempoAtPaceSuggestion?: string | null; plannedWorkoutSuggestion?: string | null };
            };

            return {
              dateKey,
              suggestion:
                response.ok && typeof data.payload?.tempoAtPaceSuggestion === "string" && data.payload.tempoAtPaceSuggestion.trim()
                  ? data.payload.tempoAtPaceSuggestion.trim()
                  : null,
            };
          } catch {
            return { dateKey, suggestion: null };
          }
        })
      );

      if (canceled) {
        return;
      }

      setTempoAtPaceByDate((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result.suggestion) {
            next[result.dateKey] = result.suggestion;
          }
        });
        return next;
      });

    }

    void loadTempoSuggestions();

    return () => {
      canceled = true;
    };
  }, [view, currentWeekDays, selectedDate, recommendationsByDate]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Title + mileage */}
          <div>
            {view === "week" ? (
              <>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {weekOffset === 0 ? "Current week" : weekOffset < 0 ? `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? "s" : ""} ago` : `${weekOffset} week${weekOffset > 1 ? "s" : ""} ahead`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">{weekRangeLabel}</h2>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {currentWeekPlannedMileage.toFixed(1)} mi{" "}
                    <span className={`italic ${currentWeekChangeLabel.includes("decrease") ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                      ({currentWeekChangeLabel})
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">
                  {displayMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </h2>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {monthlyPlannedMileage.toFixed(1)} mi
                </span>
              </div>
            )}
          </div>
          {/* Controls: nav arrows + Edit Plan + Week/Month toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                view === "week"
                  ? setWeekOffset((prev) => prev - 1)
                  : setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={view === "week" ? "Previous week" : "Previous month"}
            >
              <span aria-hidden="true">&larr;</span>
            </button>
            <button
              type="button"
              onClick={() =>
                view === "week"
                  ? setWeekOffset((prev) => prev + 1)
                  : setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={view === "week" ? "Next week" : "Next month"}
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
            {!isEditingPlan ? (
              <button
                type="button"
                onClick={beginPlanEdit}
                disabled={!hasPlanRecommendations}
                className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/40"
              >
                Edit Plan
              </button>
            ) : null}
            <div className="flex rounded-lg border border-slate-300 overflow-hidden dark:border-slate-700">
              <button
                type="button"
                onClick={() => !isEditingPlan && setView("week")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  view === "week" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                } ${isEditingPlan ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isEditingPlan}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  view === "month" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {isEditingPlan ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <>
                <button
                  type="button"
                  onClick={savePlanEdit}
                  className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 dark:border-emerald-500/40"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={undoLastEditAction}
                  disabled={editHistory.length === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Undo Last Action
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm("Cancel editing and discard all staged changes?");
                    if (!confirmed) {
                      return;
                    }
                    cancelPlanEdit();
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCurrentWeekBlock}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                >
                  Delete Week Block
                </button>
                <button
                  type="button"
                  onClick={() => moveCurrentWeek(-1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Move Week Earlier
                </button>
                <button
                  type="button"
                  onClick={() => moveCurrentWeek(1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Move Week Later
                </button>
                <button
                  type="button"
                  onClick={moveFutureWeeksUp}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                >
                  Move Future Weeks Up
                </button>
                <button
                  type="button"
                  onClick={beginSelectSwapTargets}
                  disabled={selectedSwapDays.length === 0 || isSelectingSwapTargets}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                >
                  Move To
                </button>
                <button
                  type="button"
                  onClick={cancelSwapSelection}
                  disabled={selectedSwapDays.length === 0 && !isSelectingSwapTargets}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear Selection
                </button>
            </>
          </div>
          {editStatusMessage ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{editStatusMessage}</p>
          ) : null}
          {selectedSwapDays.length > 0 && !isSelectingSwapTargets ? (
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
              {selectedSwapDays.length} day(s) selected. Click Move To, then {weekCardSourceIndex !== null ? "click another weekly mileage card" : `click ${selectedSwapDays.length} destination day(s)`}.
            </p>
          ) : null}
          {isSelectingSwapTargets ? (
            <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
              Destination mode: select {selectedSwapDays.length} day(s). Selected {swapTargetDays.length}/{selectedSwapDays.length}.
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Edits apply only to workouts on days without logged runs.
          </p>
        </div>
        ) : null}

        {/* Only allow editing controls in month view, but always show week/month grid */}
        {view === "month" ? (
          <>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 sm:gap-2 dark:text-slate-400">
              <span><span className="sm:hidden">M</span><span className="hidden sm:inline">Mon</span></span>
              <span><span className="sm:hidden">T</span><span className="hidden sm:inline">Tue</span></span>
              <span><span className="sm:hidden">W</span><span className="hidden sm:inline">Wed</span></span>
              <span><span className="sm:hidden">T</span><span className="hidden sm:inline">Thu</span></span>
              <span><span className="sm:hidden">F</span><span className="hidden sm:inline">Fri</span></span>
              <span><span className="sm:hidden">S</span><span className="hidden sm:inline">Sat</span></span>
              <span><span className="sm:hidden">S</span><span className="hidden sm:inline">Sun</span></span>
            </div>
            <div className="mt-2 space-y-2">
              {monthWeekRows.map((row, rowIndex) => (
                <div key={`month-row-${rowIndex}`} className="space-y-1">
                  <div className="w-full">
                    {(() => {
                      const editableWeekKeys = row.days
                        .filter((day): day is Date => day !== null)
                        .map((day) => keyForDate(day))
                        .filter((key) => {
                          const dayRuns = runsByDate.get(key) ?? [];
                          const dayRecommendations = recommendationsByDate.get(key) ?? [];
                          return dayRuns.length === 0 && dayRecommendations.length > 0;
                        });
                      const destinationWeekKeys = row.days
                        .filter((day): day is Date => day !== null)
                        .map((day) => keyForDate(day))
                        .filter((key) => {
                          const dayRuns = runsByDate.get(key) ?? [];
                          return dayRuns.length === 0;
                        });

                      const selectedSourceCount = editableWeekKeys.filter((key) => selectedSwapDays.includes(key)).length;
                      const selectedTargetCount = destinationWeekKeys.filter((key) => swapTargetDays.includes(key)).length;
                      const isWeekSourceSelected = editableWeekKeys.length > 0 && selectedSourceCount === editableWeekKeys.length;
                      const isWeekTargetSelected = destinationWeekKeys.length > 0 && selectedTargetCount > 0;

                      return (
                        <button
                          type="button"
                          disabled={isEditingPlan && editableWeekKeys.length === 0}
                          onClick={() => {
                            if (!isEditingPlan) {
                              return;
                            }

                            if (editableWeekKeys.length === 0) {
                              setEditStatusMessage("This week has no editable planned workouts.");
                              return;
                            }

                            if (!isSelectingSwapTargets) {
                              setSelectedSwapDays(editableWeekKeys);
                              setSwapTargetDays([]);
                              setWeekCardSourceIndex(rowIndex);
                              setWeekCardTargetIndex(null);
                              return;
                            }

                            if (destinationWeekKeys.length < selectedSwapDays.length) {
                              setEditStatusMessage(
                                `Need ${selectedSwapDays.length} destination day(s), but this week has ${destinationWeekKeys.length} uncompleted day(s).`
                              );
                              return;
                            }

                            const targetKeys = destinationWeekKeys
                              .filter((key) => !selectedSwapDays.includes(key))
                              .slice(0, selectedSwapDays.length);

                            if (targetKeys.length < selectedSwapDays.length) {
                              setEditStatusMessage("Destination week overlaps selected source days. Pick a different week.");
                              return;
                            }

                            setSwapTargetDays(targetKeys);
                            setWeekCardTargetIndex(rowIndex);
                          }}
                          className={`block w-full rounded-full border px-2 py-0.5 text-center text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            isWeekSourceSelected
                              ? "border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-200"
                              : isWeekTargetSelected && isSelectingSwapTargets
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                          aria-label={
                            !isEditingPlan
                              ? `Weekly mileage ${row.mileage.toFixed(1)} miles`
                              : isSelectingSwapTargets
                              ? `Select this week as move destination`
                              : `Select this week to move`
                          }
                        >
                          {row.mileage.toFixed(1)} mi{" "}
                          <span
                            className={`italic ${
                              row.changeLabel.includes("decrease")
                                ? "text-amber-600 dark:text-amber-300"
                                : "text-emerald-600 dark:text-emerald-300"
                            }`}
                          >
                            ({row.changeLabel})
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {row.days.map((day, dayIndex) => {
                      if (!day) {
                        return <div key={`empty-${rowIndex}-${dayIndex}`} className="h-16 rounded-xl bg-slate-50 sm:h-20 dark:bg-slate-800/40" />;
                      }

                      const key = keyForDate(day);
                      const dayRuns = runsByDate.get(key) ?? [];
                      const dayRecommendations = recommendationsByDate.get(key) ?? [];
                      const isToday = key === todayKey;
                      const hasCompletedRun = dayRuns.length > 0;

                      const isSelectedSwapDay = selectedSwapDays.includes(key);
                      const isSwapTargetDay = swapTargetDays.includes(key);
                      const canSelectForSwap = isEditingPlan && !hasCompletedRun && dayRecommendations.length > 0 && !isSelectingSwapTargets;
                      const canSelectAsTarget = isEditingPlan && isSelectingSwapTargets && !hasCompletedRun && !isSelectedSwapDay;
                      const weekCardLockedTargetSelection = isSelectingSwapTargets && weekCardSourceIndex !== null;

                      const completedMiles = dayRuns.reduce((sum, r) => sum + (r.distanceMiles ?? 0), 0);
                      const plannedMiles = dayRecommendations[0]?.distanceMiles;
                      const displayMiles = hasCompletedRun ? completedMiles : (plannedMiles ?? null);

                      return (
                        <div key={key} className="relative h-16 sm:h-20">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingPlan && !isSelectingSwapTargets && canSelectForSwap) {
                                toggleSwapDay(key);
                              } else if (isEditingPlan && !isSelectingSwapTargets && !canSelectForSwap) {
                                setEditStatusMessage("Only uncompleted days with planned workouts can be selected.");
                              } else if (isEditingPlan && isSelectingSwapTargets && weekCardLockedTargetSelection) {
                                setEditStatusMessage("For a full-week selection, choose destination by clicking another weekly mileage card.");
                              } else if (isEditingPlan && isSelectingSwapTargets && canSelectAsTarget) {
                                toggleSwapTargetDay(key);
                              } else if (isEditingPlan && isSelectingSwapTargets && !canSelectAsTarget) {
                                setEditStatusMessage("Select an uncompleted day that is not in the source set.");
                              } else {
                                setSelectedDate(day);
                              }
                            }}
                            className={`absolute inset-0 w-full h-full rounded-xl border p-1.5 text-left transition hover:border-blue-300 hover:shadow-sm sm:p-2 dark:hover:border-blue-400/60 z-0 ${
                              isSelectedSwapDay
                                ? "border-yellow-400 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-900/30"
                                : isSwapTargetDay
                                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/30"
                                : hasCompletedRun
                                ? "border-emerald-300 bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                                : isToday
                                ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                            }`}
                            aria-label={
                              isEditingPlan && !isSelectingSwapTargets && canSelectForSwap
                                ? isSelectedSwapDay
                                  ? "Unselect day to move"
                                  : "Select day to move"
                                : isEditingPlan && isSelectingSwapTargets && canSelectAsTarget
                                ? isSwapTargetDay
                                  ? "Unselect move target"
                                  : "Select move target"
                                : `Open details for ${day.toLocaleDateString()}`
                            }
                          >
                            <p className="text-xs font-medium text-slate-800 sm:text-sm dark:text-slate-100">{day.getDate()}</p>
                            {displayMiles != null && displayMiles > 0 ? (
                              <p className={`mt-0.5 text-[10px] font-semibold leading-tight sm:text-xs ${
                                hasCompletedRun
                                  ? "text-emerald-700 dark:text-emerald-200"
                                  : "text-blue-600 dark:text-blue-300"
                              }`}>
                                {displayMiles.toFixed(1)}
                                <span className="text-[9px] font-normal sm:text-[10px]">mi</span>
                              </p>
                            ) : dayRecommendations.length > 0 ? (
                              <p className="mt-0.5 text-[9px] leading-tight text-blue-500 sm:text-[10px] dark:text-blue-400">
                                {dayRecommendations[0].runType?.slice(0, 3)}
                              </p>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}



        <div className={view === "week" ? "mt-4 grid gap-3 lg:grid-cols-7 md:grid-cols-2" : "hidden"}>
          {currentWeekDays.map((day) => {
            const key = keyForDate(day);
            const dayRuns = runsByDate.get(key) ?? [];
            const dayRecommendations = recommendationsByDate.get(key) ?? [];
            const planCheck = buildDayPlanCheck(dayRuns, dayRecommendations);
            const apiPlanCheck = resolveStoredPlanCheck(dayRuns, dayRecommendations);
            const isNotCompletedDay = dayRecommendations.length > 0 && dayRuns.length === 0;
            const isCompletedDay = completedRunDateKeys.has(key);
            const canEditDay = isEditingPlan && dayRecommendations.length > 0 && !isCompletedDay;
            const isToday = key === todayKey;
            const hasCompletedRun = dayRuns.length > 0;

            // Multi-day swap selection state
            const isSelectedSwapDay = selectedSwapDays.includes(key);
            const isSwapTargetDay = swapTargetDays.includes(key);
            const canSelectForSwap = isEditingPlan && !isCompletedDay && dayRecommendations.length > 0 && !isSelectingSwapTargets;
            const canSelectAsTarget = isEditingPlan && isSelectingSwapTargets && !isCompletedDay && !isSelectedSwapDay;

            return (
              <article
                key={key}
                className={`rounded-xl border p-2.5 min-h-32 space-y-2 md:p-3 md:min-h-40 md:space-y-2.5 lg:min-h-44 ${
                  isSelectedSwapDay
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/30"
                    : isSwapTargetDay
                    ? "border-blue-400 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30"
                    : hasCompletedRun
                    ? "border-emerald-300 bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                    : isToday
                    ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="grid grid-cols-2 items-start gap-2">
                  <div className="min-w-0 space-y-2 md:space-y-2.5">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>

                    {isEditingPlan && !isSelectingSwapTargets ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => confirmDeleteWorkoutsForDate(key)}
                          disabled={!canEditDay}
                          className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                        >
                          Delete Day
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSpecificDay(key, -1)}
                          disabled={!canEditDay}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Move -1d
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSpecificDay(key, 1)}
                          disabled={!canEditDay}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Move +1d
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSwapDay(key)}
                          disabled={!canSelectForSwap}
                          className={`rounded-md border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50 ${isSelectedSwapDay ? "ring-2 ring-emerald-400" : ""}`}
                        >
                          {isSelectedSwapDay ? "Unselect" : "Select"} to Move
                        </button>
                      </div>
                    ) : null}

                    {isEditingPlan && isSelectingSwapTargets ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => toggleSwapTargetDay(key)}
                          disabled={!canSelectAsTarget}
                          className={`rounded-md border border-blue-400 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50 ${isSwapTargetDay ? "ring-2 ring-blue-400" : ""}`}
                        >
                          {isSwapTargetDay ? "Unselect" : "Select"} as Target
                        </button>
                      </div>
                    ) : null}
                    {dayRecommendations.length > 0 ? (
                      <section>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                          Planned workout
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {dayRecommendations.map((recommendation) => {
                            const displayedMiles = resolveDisplayedWorkoutMileage(recommendation, dayRuns);
                            return (
                              <li key={recommendation.id} className="text-xs text-slate-700 dark:text-slate-200">
                                <div className="flex items-start justify-between gap-2">
                                  <span>
                                    {recommendation.runType}
                                    {displayedMiles ? ` • ${displayedMiles} mi` : ""}
                                    {recommendation.durationMinutes
                                      ? ` • ${formatDuration(
                                          recommendation.durationMinutes,
                                          recommendation.runType === "Long" || recommendation.runType === "Race"
                                        )}`
                                      : ""}
                                  </span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingRecommendation(recommendation)}
                                      className="inline-block rounded-md border border-amber-300 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                                    >
                                      Edit
                                    </button>
                                    {isQualityWorkout(recommendation.runType) ? (
                                      <Link
                                        href={`/run-generator?workoutId=${encodeURIComponent(recommendation.id)}`}
                                        className="inline-block rounded-md border border-blue-300 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                      >
                                        Open Run Generator
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                                {recommendation.runType === "Tempo" && tempoAtPaceByDate[recommendation.date.slice(0, 10)] && !hasClearMainSetTarget(recommendation.notes, recommendation.targetPace) ? (
                                  <p className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-200">
                                    At pace: {tempoAtPaceByDate[recommendation.date.slice(0, 10)]}
                                  </p>
                                ) : null}
                                {resolveAiCoachNoteForRecommendation(recommendation) ? (
                                  <p className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-200">
                                    AI Coach: {resolveAiCoachNoteForRecommendation(recommendation)?.replace(/^AI Coach:\s*/i, "")}
                                  </p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ) : null}

                    <section>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                        Logged runs
                      </p>
                      {dayRuns.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {dayRuns.map((run) => (
                            <li
                              key={run.id}
                              className="text-xs text-slate-700 dark:text-slate-200"
                            >
                              {run.title} • {run.distanceMiles} mi • {formatDuration(
                                run.durationMinutes,
                                run.runType === "Long" || run.runType === "Race"
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No runs logged for this day.</p>
                      )}
                    </section>
                  </div>

                  {planCheck ? (
                    <section className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-2 dark:border-violet-500/30 dark:bg-violet-500/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                        Plan check
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium ${
                          planCheck.tone === "success"
                            ? "text-emerald-700 dark:text-emerald-200"
                            : planCheck.tone === "missed"
                            ? "text-rose-700 dark:text-rose-200"
                            : "text-amber-700 dark:text-amber-200"
                        }`}
                      >
                        {planCheck.status}
                      </p>
                      {isNotCompletedDay ? null : apiPlanCheck ? (
                        <>
                          <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{apiPlanCheck.summary}</p>
                          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Score: {apiPlanCheck.score}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{planCheck.summary}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{planCheck.suggestion}</p>
                        </>
                      )}
                    </section>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isEditingPlan && isSelectingSwapTargets && selectedSwapDays.length > 0 && swapTargetDays.length === selectedSwapDays.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="presentation" onClick={cancelSwapSelection}>
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-move-days-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-move-days-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm Move</h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Move workouts from {selectedSwapDays.length} selected day(s) to the destination day(s) you picked?
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose how to handle existing editable workouts on destination days.
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="move-strategy"
                  value="override"
                  checked={moveConflictStrategy === "override"}
                  onChange={() => setMoveConflictStrategy("override")}
                />
                Override destination workouts
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="move-strategy"
                  value="swap"
                  checked={moveConflictStrategy === "swap"}
                  onChange={() => setMoveConflictStrategy("swap")}
                />
                Swap with source day(s)
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleSwapDays(moveConflictStrategy)}
                className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:border-emerald-500/40"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={cancelSwapSelection}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedDate && view === "month" ? (() => {
        const selectedKey = keyForDate(selectedDate);
        const modalRuns = runsByDate.get(selectedKey) ?? [];
        const modalRecommendations = recommendationsByDate.get(selectedKey) ?? [];
        const modalPlanCheck = buildDayPlanCheck(modalRuns, modalRecommendations);
        const modalApiPlanCheck = resolveStoredPlanCheck(modalRuns, modalRecommendations);
        const modalIsNotCompletedDay = modalRecommendations.length > 0 && modalRuns.length === 0;
        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => setSelectedDate(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-modal-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Workout details</p>
                  <h3 id="calendar-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {modalRecommendations.length > 0 ? (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Planned workout</p>
                  <div className="mt-2 space-y-2">
                      {modalRecommendations.map((recommendation) => {
                        const noteSections = recommendation.notes ? parseWorkoutSections(recommendation.notes) : [];
                        const displayedMiles = resolveDisplayedWorkoutMileage(recommendation, modalRuns);
                        return (
                          <article
                            key={recommendation.id}
                            className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{recommendation.runType}</p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingRecommendation(recommendation)}
                                  className="inline-block rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                                >
                                  Edit
                                </button>
                                {isQualityWorkout(recommendation.runType) ? (
                                  <Link
                                    href={`/run-generator?workoutId=${encodeURIComponent(recommendation.id)}`}
                                    className="inline-block rounded-md border border-blue-300 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                  >
                                    Open Run Generator
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                            {displayedMiles ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Distance: {displayedMiles} mi</p>
                            ) : null}
                            {recommendation.durationMinutes ? (
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                Duration:{" "}
                                {formatDuration(
                                  recommendation.durationMinutes,
                                  recommendation.runType === "Long" || recommendation.runType === "Race"
                                )}
                              </p>
                            ) : null}
                            {recommendation.runType === "Tempo" && tempoAtPaceByDate[recommendation.date.slice(0, 10)] && !hasClearMainSetTarget(recommendation.notes, recommendation.targetPace) ? (
                              <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                                At pace: {tempoAtPaceByDate[recommendation.date.slice(0, 10)]}
                              </p>
                            ) : null}
                            {resolveAiCoachNoteForRecommendation(recommendation) ? (
                              <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                                AI Coach: {resolveAiCoachNoteForRecommendation(recommendation)?.replace(/^AI Coach:\s*/i, "")}
                              </p>
                            ) : null}
                            {noteSections.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {noteSections.map((section) => (
                                  <div key={`${recommendation.id}-${section.label}`}>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                                      {section.label}
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{section.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : recommendation.notes ? (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {normalizeWorkoutSentence(recommendation.notes)}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                </section>
                ) : null}

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Logged runs</p>
                  {modalRuns.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {modalRuns.map((run) => (
                        <article
                          key={run.id}
                          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{run.title}</p>
                          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                            {run.runType} &middot; {run.surface} &middot; {run.distanceMiles} mi
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {formatDuration(run.durationMinutes, run.runType === "Long" || run.runType === "Race")}{" "}
                            &middot; {formatPace(run.paceMinPerMile)}
                          </p>
                          {run.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{run.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No runs logged for this day.</p>
                  )}
                </section>

                {modalPlanCheck ? (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Plan check</p>
                    <p
                      className={`mt-2 text-sm font-medium ${
                        modalPlanCheck.tone === "success"
                          ? "text-emerald-700 dark:text-emerald-200"
                          : modalPlanCheck.tone === "missed"
                          ? "text-rose-700 dark:text-rose-200"
                          : "text-amber-700 dark:text-amber-200"
                      }`}
                    >
                      {modalPlanCheck.status}
                    </p>
                    {modalIsNotCompletedDay ? null : modalApiPlanCheck ? (
                      <>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{modalApiPlanCheck.summary}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Score: {modalApiPlanCheck.score}</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{modalPlanCheck.summary}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{modalPlanCheck.suggestion}</p>
                      </>
                    )}
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        );
      })() : null}

      <PlannedRunEditModal
        isOpen={Boolean(editingRecommendation)}
        recommendation={editingRecommendation}
        onConfirm={(updates) => {
          if (editingRecommendation) {
            updateTrainingRecommendation(editingRecommendation.id, updates);
            setEditingRecommendation(null);
          }
        }}
        onCancel={() => setEditingRecommendation(null)}
      />
    </div>
  );
}
