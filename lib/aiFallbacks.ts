import type { RunLog, RunType, TrainingRecommendation } from "@/lib/types";

export type InjuryRiskLevel = "low" | "moderate" | "high";

export function fallbackRunTitle(input: {
  distanceMiles: number;
  runType: RunType;
}) {
  const labelByType: Record<RunType, string> = {
    Easy: "Easy Run",
    Long: "Long Run",
    Endurance: "Endurance Run",
    Tempo: "Tempo Session",
    Recovery: "Recovery Run",
    Intervals: "Intervals Session",
    Hills: "Hill Session",
    Hike: "Hike",
    Race: "Race Effort",
  };

  const formattedDistance = Number.isInteger(input.distanceMiles)
    ? input.distanceMiles.toFixed(0)
    : input.distanceMiles.toFixed(1);

  return `${labelByType[input.runType]} ${formattedDistance} mi`;
}

export function fallbackRunSummary(input: {
  distanceMiles: number;
  durationMinutes: number;
  paceMinPerMile: number;
  runType: RunType;
  notes?: string;
  sorenessNotes?: string[];
  effortLevel?: number | null;
}) {
  const hints: string[] = [];

  if (input.effortLevel && input.effortLevel >= 8) {
    hints.push("high effort reported");
  }
  if ((input.sorenessNotes ?? []).length > 0) {
    hints.push("soreness or tightness noted");
  }
  if ((input.notes ?? "").toLowerCase().includes("fatigue") || (input.notes ?? "").toLowerCase().includes("heavy")) {
    hints.push("fatigue signs in notes");
  }

  const summary = `${input.runType} run completed: ${input.distanceMiles.toFixed(1)} mi in ${Math.round(input.durationMinutes)} min at ${input.paceMinPerMile.toFixed(2)} min/mi.${
    hints.length > 0 ? ` Watch ${hints.slice(0, 2).join(" and ")}.` : ""
  }`;

  return {
    title: fallbackRunTitle({ distanceMiles: input.distanceMiles, runType: input.runType }),
    summary,
    signals: hints,
  };
}

export function fallbackWeeklyInsights(input: {
  completedCount: number;
  plannedCount: number;
  currentWeekMiles: number;
  previousWeekMiles: number;
  paceDeltaSeconds: number;
  missedLongRun: boolean;
  plannedWeeklyMileage?: number | null;
  missedCount: number;
}) {
  const mileageDelta = input.currentWeekMiles - input.previousWeekMiles;
  const mileageDeltaPercent = input.previousWeekMiles > 0
    ? Math.round((mileageDelta / input.previousWeekMiles) * 100)
    : 0;
  const planDelta = input.plannedWeeklyMileage != null
    ? input.currentWeekMiles - input.plannedWeeklyMileage
    : null;

  const insights = [
    `[POSITIVE] Completed ${input.completedCount} of ${input.plannedCount} planned runs, which keeps weekly consistency moving in the right direction.`,
    `[TREND] Weekly mileage is ${input.currentWeekMiles.toFixed(1)} mi, ${mileageDelta >= 0 ? "up" : "down"} ${Math.abs(mileageDelta).toFixed(1)} mi${input.previousWeekMiles > 0 ? ` (${Math.abs(mileageDeltaPercent)}%)` : ""} versus last week.`,
    `[TREND] Average pace ${input.paceDeltaSeconds <= 0 ? "improved" : "slowed"} by ${Math.abs(input.paceDeltaSeconds)} sec/mi compared with last week, which ${input.paceDeltaSeconds <= 0 ? "suggests the current load is still manageable" : "can point to accumulating fatigue if the trend continues"}.`,
    input.missedLongRun || input.missedCount > 0
      ? `[RISK] Missing ${input.missedCount} planned workout${input.missedCount === 1 ? "" : "s"}${input.missedLongRun ? ", including a long run," : ""} can weaken endurance progression and usually signals a recovery mismatch.`
      : `[ACTION] Keep the next easy day truly easy so this week’s load turns into adaptation instead of lingering fatigue.`,
  ];

  if (planDelta != null) {
    insights.push(
      `[ACTION] ${planDelta >= 0 ? "Hold" : "Build toward"} your planned weekly volume of ${input.plannedWeeklyMileage?.toFixed(1)} mi with small adjustments instead of trying to force one big catch-up session.`
    );
  }

  return {
    insights: insights.slice(0, 5),
  };
}

