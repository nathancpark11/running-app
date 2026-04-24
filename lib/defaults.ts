import type { Goals, RunLog, StretchRoutine } from "@/lib/types";

export const STARTER_RUNS: RunLog[] = [
  {
    id: "run-1",
    date: new Date().toISOString(),
    title: "Morning River Loop",
    surface: "Outdoor",
    distanceMiles: 5.2,
    durationMinutes: 44,
    paceMinPerMile: 8.46,
    runType: "Easy",
    notes: "Steady pace and relaxed breathing throughout.",
    shoe: "ASICS Gel Nimbus",
    energyLevel: 8,
    soreness: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "run-2",
    date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    title: "Tempo Session",
    surface: "Treadmill",
    distanceMiles: 4.1,
    durationMinutes: 31,
    paceMinPerMile: 7.56,
    runType: "Tempo",
    notes: "Tempo block felt controlled and efficient.",
    shoe: "Brooks Ghost",
    energyLevel: 7,
    soreness: 4,
    treadmillPace: "8.0",
    treadmillPaceDurationMinutes: 20,
    intervalCount: 4,
    restTimeMinutes: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "run-3",
    date: new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString(),
    title: "Sunday Long Run",
    surface: "Outdoor",
    distanceMiles: 9.4,
    durationMinutes: 84,
    paceMinPerMile: 8.93,
    runType: "Long",
    notes: "Kept easy effort and worked on fueling.",
    shoe: "Altra Torin 5",
    energyLevel: 6,
    soreness: 5,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString(),
  },
];

export const DEFAULT_GOALS: Goals = {
  weeklyMileage: 22,
  monthlyMileage: 90,
  longRunGoal: 12,
};

export const DEFAULT_ROUTINES: StretchRoutine[] = [
  {
    id: "routine-default",
    name: "Post Run Stretch",
    items: [
      { id: "s1", name: "Hamstrings", durationSeconds: 45, repeatCount: 2 },
      { id: "s2", name: "Quads", durationSeconds: 45, repeatCount: 2 },
      { id: "s3", name: "IT Bands", durationSeconds: 45, repeatCount: 2 },
      { id: "s4", name: "Figure 8", durationSeconds: 45, repeatCount: 2 },
      { id: "s5", name: "Groin", durationSeconds: 60 },
      { id: "s6", name: "Pigeon", durationSeconds: 60, repeatCount: 2 },
      { id: "s7", name: "Knees", durationSeconds: 60, repeatCount: 2 },
      { id: "s8", name: "Calves", durationSeconds: 30, repeatCount: 4 },
    ],
  },
];
