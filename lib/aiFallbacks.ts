import type { RunLog, RunType, TrainingRecommendation } from "@/lib/types";

export type InjuryRiskLevel = "low" | "moderate" | "high";

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
}) {
  const insights = [
    `Completed ${input.completedCount} of ${input.plannedCount} planned runs.`,
    `Weekly mileage: ${input.currentWeekMiles.toFixed(1)} mi (${(input.currentWeekMiles - input.previousWeekMiles).toFixed(1)} vs last week).`,
    `Average pace ${input.paceDeltaSeconds <= 0 ? "improved" : "slowed"} by ${Math.abs(input.paceDeltaSeconds)} sec/mi vs last week.`,
  ];

  if (input.missedLongRun) {
    insights.push("Missed a planned long run; endurance progression may stall.");
  }

  return {
    insights: insights.slice(0, 5),
  };
}

export function fallbackInjuryRisk(input: {
  mileageIncreasePercent: number;
  sorenessMentionCount: number;
  paceDeclineSeconds: number;
  hardRunRatio: number;
}) {
  const level: InjuryRiskLevel =
    input.mileageIncreasePercent >= 30 || input.sorenessMentionCount >= 3 || input.hardRunRatio >= 0.55
      ? "high"
      : input.mileageIncreasePercent >= 20 || input.sorenessMentionCount >= 1 || input.paceDeclineSeconds >= 15
        ? "moderate"
        : "low";

  return {
    riskLevel: level,
    explanation:
      level === "high"
        ? `Load warning: mileage up ${Math.round(input.mileageIncreasePercent)}% with repeated soreness/intensity signs.`
        : level === "moderate"
          ? `Manageable risk: load rose ${Math.round(input.mileageIncreasePercent)}% with mild recovery signals.`
          : "Training load and recovery signals are currently stable.",
    recommendation:
      level === "high"
        ? "Reduce intensity for the next 2 runs and prioritize recovery work."
        : level === "moderate"
          ? "Keep easy days easy and monitor soreness before hard sessions."
          : "Maintain progression and keep one full recovery day this week.",
  };
}

export function fallbackTodayFocus(input: {
  upcomingTitle?: string;
  upcomingRunType?: string;
  injuryRiskLevel?: InjuryRiskLevel | null;
  recentFastStarts?: boolean;
}) {
  if (input.injuryRiskLevel === "high") {
    return { tip: "Keep effort controlled early and shorten intensity if soreness appears." };
  }

  if (input.recentFastStarts) {
    return { tip: `For ${input.upcomingTitle ?? "your next run"}, settle into pace in the first 10 minutes.` };
  }

  return {
    tip: `For ${input.upcomingTitle ?? "today"}${input.upcomingRunType ? ` (${input.upcomingRunType})` : ""}, focus on even pacing and relaxed form.`,
  };
}

export function fallbackStretchRecommendation(input: {
  sorenessMentions: string[];
  latestRunType?: string;
  upcomingRunType?: string;
}) {
  const combined = input.sorenessMentions.join(" ").toLowerCase();
  let focus = "calves, hip flexors, and glutes";

  if (combined.includes("hamstring") || combined.includes("posterior")) {
    focus = "hamstrings, glutes, and calves";
  } else if (combined.includes("quad") || combined.includes("knee")) {
    focus = "quads, hip flexors, and calves";
  } else if (combined.includes("achilles") || combined.includes("calf")) {
    focus = "calves, achilles, and ankles";
  }

  return {
    focus: `Focus on ${focus}.`,
    reason: `Based on recent ${input.latestRunType ?? "runs"}${input.upcomingRunType ? ` and upcoming ${input.upcomingRunType}` : ""}.`,
  };
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
