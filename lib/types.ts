export type RunType =
  | "Easy"
  | "Long"
  | "Endurance"
  | "Tempo"
  | "Recovery"
  | "Intervals"
  | "Race"
  | "Hills"
  | "Hike";

export type TrainingGoal =
  | "5K"
  | "10K"
  | "half-marathon"
  | "marathon"
  | "50K"
  | "general-fitness"
  | "base-building";

export type RunSurface = "Outdoor" | "Treadmill";

export type BodyRegionId =
  | "head_neck"
  | "left_shoulder"
  | "right_shoulder"
  | "shoulders"
  | "chest"
  | "abdomen"
  | "upper_back"
  | "lower_back"
  | "left_hip"
  | "right_hip"
  | "hips_glutes"
  | "back"
  | "hips"
  | "left_upper_leg"
  | "right_upper_leg"
  | "left_knee"
  | "right_knee"
  | "left_lower_leg"
  | "right_lower_leg"
  | "left_ankle_foot"
  | "right_ankle_foot";

export type PainLocationId =
  | "hip_back"
  | "hip_side"
  | "hip_front"
  | "hip_inside"
  | "quad_front_thigh"
  | "hamstring_back_thigh"
  | "inner_thigh"
  | "outer_thigh_it_band"
  | "knee_front"
  | "knee_inner"
  | "knee_outer"
  | "calf"
  | "shin"
  | "achilles"
  | "ankle"
  | "heel"
  | "arch"
  | "toes";

export type PainType = "soreness" | "sharp" | "dull ache" | "tightness" | "numbness" | "swelling" | "other";

export type PainTiming = "before run" | "during run" | "after run";

export type PainTrend = "improved" | "stayed same" | "worsened";

export type RunHealthCheckEntry = {
  id: string;
  side: "left" | "right";
  region: BodyRegionId;
  location: PainLocationId;
  severity: number;
  painType: PainType;
  timing: PainTiming;
  trend: PainTrend;
  notes?: string;
};

export type RunHealthCheck = {
  entries: RunHealthCheckEntry[];
};

export type ParsedRunDetails = {
  distanceMiles: number | null;
  durationMinutes: number | null;
  paceMinPerMile: number | null;
  runType: RunType | null;
  effortLevel: number | null;
  weather: string | null;
  fatigueIndicators: string[];
  sorenessTightness: string[];
  notes: string;
};

export type PlanCheckResult = {
  status: "completed_as_planned" | "mostly_completed" | "overperformed" | "underperformed" | "missed" | "needs_review";
  summary: string;
  score: number;
};

export type RefinedMainSetStatus = "progressed" | "repeat_controlled" | "reduced" | "caution";

export type RefinedMainSetPayload = {
  mainSetTitle: string;
  status: RefinedMainSetStatus;
  reasoningSummary: string;
  recommendedMainSet: {
    structure: string;
    speedMph: string;
    recovery: string;
    totalMainSetWorkTime: string;
    effort: string;
    executionCue: string;
  };
  comparisonToPrevious: {
    previousBest: string;
    progression: string;
    riskLevel: "low" | "moderate" | "high";
  };
  fallbackOption: {
    structure: string;
    whenToUse: string;
  };
};

export type RunLog = {
  id: string;
  date: string;
  title: string;
  surface: RunSurface;
  distanceMiles: number;
  durationMinutes: number;
  paceMinPerMile: number;
  runType: RunType;
  notes: string;
  heartRateBpm?: number;
  caloriesBurned?: number;
  shoe?: string;
  fuelingStrategy?: string;
  energyLevel: number;
  soreness: number;
  treadmillPace?: string;
  treadmillPaceDurationMinutes?: number;
  intervalCount?: number;
  restTimeMinutes?: number;
  primaryBenefitEvaluation?: string;
  bodyCheck?: RunHealthCheck;
  aiSummary?: string;
  aiSignals?: string[];
  planCheck?: PlanCheckResult;
  structuredNotes?: ParsedRunDetails;
  createdAt: string;
};

export type WeeklyInsightsPayload = {
  insights: string[];
  meta: {
    completedCount: number;
    plannedCount: number;
    missedCount: number;
    currentWeekMiles: number;
    previousWeekMiles: number;
    paceDeltaSeconds: number;
    plannedWeeklyMileage?: number | null;
    activeGoal?: TrainingGoal | null;
  };
};

export type InjuryRiskPayload = {
  riskLevel: "low" | "moderate" | "high";
  suggestion: string | null;
  metrics: {
    currentWeekMiles: number;
    previousWeekMiles: number;
    mileageIncreasePercent: number;
    projectedWeekMiles?: number;
    projectedMileageIncreasePercent?: number;
    sorenessMentionCount: number;
    hardRunRatio: number;
    paceDeclineSeconds: number;
    plannedWeeklyMileage?: number | null;
    activeGoal?: TrainingGoal | null;
    upcomingKeyWorkouts?: string[];
  };
};

export type TodayFocusPayload = {
  tip: string;
  targetDate: string | null;
  trainingTitle: string | null;
  plannedRunType?: RunType | null;
  plannedDistance?: number | null;
  tempoAtPaceSuggestion?: string | null;
  plannedWorkoutSuggestion?: string | null;
};

export type TrainingRecommendation = {
  id: string;
  date: string;
  title: string;
  notes: string;
  aiCoachNote?: string;
  runType: RunType;
  surface: RunSurface;
  distanceMiles?: number;
  durationMinutes?: number;
  targetPace?: string;
  intervalCount?: number;
  restTimeMinutes?: number;
};

export type TrainingPlanMetadata = {
  activeGoal?: TrainingGoal | null;
  raceDistance?: string | null;
  targetRaceDate?: string | null;
  planName?: string | null;
  planStartDate?: string | null;
  currentPlanWeek?: number | null;
  plannedWeeklyMileage?: number | null;
  plannedLongRunDistance?: number | null;
};

export type Goals = {
  weeklyMileage: number;
  monthlyMileage: number;
  longRunGoal: number;
  trainingPlan?: TrainingPlanMetadata;
};

export type UnitPreference = "miles" | "km";

export type Preferences = {
  darkMode: boolean;
  unit: UnitPreference;
};

export type StretchItem = {
  id: string;
  name: string;
  durationSeconds: number;
  repeatCount?: number;
};

export type StretchRoutine = {
  id: string;
  name: string;
  items: StretchItem[];
};
