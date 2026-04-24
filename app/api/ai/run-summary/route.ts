import { RUN_SUMMARY_PROMPT } from "@/lib/aiPrompts";
import { fallbackRunSummary } from "@/lib/aiFallbacks";
import { requestAiJson } from "@/lib/openai";

export const runtime = "nodejs";

type RunSummaryRequest = {
  distance?: number;
  duration?: number;
  pace?: number;
  runType?: string;
  notes?: string;
  sorenessNotes?: string[];
  effortLevel?: number | null;
  weather?: string | null;
};

type RunSummaryResponse = {
  summary: string;
  signals: string[];
};

function normalizeRequest(body: RunSummaryRequest) {
  const distanceMiles = Number(body.distance ?? 0);
  const durationMinutes = Number(body.duration ?? 0);
  const paceMinPerMile = Number(body.pace ?? 0);
  const runType = typeof body.runType === "string" && body.runType.trim() ? body.runType.trim() : "Easy";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const sorenessNotes = Array.isArray(body.sorenessNotes)
    ? body.sorenessNotes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
    : [];

  return {
    distanceMiles,
    durationMinutes,
    paceMinPerMile,
    runType,
    notes,
    sorenessNotes,
    effortLevel: typeof body.effortLevel === "number" ? body.effortLevel : null,
    weather: typeof body.weather === "string" ? body.weather : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RunSummaryRequest;
    const normalized = normalizeRequest(body);

    if (!(normalized.distanceMiles > 0) || !(normalized.durationMinutes > 0)) {
      return Response.json({ error: "distance and duration are required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(fallbackRunSummary(normalized));
    }

    const ai = await requestAiJson<RunSummaryResponse>(RUN_SUMMARY_PROMPT, {
      distanceMiles: normalized.distanceMiles,
      durationMinutes: normalized.durationMinutes,
      paceMinPerMile: normalized.paceMinPerMile,
      runType: normalized.runType,
      notes: normalized.notes,
      sorenessNotes: normalized.sorenessNotes,
      effortLevel: normalized.effortLevel,
      weather: normalized.weather,
    });

    const summary = typeof ai.summary === "string" ? ai.summary.trim() : "";
    const signals = Array.isArray(ai.signals)
      ? ai.signals.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : [];

    if (!summary) {
      return Response.json(fallbackRunSummary(normalized));
    }

    return Response.json({ summary, signals } satisfies RunSummaryResponse);
  } catch {
    return Response.json({ error: "Failed to generate run summary." }, { status: 500 });
  }
}
