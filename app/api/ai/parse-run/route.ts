import { PARSE_RUN_PROMPT } from "@/lib/aiPrompts";
import { fallbackParseRun } from "@/lib/aiFallbacks";
import { requestAiJson } from "@/lib/openai";

export const runtime = "nodejs";

type ParseRunRequest = {
  description?: string;
};

type ParseRunResponse = {
  distanceMiles: number | null;
  durationMinutes: number | null;
  paceMinPerMile: number | null;
  runType: "Easy" | "Long" | "Endurance" | "Tempo" | "Recovery" | "Intervals" | "Race" | "Hills" | "Hike" | null;
  effortLevel: number | null;
  weather: string | null;
  fatigueIndicators: string[];
  sorenessTightness: string[];
  notes: string;
};

function sanitizeResponse(value: ParseRunResponse): ParseRunResponse {
  const normalizedEffort = typeof value.effortLevel === "number" ? Math.max(1, Math.min(10, Math.round(value.effortLevel))) : null;

  return {
    distanceMiles: typeof value.distanceMiles === "number" && value.distanceMiles > 0 ? Number(value.distanceMiles.toFixed(2)) : null,
    durationMinutes: typeof value.durationMinutes === "number" && value.durationMinutes > 0 ? Number(value.durationMinutes.toFixed(2)) : null,
    paceMinPerMile:
      typeof value.paceMinPerMile === "number" && value.paceMinPerMile > 0 ? Number(value.paceMinPerMile.toFixed(3)) : null,
    runType: value.runType ?? null,
    effortLevel: normalizedEffort,
    weather: typeof value.weather === "string" && value.weather.trim() ? value.weather.trim() : null,
    fatigueIndicators: Array.isArray(value.fatigueIndicators)
      ? value.fatigueIndicators.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : [],
    sorenessTightness: Array.isArray(value.sorenessTightness)
      ? value.sorenessTightness.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : [],
    notes: typeof value.notes === "string" ? value.notes.trim() : "",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ParseRunRequest;
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!description) {
      return Response.json({ error: "description is required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(sanitizeResponse(fallbackParseRun(description) as ParseRunResponse));
    }

    const ai = await requestAiJson<ParseRunResponse>(PARSE_RUN_PROMPT, { description }, 280);
    return Response.json(sanitizeResponse(ai));
  } catch {
    return Response.json({ error: "Failed to parse run description." }, { status: 500 });
  }
}
