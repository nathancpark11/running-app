import { requestAiJson } from "@/lib/openai";
import { getAuthenticatedUserId } from "@/lib/session";
import type { RefinedMainSetPayload } from "@/lib/types";

export const runtime = "nodejs";

type RefineMainSetRequest = {
  plannedWorkout?: Record<string, unknown>;
  previousWorkouts?: unknown[];
  context?: Record<string, unknown>;
};

const ALLOWED_STATUS = new Set<RefinedMainSetPayload["status"]>([
  "progressed",
  "repeat_controlled",
  "reduced",
  "caution",
]);

const ALLOWED_RISK_LEVEL = new Set<RefinedMainSetPayload["comparisonToPrevious"]["riskLevel"]>([
  "low",
  "moderate",
  "high",
]);

const REFINE_MAIN_SET_PROMPT = `You are an expert running coach refining the MAIN SET of a planned treadmill workout.

The uploaded .ics workout already contains:

* warm-up
* main set
* cool-down
* treadmill speed ranges

Your job is NOT to rewrite the full workout.
Your job is to make the MAIN SET more specific and progressive based on previous similar workouts.

IMPORTANT:

* Preserve the planned workout type.
* Preserve the planned warm-up and cool-down.
* Stay inside the planned main-set speed range unless there is a safety reason not to.
* Do not exceed the planned total workout distance or duration.
* Progress conservatively from what the runner has already completed.
* Use prior completed workouts as evidence of current ability.
* Prefer repeatable intervals over one overly aggressive continuous block.
* Do not prescribe all-out efforts.

INPUTS:

Planned workout from .ics:
{{planned_workout_json}}

Previous similar workouts:
{{previous_workouts_json}}

Current context:
{{context_json}}

TASK:

Create a specific MAIN SET recommendation that fits the planned workout.

Analyze:

1. Longest successful continuous effort
2. Total time at intensity
3. Whether runner faded or completed strongly
4. Appropriate progression strategy

OUTPUT FORMAT (JSON ONLY):

{
"mainSetTitle": "Short title",
"status": "progressed | repeat_controlled | reduced | caution",
"reasoningSummary": "One short sentence",
"recommendedMainSet": {
"structure": "",
"speedMph": "",
"recovery": "",
"totalMainSetWorkTime": "",
"effort": "",
"executionCue": ""
},
"comparisonToPrevious": {
"previousBest": "",
"progression": "",
"riskLevel": "low | moderate | high"
},
"fallbackOption": {
"structure": "",
"whenToUse": ""
}
}`;

function parseTextField(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateResponse(value: unknown): RefinedMainSetPayload | null {
  if (!isObject(value)) {
    return null;
  }

  const recommended = isObject(value.recommendedMainSet) ? value.recommendedMainSet : null;
  const comparison = isObject(value.comparisonToPrevious) ? value.comparisonToPrevious : null;
  const fallback = isObject(value.fallbackOption) ? value.fallbackOption : null;

  const status = typeof value.status === "string" && ALLOWED_STATUS.has(value.status as RefinedMainSetPayload["status"])
    ? (value.status as RefinedMainSetPayload["status"])
    : null;

  const riskLevel =
    comparison
    && typeof comparison.riskLevel === "string"
    && ALLOWED_RISK_LEVEL.has(comparison.riskLevel as RefinedMainSetPayload["comparisonToPrevious"]["riskLevel"])
      ? (comparison.riskLevel as RefinedMainSetPayload["comparisonToPrevious"]["riskLevel"])
      : null;

  if (!recommended || !comparison || !fallback || !status || !riskLevel) {
    return null;
  }

  return {
    mainSetTitle: parseTextField(value.mainSetTitle, "Controlled Main Set"),
    status,
    reasoningSummary: parseTextField(value.reasoningSummary, "Conservative progression based on your recent completed sessions."),
    recommendedMainSet: {
      structure: parseTextField(recommended.structure, "Repeat controlled work bouts at planned pace."),
      speedMph: parseTextField(recommended.speedMph, "Within planned range"),
      recovery: parseTextField(recommended.recovery, "Easy jog between reps"),
      totalMainSetWorkTime: parseTextField(recommended.totalMainSetWorkTime, "As planned"),
      effort: parseTextField(recommended.effort, "RPE 6-7"),
      executionCue: parseTextField(recommended.executionCue, "Keep the final rep as controlled as the first."),
    },
    comparisonToPrevious: {
      previousBest: parseTextField(comparison.previousBest, "Recent similar session"),
      progression: parseTextField(comparison.progression, "Small increase in quality time while maintaining control."),
      riskLevel,
    },
    fallbackOption: {
      structure: parseTextField(fallback.structure, "Shorten each rep while holding form."),
      whenToUse: parseTextField(fallback.whenToUse, "Use if RPE rises too early or pace drifts beyond target."),
    },
  };
}

function buildFallback(plannedWorkout: Record<string, unknown>): RefinedMainSetPayload {
  const plannedMainSet = parseTextField(plannedWorkout.mainSet, "Use your planned main set as written.");
  const speedRange = parseTextField(plannedWorkout.speedRangeMph, "planned treadmill range");

  return {
    mainSetTitle: "Controlled Main Set",
    status: "repeat_controlled",
    reasoningSummary: "A controlled repeat keeps the workout specific while reducing risk.",
    recommendedMainSet: {
      structure: plannedMainSet,
      speedMph: speedRange,
      recovery: "Take easy jog or walk recovery between work bouts.",
      totalMainSetWorkTime: "Match the planned session duration.",
      effort: "RPE 6-7",
      executionCue: "Finish feeling in control and able to hold form.",
    },
    comparisonToPrevious: {
      previousBest: "Recent similar completed workout",
      progression: "Keep the same quality volume and execute with steadier pacing.",
      riskLevel: "moderate",
    },
    fallbackOption: {
      structure: "Reduce each work interval by 10-20% and keep the same pace range.",
      whenToUse: "Use when effort spikes early, form degrades, or heart rate drifts too high.",
    },
  };
}

function buildInstruction(
  plannedWorkout: Record<string, unknown>,
  previousWorkouts: unknown[],
  context: Record<string, unknown>
): string {
  return REFINE_MAIN_SET_PROMPT
    .replace("{{planned_workout_json}}", JSON.stringify(plannedWorkout, null, 2))
    .replace("{{previous_workouts_json}}", JSON.stringify(previousWorkouts, null, 2))
    .replace("{{context_json}}", JSON.stringify(context, null, 2));
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as RefineMainSetRequest;
  const plannedWorkout = isObject(body.plannedWorkout) ? body.plannedWorkout : {};
  const previousWorkouts = Array.isArray(body.previousWorkouts) ? body.previousWorkouts : [];
  const context = isObject(body.context) ? body.context : {};

  if (!plannedWorkout || Object.keys(plannedWorkout).length === 0) {
    return Response.json({ error: "plannedWorkout is required." }, { status: 400 });
  }

  try {
    const instruction = buildInstruction(plannedWorkout, previousWorkouts, context);

    const aiResult = await requestAiJson<unknown>(
      instruction,
      {},
      520
    );

    const payload = validateResponse(aiResult);
    if (!payload) {
      return Response.json({ payload: buildFallback(plannedWorkout), source: "fallback" });
    }

    return Response.json({ payload, source: "ai" });
  } catch {
    return Response.json({ payload: buildFallback(plannedWorkout), source: "fallback" });
  }
}