export function fallbackInjuryRisk(input: {
  mileageIncreasePercent: number;
  projectedMileageIncreasePercent?: number;
  sorenessMentionCount: number;
  paceDeclineSeconds: number;
  hardRunRatio: number;
}) {
  const projectedIncrease = input.projectedMileageIncreasePercent ?? input.mileageIncreasePercent;
  const level: InjuryRiskLevel =
    input.mileageIncreasePercent >= 30 || projectedIncrease >= 30 || input.sorenessMentionCount >= 3 || input.hardRunRatio >= 0.55
      ? "high"
      : input.mileageIncreasePercent >= 20 || projectedIncrease >= 20 || input.sorenessMentionCount >= 1 || input.paceDeclineSeconds >= 15
        ? "moderate"
        : "low";

  return {
    riskLevel: level,
    suggestion:
      level === "high"
        ? `Mileage is trending up ${Math.round(Math.max(input.mileageIncreasePercent, projectedIncrease))}% — reduce intensity for the next 2 runs.`
        : level === "moderate"
          ? "Keep easy days easy and monitor soreness before hard sessions."
          : null,
  };
}

export function fallbackTodayFocus(input: {
  upcomingTitle?: string;
  upcomingRunType?: string;
  injuryRiskLevel?: InjuryRiskLevel | null;
  recentFastStarts?: boolean;
  tempoAtPaceSuggestion?: string | null;
  plannedWorkoutSuggestion?: string | null;
}) {
  if (input.injuryRiskLevel === "high") {
    return {
      tip: "Keep effort controlled early and shorten intensity if soreness appears.",
      tempoAtPaceSuggestion: input.tempoAtPaceSuggestion ?? null,
      plannedWorkoutSuggestion: input.plannedWorkoutSuggestion ?? null,
    };
  }

  if (input.recentFastStarts) {
    return {
      tip: `For ${input.upcomingTitle ?? "your next run"}, settle into pace in the first 10 minutes.`,
      tempoAtPaceSuggestion: input.tempoAtPaceSuggestion ?? null,
      plannedWorkoutSuggestion: input.plannedWorkoutSuggestion ?? null,
    };
  }

  return {
    tip: `For ${input.upcomingTitle ?? "today"}${input.upcomingRunType ? ` (${input.upcomingRunType})` : ""}, focus on even pacing and relaxed form.`,
    tempoAtPaceSuggestion: input.tempoAtPaceSuggestion ?? null,
    plannedWorkoutSuggestion: input.plannedWorkoutSuggestion ?? null,
  };
}

export function fallbackPlanCheckAnalysis(input: {
  plannedType: string;
  plannedDistanceMiles: number | null;
  plannedDurationMinutes: number | null;
  targetPaceMin: number | null;
  targetPaceMax: number | null;
  workoutGoal: string | null;
  actualDistanceMiles: number;
  actualDurationMinutes: number;
  avgPaceMinPerMile: number;
  effectivePaceMinPerMile?: number | null;
  effectivePaceMaxPerMile?: number | null;
  rpe: number | null;
}) {
  const distanceDelta =
    typeof input.plannedDistanceMiles === "number"
      ? Number((input.actualDistanceMiles - input.plannedDistanceMiles).toFixed(2))
      : null;

  const comparedPaceMin = typeof input.effectivePaceMinPerMile === "number" ? input.effectivePaceMinPerMile : input.avgPaceMinPerMile;
  const comparedPaceMax = typeof input.effectivePaceMaxPerMile === "number" ? input.effectivePaceMaxPerMile : comparedPaceMin;
  const comparedPaceMid = Number(((comparedPaceMin + comparedPaceMax) / 2).toFixed(3));
  const paceSource =
    typeof input.effectivePaceMinPerMile === "number"
      ? "main-set pace from notes"
      : "overall average pace";

  const inPaceRange =
    typeof input.targetPaceMin === "number"
    && typeof input.targetPaceMax === "number"
    && comparedPaceMid >= input.targetPaceMin
    && comparedPaceMid <= input.targetPaceMax;

  const distanceMet = distanceDelta === null || distanceDelta >= -0.2;
  const overDistance = distanceDelta !== null && distanceDelta >= 0.3;
  const typeLabel = input.plannedType.toLowerCase();

  let status: "completed_as_planned" | "mostly_completed" | "overperformed" | "underperformed" | "missed" | "needs_review";
  if (!distanceMet || !inPaceRange) {
    status = "underperformed";
  } else if (overDistance && inPaceRange) {
    status = "overperformed";
  } else if (distanceMet && inPaceRange) {
    status = "completed_as_planned";
  } else {
    status = "mostly_completed";
  }

  const scoreBase =
    status === "completed_as_planned" ? 92
    : status === "overperformed" ? 88
    : status === "mostly_completed" ? 78
    : status === "underperformed" ? 62
    : 50;
  const effortPenalty = input.rpe !== null && input.rpe >= 9 ? 8 : input.rpe !== null && input.rpe >= 8 ? 4 : 0;
  const score = Math.max(0, Math.min(100, scoreBase - effortPenalty));

  const summaryRaw =
    status === "completed_as_planned"
      ? `${typeLabel} run matched planned distance and ${paceSource === "main-set pace from notes" ? "main-set" : "pace"} target, delivering the intended stimulus.`
      : status === "overperformed"
      ? `${typeLabel} run exceeded planned distance while holding target effort, increasing load beyond plan.`
      : status === "mostly_completed"
      ? `${typeLabel} run generally matched plan, but pacing consistency was mixed relative to the intended target.`
      : `${typeLabel} run missed key plan targets for distance or pace, reducing the intended workout effect.`;

  const summaryWords = summaryRaw.trim().split(/\s+/).slice(0, 35);
  const summary = summaryWords.join(" ");

  return { status, summary, score };
}

