import type { RunLog, TrainingRecommendation, TrainingPlanMetadata, Goals } from "@/lib/types";
import { ensureAuthTables, getSql } from "@/lib/db";

type UserDataRow = {
  runs: RunLog[] | null;
  training_recommendations: TrainingRecommendation[] | null;
  goals?: Goals | null;
};

const ALERT_KEYWORDS = ["sore", "soreness", "tight", "tightness", "pain", "fatigue", "heavy", "recovery", "tired"];

export async function getUserRunsAndRecommendations(userId: string) {
  await ensureAuthTables();
  const sql = getSql();

  const rows = (await sql`
    SELECT runs, training_recommendations, goals
    FROM user_data
    WHERE user_id = ${userId}
    LIMIT 1;
  `) as UserDataRow[];

  const row = rows[0];

  return {
    runs: row?.runs ?? [],
    recommendations: row?.training_recommendations ?? [],
    goals: row?.goals ?? null,
  };
}

export function parseIsoDateSafe(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isInRange(value: Date, start: Date, end: Date): boolean {
  return value >= start && value <= end;
}

export function sumMiles(runs: RunLog[]): number {
  return Number(runs.reduce((sum, run) => sum + (Number.isFinite(run.distanceMiles) ? run.distanceMiles : 0), 0).toFixed(2));
}

export function averagePace(runs: RunLog[]): number | null {
  if (runs.length === 0) return null;
  const values = runs.map((run) => run.paceMinPerMile).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

export function extractBodyCheckNotes(run: RunLog): string[] {
  const entries = run.bodyCheck?.entries ?? [];
  return entries
    .map((entry) => [entry.location, entry.painType, entry.notes].filter(Boolean).join(" ").trim())
    .filter(Boolean);
}

export function gatherSorenessMentions(runs: RunLog[]): string[] {
  const mentions: string[] = [];

  for (const run of runs) {
    const note = run.notes?.trim();
    if (note) {
      const lower = note.toLowerCase();
      if (ALERT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
        mentions.push(note.slice(0, 180));
      }
    }

    for (const bodyNote of extractBodyCheckNotes(run)) {
      const lower = bodyNote.toLowerCase();
      if (ALERT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
        mentions.push(bodyNote.slice(0, 180));
      }
    }
  }

  return mentions;
}

export function completedVsPlanned(args: {
  runs: RunLog[];
  recommendations: TrainingRecommendation[];
  start: Date;
  end: Date;
}) {
  const planned = args.recommendations.filter((item) => {
    const date = parseIsoDateSafe(item.date);
    return date ? isInRange(date, args.start, args.end) : false;
  });

  const completed = args.runs.filter((item) => {
    const date = parseIsoDateSafe(item.date);
    return date ? isInRange(date, args.start, args.end) : false;
  });

  const completedDateKeys = new Set(completed.map((run) => run.date.slice(0, 10)));
  const missedPlanned = planned.filter((item) => !completedDateKeys.has(item.date.slice(0, 10)));

  return {
    planned,
    completed,
    missedPlanned,
  };
}

export function getPlanContext(goals: Goals | null): TrainingPlanMetadata | null {
  return goals?.trainingPlan ?? null;
}

export function getPlannedRunForDate(recommendations: TrainingRecommendation[], targetDate: string): TrainingRecommendation | null {
  const dateKey = targetDate.slice(0, 10);
  return recommendations.find((rec) => rec.date.slice(0, 10) === dateKey) ?? null;
}

export function getUpcomingKeyWorkouts(args: {
  recommendations: TrainingRecommendation[];
  start: Date;
  end: Date;
  limit?: number;
}): TrainingRecommendation[] {
  const keyWorkoutTypes = new Set(["Long", "Tempo", "Intervals", "Race", "Hills"]);

  const upcoming = args.recommendations
    .filter((rec) => {
      const date = parseIsoDateSafe(rec.date);
      return date ? isInRange(date, args.start, args.end) : false;
    })
    .filter((rec) => keyWorkoutTypes.has(rec.runType))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  return upcoming.slice(0, args.limit ?? 5);
}

export function analyzeWeekPlannedWorkouts(args: {
  recommendations: TrainingRecommendation[];
  start: Date;
  end: Date;
}): {
  workoutsByType: Record<string, number>;
  plannedMileage: number;
  hasLongRun: boolean;
  hasTempoRun: boolean;
  keyWorkouts: TrainingRecommendation[];
} {
  const planned = args.recommendations.filter((item) => {
    const date = parseIsoDateSafe(item.date);
    return date ? isInRange(date, args.start, args.end) : false;
  });

  const workoutsByType: Record<string, number> = {};
  let plannedMileage = 0;

  for (const rec of planned) {
    workoutsByType[rec.runType] = (workoutsByType[rec.runType] ?? 0) + 1;
    plannedMileage += rec.distanceMiles ?? 0;
  }

  const keyWorkoutTypes = new Set(["Long", "Tempo", "Intervals", "Race", "Hills"]);
  const keyWorkouts = planned.filter((rec) => keyWorkoutTypes.has(rec.runType));

  return {
    workoutsByType,
    plannedMileage,
    hasLongRun: "Long" in workoutsByType,
    hasTempoRun: "Tempo" in workoutsByType,
    keyWorkouts,
  };
}

function extractRaceGoalFromPlanName(planName: string): { goal: string; distance: string } | null {
  const lower = planName.toLowerCase();
  
  // Try to match common race distance patterns
  const patterns = [
    { regex: /50\s*k/i, goal: "50K", distance: "50 km" },
    { regex: /50\s*mile|50mile/i, goal: "50K", distance: "50 miles" }, // Map 50-mile to 50K goal
    { regex: /100\s*k|100k/i, goal: "50K", distance: "100 km" }, // Map 100K to 50K (closest available)
    { regex: /100\s*mile|100mile/i, goal: "50K", distance: "100 miles" }, // Map 100-mile to 50K
    { regex: /ultramarathon|ultra/i, goal: "50K", distance: "ultra" },
    { regex: /marathon/i, goal: "marathon", distance: "26.2 miles" },
    { regex: /half[- ]marathon|13\.1/i, goal: "half-marathon", distance: "13.1 miles" },
    { regex: /10k|10\s*k/i, goal: "10K", distance: "10 km" },
    { regex: /5k|5\s*k/i, goal: "5K", distance: "5 km" },
  ];
  
  for (const { regex, goal, distance } of patterns) {
    if (regex.test(lower)) {
      return { goal, distance };
    }
  }
  
  return null;
}

export function inferTrainingPlanMetadata(
  planName: string,
  recommendations: TrainingRecommendation[]
): Partial<TrainingPlanMetadata> {
  if (recommendations.length === 0) {
    return {};
  }

  // Extract dates
  const dates = recommendations
    .map((rec) => parseIsoDateSafe(rec.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return {};
  }

  const planStartDate = dates[0];
  const planEndDate = dates[dates.length - 1];
  const planDurationWeeks = Math.round((planEndDate.getTime() - planStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Extract workout metrics
  let totalMileage = 0;
  let longRunMax = 0;
  let weeklyMileageByWeek: number[] = [];

  // Group recommendations by week
  const weekBuckets: Map<number, TrainingRecommendation[]> = new Map();
  for (const rec of recommendations) {
    const date = parseIsoDateSafe(rec.date);
    if (!date) continue;

    const weekNumber = Math.floor((date.getTime() - planStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (!weekBuckets.has(weekNumber)) {
      weekBuckets.set(weekNumber, []);
    }
    weekBuckets.get(weekNumber)!.push(rec);
  }

  // Calculate per-week mileage and find max long run
  for (const recs of weekBuckets.values()) {
    let weekMileage = 0;
    for (const rec of recs) {
      const miles = rec.distanceMiles ?? 0;
      weekMileage += miles;
      totalMileage += miles;

      if (rec.runType === "Long" && miles > longRunMax) {
        longRunMax = miles;
      }
    }
    weeklyMileageByWeek.push(weekMileage);
  }

  // Calculate average weekly mileage
  const plannedWeeklyMileage =
    weeklyMileageByWeek.length > 0
      ? Number((weeklyMileageByWeek.reduce((a, b) => a + b, 0) / weeklyMileageByWeek.length).toFixed(1))
      : null;

  // Try to extract race goal from plan name
  const raceInfo = extractRaceGoalFromPlanName(planName);

  const metadata: Partial<TrainingPlanMetadata> = {
    planName: planName.trim() || null,
    planStartDate: planStartDate.toISOString(),
    currentPlanWeek: 1, // User is at week 1 when they first upload
    targetRaceDate: planEndDate.toISOString(),
    plannedWeeklyMileage,
    plannedLongRunDistance: longRunMax > 0 ? longRunMax : null,
  };

  if (raceInfo) {
    metadata.activeGoal = raceInfo.goal as TrainingPlanMetadata['activeGoal'];
    metadata.raceDistance = raceInfo.distance;
  }

  return metadata;
}
