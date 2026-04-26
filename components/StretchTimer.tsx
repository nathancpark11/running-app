"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { playStretchTimerTone, primeStretchTimerAudio } from "@/lib/stretchTimerAudio";
import type { StretchRoutine } from "@/lib/types";

const STRETCH_TIMER_SESSION_KEY = "runtrack.stretchTimer.session";
const PREFERRED_ROUTINE_NAME = "Post Run Stretch";
const ROUTINE_NAME_PLACEHOLDER = "Post Run Mobility";

type StretchTimerProps = {
  routines: StretchRoutine[];
  compact?: boolean;
};

type StretchStep = {
  item: StretchRoutine["items"][number];
  round: number;
  totalRounds: number;
  baseIndex: number;
};

type StretchTimerSession = {
  routineId?: string;
  running: boolean;
  phase: "stretch" | "transition";
  currentIndex: number;
  queuedNextIndex: number | null;
  transitionSeconds: number;
  phaseDurationSeconds: number;
  secondsLeft: number;
  steps: Array<{ name: string; durationSeconds: number; round: number; baseIndex: number }>;
  currentLabel: string;
  upNextLabel: string;
};

function baseStretchName(name: string): string {
  return name.replace(/\s\(\d+\)$/, "");
}

function normalizeRoutineItems(items: StretchRoutine["items"]): StretchRoutine["items"] {
  return items.reduce<StretchRoutine["items"]>((acc, item) => {
    const name = baseStretchName(item.name);
    const repeatCount = Math.max(1, item.repeatCount ?? 1);
    const last = acc[acc.length - 1];

    if (last && last.name === name && last.durationSeconds === item.durationSeconds) {
      last.repeatCount = (last.repeatCount ?? 1) + repeatCount;
      return acc;
    }

    acc.push({
      ...item,
      name,
      repeatCount,
    });

    return acc;
  }, []);
}

function renderStretchName(name: string, round: number = 1) {
  const baseName = baseStretchName(name);

  return (
    <>
      {baseName}
      {round > 1 ? <span className="text-xs text-slate-500 dark:text-slate-400"> ({round})</span> : null}
    </>
  );
}

function playCountdownBeep() {
  playStretchTimerTone(880, 0.22);
}

function playCountdownEndTone() {
  playStretchTimerTone(620, 0.35);
}

function stretchLabel(name: string, round: number): string {
  const baseName = baseStretchName(name);
  return round > 1 ? `${baseName} (${round})` : baseName;
}

function findPreferredRoutineIndex(routines: StretchRoutine[]): number {
  const preferredIndex = routines.findIndex(
    (routine) => routine.name.toLowerCase() === PREFERRED_ROUTINE_NAME.toLowerCase()
  );
  return preferredIndex >= 0 ? preferredIndex : 0;
}

function routineLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : ROUTINE_NAME_PLACEHOLDER;
}

function transitionDurationForStep(step: StretchStep | undefined, transitionSeconds: number): number {
  if (!step) {
    return 0;
  }

  return step.item.durationSeconds === 60 ? 10 : transitionSeconds;
}