export function fallbackParseRun(description: string) {
  const text = description.trim();
  const lower = text.toLowerCase();

  const distanceMatch = lower.match(/(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)\b/);
  const minutesMatch = lower.match(/(\d{1,3})\s*(min|mins|minute|minutes)\b/);
  const paceMatch = lower.match(/(\d{1,2}):(\d{2})\s*\/?\s*(?:\/mi|min\/mi|per mile)/);
  const effortMatch = lower.match(/effort\s*(\d{1,2})|rpe\s*(\d{1,2})/);

  const distanceMiles = distanceMatch
    ? distanceMatch[2].startsWith("k")
      ? Number((Number(distanceMatch[1]) / 1.60934).toFixed(2))
      : Number(distanceMatch[1])
    : null;

  const durationMinutes = minutesMatch ? Number(minutesMatch[1]) : null;
  const paceMinPerMile = paceMatch ? Number(paceMatch[1]) + Number(paceMatch[2]) / 60 : distanceMiles && durationMinutes ? Number((durationMinutes / distanceMiles).toFixed(3)) : null;

  const runType: RunType | null =
    lower.includes("tempo")
      ? "Tempo"
      : lower.includes("interval")
        ? "Intervals"
        : lower.includes("long")
          ? "Long"
          : lower.includes("recovery")
            ? "Recovery"
            : lower.includes("hill")
              ? "Hills"
              : lower.includes("hike")
                ? "Hike"
                : lower.includes("race")
                  ? "Race"
                  : lower.includes("easy")
                    ? "Easy"
                    : null;

  const weatherKeywords = ["humid", "windy", "hot", "cold", "rain", "snow"];
  const fatigueKeywords = ["fatigue", "heavy", "tired", "almost quit", "bonked", "drained"];
  const sorenessKeywords = ["sore", "tight", "calf", "achilles", "knee", "hip", "hamstring", "shin"];

  const weather = weatherKeywords.find((keyword) => lower.includes(keyword)) ?? null;
  const fatigueIndicators = fatigueKeywords.filter((keyword) => lower.includes(keyword));
  const sorenessTightness = sorenessKeywords.filter((keyword) => lower.includes(keyword));

  const effortLevel = effortMatch ? Number(effortMatch[1] ?? effortMatch[2]) : null;

  return {
    distanceMiles,
    durationMinutes,
    paceMinPerMile,
    runType,
    effortLevel,
    weather,
    fatigueIndicators,
    sorenessTightness,
    notes: text,
  };
}

export function summarizeRecentLoad(runs: RunLog[], recommendations: TrainingRecommendation[]) {
  return {
    runs: runs.length,
    planned: recommendations.length,
  };
}
