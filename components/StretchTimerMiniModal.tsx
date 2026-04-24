"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STRETCH_TIMER_SESSION_KEY = "runtrack.stretchTimer.session";

type StretchTimerSession = {
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

function stepLabel(step: { name: string; round: number }): string {
  const baseName = step.name.replace(/\s\(\d+\)$/, "");
  return step.round > 1 ? `${baseName} (${step.round})` : baseName;
}

function readSession(): StretchTimerSession | null {
  try {
    const raw = window.localStorage.getItem(STRETCH_TIMER_SESSION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StretchTimerSession;
  } catch {
    return null;
  }
}

function persistSession(session: StretchTimerSession) {
  window.localStorage.setItem(STRETCH_TIMER_SESSION_KEY, JSON.stringify(session));
}

function playTone(frequency: number, durationSeconds: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationSeconds);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + durationSeconds + 0.02);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // Ignore audio playback failures (browser/device restrictions).
  }
}

function playCountdownBeep() {
  playTone(880, 0.22);
}

function playCountdownEndTone() {
  playTone(620, 0.35);
}

function tickSession(session: StretchTimerSession): StretchTimerSession {
  if (!session.running || session.steps.length === 0) {
    return session;
  }

  const next = { ...session };

  if (next.secondsLeft <= 1) {
    if (next.phase === "stretch") {
      const nextIndex = (next.currentIndex + 1) % next.steps.length;
      const nextStep = next.steps[nextIndex];
      const effectiveTransitionSeconds = nextStep.durationSeconds === 60 ? 10 : next.transitionSeconds;

      next.phase = "transition";
      next.queuedNextIndex = nextIndex;
      next.secondsLeft = effectiveTransitionSeconds;
      next.phaseDurationSeconds = effectiveTransitionSeconds;
      next.currentLabel = stepLabel({ name: nextStep.name, round: nextStep.round });
      next.upNextLabel = stepLabel({
        name: next.steps[(nextIndex + 1) % next.steps.length].name,
        round: next.steps[(nextIndex + 1) % next.steps.length].round,
      });
      return next;
    }

    const nextIndex = next.queuedNextIndex ?? (next.currentIndex + 1) % next.steps.length;
    const currentStep = next.steps[nextIndex];
    const upNextStep = next.steps[(nextIndex + 1) % next.steps.length];
    next.currentIndex = nextIndex;
    next.phase = "stretch";
    next.queuedNextIndex = null;
    next.secondsLeft = currentStep.durationSeconds;
    next.phaseDurationSeconds = currentStep.durationSeconds;
    next.currentLabel = stepLabel({ name: currentStep.name, round: currentStep.round });
    next.upNextLabel = stepLabel({ name: upNextStep.name, round: upNextStep.round });
    return next;
  }

  next.secondsLeft -= 1;
  return next;
}

export function StretchTimerMiniModal() {
  const pathname = usePathname();
  const [session, setSession] = useState<StretchTimerSession | null>(null);
  const lastBeepCueRef = useRef<string | null>(null);
  const lastEndToneCueRef = useRef<string | null>(null);

  useEffect(() => {
    setSession(readSession());
  }, [pathname]);

  useEffect(() => {
    const syncInterval = window.setInterval(() => {
      setSession(readSession());
    }, 1000);

    return () => window.clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    if (!session?.running || pathname === "/stretch-timer") {
      return;
    }

    const interval = window.setInterval(() => {
      setSession((prev) => {
        if (!prev) {
          return prev;
        }

        if (prev.phase === "stretch" && prev.secondsLeft >= 1 && prev.secondsLeft <= 5) {
          const beepCue = `${prev.phase}:${prev.currentIndex}:${prev.queuedNextIndex ?? "none"}:${prev.secondsLeft}`;
          if (lastBeepCueRef.current !== beepCue) {
            playCountdownBeep();
            lastBeepCueRef.current = beepCue;
          }
        }

        if (prev.phase === "stretch" && prev.secondsLeft <= 1) {
          const endCue = `${prev.phase}:${prev.currentIndex}:${prev.queuedNextIndex ?? "none"}`;
          if (lastEndToneCueRef.current !== endCue) {
            playCountdownEndTone();
            lastEndToneCueRef.current = endCue;
          }
        }

        const next = tickSession(prev);
        persistSession(next);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session?.running, pathname]);

  useEffect(() => {
    if (!session?.running || pathname === "/stretch-timer") {
      lastBeepCueRef.current = null;
      lastEndToneCueRef.current = null;
      return;
    }
  }, [session, pathname]);

  if (!session?.running || pathname === "/stretch-timer") {
    return null;
  }

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const duration = Math.max(1, session.phaseDurationSeconds || session.secondsLeft || 1);
  const progress = 1 - session.secondsLeft / duration;
  const strokeDashoffset = circumference - progress * circumference;
  const transitionDashoffset = -(1 - session.secondsLeft / duration) * circumference;
  const ringDashoffset = session.phase === "transition" ? transitionDashoffset : strokeDashoffset;

  return (
    <aside className="fixed right-4 bottom-20 z-60 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl md:bottom-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <div className="relative h-12 w-12 shrink-0">
          <svg width="48" height="48" className="-rotate-90">
            <circle cx="24" cy="24" r={radius} strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-700" fill="none" />
            <circle
              cx="24"
              cy="24"
              r={radius}
              strokeWidth="4"
              className="stroke-violet-500 transition-[stroke-dashoffset] duration-1000 ease-linear"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={ringDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-slate-200">
            {session.secondsLeft}s
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {session.phase === "transition" ? "Up next" : "Current stretch"}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{session.currentLabel}</p>
        </div>
      </div>
    </aside>
  );
}