export function StretchTimer({ routines, compact = false }: StretchTimerProps) {
  const [routineIndex, setRoutineIndex] = useState(() => findPreferredRoutineIndex(routines));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [transitionSeconds, setTransitionSeconds] = useState(4);
  const [phase, setPhase] = useState<"stretch" | "transition">("stretch");
  const [queuedNextIndex, setQueuedNextIndex] = useState<number | null>(null);
  const [showCompletionState, setShowCompletionState] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const lastBeepCueRef = useRef<string | null>(null);
  const lastEndToneCueRef = useRef<string | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);

  const activeRoutine = routines[routineIndex] ?? routines[0];
  const normalizedItems = useMemo(() => {
    if (!activeRoutine) {
      return [];
    }
    return normalizeRoutineItems(activeRoutine.items);
  }, [activeRoutine]);

  const steps = useMemo<StretchStep[]>(() => {
    if (normalizedItems.length === 0) {
      return [];
    }

    return normalizedItems.flatMap((item, baseIndex) => {
      const repeatCount = Math.max(1, item.repeatCount ?? 1);
      return Array.from({ length: repeatCount }, (_, index) => ({
        item,
        round: index + 1,
        totalRounds: repeatCount,
        baseIndex,
      }));
    });
  }, [normalizedItems]);
  const activeStep = steps[currentIndex];
  const upcomingStepIndex = queuedNextIndex ?? (currentIndex + 1) % Math.max(steps.length, 1);
  const upcomingStep = steps[upcomingStepIndex];
  const effectiveTransitionSeconds = upcomingStep?.item.durationSeconds === 60 ? 10 : transitionSeconds;
  const [secondsLeft, setSecondsLeft] = useState(activeStep?.item.durationSeconds ?? 0);

  function clearCompletionTimer() {
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }

  function completeRoutine() {
    if (steps.length === 0) {
      return;
    }

    clearCompletionTimer();
    setRunning(false);
    setShowCompletionState(true);
    setPhase("stretch");
    setQueuedNextIndex(null);
    setSecondsLeft(0);

    completionTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex(0);
      setPhase("stretch");
      setQueuedNextIndex(null);
      setSecondsLeft(steps[0]?.item.durationSeconds ?? 0);
      setShowCompletionState(false);
      completionTimeoutRef.current = null;
    }, 1600);
  }

  useEffect(() => {
    if (steps.length === 0) {
      return;
    }

    if (currentIndex >= steps.length) {
      setCurrentIndex(0);
      setPhase("stretch");
      setQueuedNextIndex(null);
      setSecondsLeft(steps[0].item.durationSeconds);
    }
  }, [steps, currentIndex]);

  useEffect(() => {
    return () => {
      clearCompletionTimer();
    };
  }, []);

  useEffect(() => {
    if (!running || steps.length === 0 || showCompletionState) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 0) {
          if (phase === "stretch") {
            const isLastStretch = currentIndex === steps.length - 1;
            const nextIndex = (currentIndex + 1) % steps.length;
            const endCue = `${phase}:${currentIndex}:${queuedNextIndex ?? "none"}`;
            if (lastEndToneCueRef.current !== endCue) {
              playCountdownEndTone();
              lastEndToneCueRef.current = endCue;
            }

            if (isLastStretch) {
              completeRoutine();
              return 0;
            }

            if (effectiveTransitionSeconds > 0) {
              setPhase("transition");
              setQueuedNextIndex(nextIndex);
              return effectiveTransitionSeconds;
            }

            setCurrentIndex(nextIndex);
            return steps[nextIndex]?.item.durationSeconds ?? 0;
          }

          const nextIndex = queuedNextIndex ?? (currentIndex + 1) % steps.length;
          setCurrentIndex(nextIndex);
          setPhase("stretch");
          setQueuedNextIndex(null);
          return steps[nextIndex]?.item.durationSeconds ?? 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running, currentIndex, steps, phase, queuedNextIndex, effectiveTransitionSeconds, showCompletionState]);

  useEffect(() => {
    if (!running) {
      lastBeepCueRef.current = null;
      lastEndToneCueRef.current = null;
      return;
    }

    if (phase !== "stretch" || secondsLeft < 1 || secondsLeft > 5) {
      return;
    }

    const cue = `${phase}:${currentIndex}:${queuedNextIndex ?? "none"}:${secondsLeft}`;
    if (lastBeepCueRef.current !== cue) {
      playCountdownBeep();
      lastBeepCueRef.current = cue;
    }
  }, [running, secondsLeft, phase, currentIndex, queuedNextIndex]);

  const progress = useMemo(() => {
    const duration = phase === "transition" ? effectiveTransitionSeconds : (activeStep?.item.durationSeconds ?? 0);

    if (!duration) {
      return 0;
    }
    return 1 - secondsLeft / duration;
  }, [activeStep, secondsLeft, phase, effectiveTransitionSeconds]);

  const totalTimeLeftLabel = useMemo(() => {
    if (!activeStep || steps.length === 0) {
      return formatDuration(0);
    }

    let totalRemainingSeconds = Math.max(0, secondsLeft);

    if (phase === "stretch") {
      for (let index = currentIndex + 1; index < steps.length; index += 1) {
        totalRemainingSeconds += transitionDurationForStep(steps[index], transitionSeconds);
        totalRemainingSeconds += steps[index]?.item.durationSeconds ?? 0;
      }
    } else {
      const nextStretchIndex = queuedNextIndex ?? currentIndex + 1;

      for (let index = nextStretchIndex; index < steps.length; index += 1) {
        totalRemainingSeconds += steps[index]?.item.durationSeconds ?? 0;

        if (index < steps.length - 1) {
          totalRemainingSeconds += transitionDurationForStep(steps[index + 1], transitionSeconds);
        }
      }
    }

    return formatDuration(totalRemainingSeconds / 60);
  }, [activeStep, currentIndex, phase, queuedNextIndex, secondsLeft, steps, transitionSeconds]);

  if (!activeRoutine || !activeStep) {
    return null;
  }

  const radius = compact ? 44 : 124;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;
  const transitionDashoffset = -(1 - secondsLeft / Math.max(1, effectiveTransitionSeconds)) * circumference;
  const ringDashoffset = showCompletionState
    ? 0
    : phase === "transition"
      ? transitionDashoffset
      : strokeDashoffset;
  const ringStrokeClass = showCompletionState
    ? "stroke-emerald-500"
    : phase === "transition"
      ? "stroke-amber-500 transition-[stroke-dashoffset] duration-1000 ease-linear"
      : "stroke-violet-500 transition-[stroke-dashoffset] duration-1000 ease-linear";
  const nextIndexForUpNext =
    phase === "transition"
      ? (queuedNextIndex !== null ? (queuedNextIndex + 1) % steps.length : (currentIndex + 1) % steps.length)
      : (currentIndex + 1) % steps.length;
  const transitionTargetStep = queuedNextIndex !== null ? steps[queuedNextIndex] : steps[(currentIndex + 1) % steps.length];
  const upNext = steps[nextIndexForUpNext];

  function toggleRunning() {
    void primeStretchTimerAudio();
    clearCompletionTimer();
    setRunning((prev) => {
      if (prev) {
        setShowCompletionState(false);
        setPhase("stretch");
        setQueuedNextIndex(null);
        setSecondsLeft(activeStep.item.durationSeconds);
        return false;
      }

      if (showCompletionState) {
        setCurrentIndex(0);
        setPhase("stretch");
        setQueuedNextIndex(null);
        setSecondsLeft(steps[0]?.item.durationSeconds ?? 0);
        setShowCompletionState(false);
      }
      return true;
    });
  }

  function jumpToStretch(baseIndex: number) {
    const nextIndex = steps.findIndex((step) => step.baseIndex === baseIndex);
    if (nextIndex < 0) {
      return;
    }

    clearCompletionTimer();
    setCurrentIndex(nextIndex);
    setPhase("stretch");
    setQueuedNextIndex(null);
    setSecondsLeft(steps[nextIndex].item.durationSeconds);
    setShowCompletionState(false);
    setRunning(false);
  }

  useEffect(() => {
    if (routines.length === 0) {
      return;
    }

    if (routineIndex >= routines.length) {
      setRoutineIndex(findPreferredRoutineIndex(routines));
    }
  }, [routines, routineIndex]);

  useEffect(() => {
    if (sessionHydrated || steps.length === 0) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(STRETCH_TIMER_SESSION_KEY);
      if (!raw) {
        setSessionHydrated(true);
        return;
      }

      const session = JSON.parse(raw) as Partial<StretchTimerSession>;
      if (typeof session.routineId === "string") {
        const nextRoutineIndex = routines.findIndex((routine) => routine.id === session.routineId);
        if (nextRoutineIndex >= 0) {
          setRoutineIndex(nextRoutineIndex);
        }
      }

      if (typeof session.transitionSeconds === "number") {
        setTransitionSeconds(session.transitionSeconds);
      }

      if (session.currentIndex !== undefined && Number.isInteger(session.currentIndex)) {
        const clampedIndex = Math.max(0, Math.min(steps.length - 1, session.currentIndex));
        setCurrentIndex(clampedIndex);
      }

      if (session.queuedNextIndex !== undefined) {
        if (session.queuedNextIndex === null) {
          setQueuedNextIndex(null);
        } else if (Number.isInteger(session.queuedNextIndex)) {
          const clampedQueued = Math.max(0, Math.min(steps.length - 1, session.queuedNextIndex));
          setQueuedNextIndex(clampedQueued);
        }
      }

      if (session.phase === "stretch" || session.phase === "transition") {
        setPhase(session.phase);
      }

      if (typeof session.secondsLeft === "number" && session.secondsLeft > 0) {
        setSecondsLeft(session.secondsLeft);
      }

      if (session.running === true) {
        setRunning(true);
      }
    } catch {
      // Ignore malformed stored timer state.
    } finally {
      setSessionHydrated(true);
    }
  }, [sessionHydrated, steps, routines]);

  useEffect(() => {
    if (!sessionHydrated || steps.length === 0) {
      return;
    }

    const currentLabel =
      phase === "transition"
        ? stretchLabel(transitionTargetStep.item.name, transitionTargetStep.round)
        : stretchLabel(activeStep.item.name, activeStep.round);
    const upNextLabel = upNext ? stretchLabel(upNext.item.name, upNext.round) : "-";

    const session: StretchTimerSession = {
      routineId: activeRoutine.id,
      running,
      phase,
      currentIndex,
      queuedNextIndex,
      transitionSeconds,
      phaseDurationSeconds: phase === "transition" ? effectiveTransitionSeconds : activeStep.item.durationSeconds,
      secondsLeft,
      steps: steps.map((step) => ({
        name: step.item.name,
        durationSeconds: step.item.durationSeconds,
        round: step.round,
        baseIndex: step.baseIndex,
      })),
      currentLabel,
      upNextLabel,
    };

    window.localStorage.setItem(STRETCH_TIMER_SESSION_KEY, JSON.stringify(session));
  }, [sessionHydrated, running, phase, currentIndex, queuedNextIndex, transitionSeconds, secondsLeft, steps, activeStep, transitionTargetStep, upNext]);

  return (
    <div className="relative space-y-4 pt-1">
      <p className="absolute top-0 right-0 text-xs text-slate-500 dark:text-slate-400">Total time left: {totalTimeLeftLabel}</p>
      <div className="relative mx-auto w-fit py-2">
        <svg width={radius * 2 + 20} height={radius * 2 + 20} className="-rotate-90">
          <circle
            cx={radius + 10}
            cy={radius + 10}
            r={radius}
            strokeWidth="10"
            className="stroke-slate-200 dark:stroke-slate-700"
            fill="none"
          />
          <circle
            cx={radius + 10}
            cy={radius + 10}
            r={radius}
            strokeWidth="10"
              className={ringStrokeClass}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
              strokeDashoffset={ringDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showCompletionState ? (
            <>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Check className="h-8 w-8" />
              </span>
              <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">Complete</p>
            </>
          ) : (
            <p className="text-6xl font-semibold text-slate-900 dark:text-slate-100">{secondsLeft}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 py-1">
        <p className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {showCompletionState ? "Routine" : phase === "transition" ? "Up next" : "Current stretch"}
        </p>
        <h3 className="-mt-2 text-center text-4xl font-semibold text-slate-900 dark:text-slate-100">
          {showCompletionState
            ? "Complete"
            : phase === "transition"
              ? renderStretchName(transitionTargetStep.item.name, transitionTargetStep.round)
              : renderStretchName(activeStep.item.name, activeStep.round)}
        </h3>

        <button
          type="button"
          onClick={toggleRunning}
          className="mx-auto mt-4 flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-blue-700"
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {running ? "Stop" : "Start"}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-end">
          <select
            value={activeRoutine.id}
            onChange={(e) => {
              const nextIdx = routines.findIndex((routine) => routine.id === e.target.value);
              if (nextIdx >= 0) {
                clearCompletionTimer();
                setRoutineIndex(nextIdx);
                setCurrentIndex(0);
                setPhase("stretch");
                setQueuedNextIndex(null);
                const nextItems = normalizeRoutineItems(routines[nextIdx]?.items ?? []);
                setSecondsLeft(nextItems[0]?.durationSeconds ?? 0);
                setShowCompletionState(false);
                setRunning(false);
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routineLabel(routine.name)}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Up next: {upNext ? renderStretchName(upNext.item.name, upNext.round) : "-"}
        </p>

        <div className={`mt-4 ${compact ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
          {normalizedItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpToStretch(index)}
              className={`w-full rounded-lg border px-2 py-2 text-left text-sm transition ${
                index === activeStep.baseIndex
                  ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {renderStretchName(item.name)} ({item.durationSeconds}s)
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Transition Time</p>
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {[4, 6, 8, 10].map((seconds) => (
            <button
              key={seconds}
              type="button"
              onClick={() => {
                setTransitionSeconds(seconds);
                if (!running && phase === "transition") {
                  setSecondsLeft(upcomingStep?.item.durationSeconds === 60 ? 10 : seconds);
                }
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                transitionSeconds === seconds
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
