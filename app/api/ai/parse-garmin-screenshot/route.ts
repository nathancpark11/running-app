import { GARMIN_SCREENSHOT_PROMPT } from "@/lib/aiPrompts";
import { requestAiImageJson } from "@/lib/openai";
import type { RunSurface } from "@/lib/types";

export const runtime = "nodejs";

type ParseGarminScreenshotRequest = {
  imageDataUrl?: string;
};

type ParseGarminScreenshotResponse = {
  surface: RunSurface | null;
  distanceMiles: number | null;
  heartRateBpm: number | null;
  caloriesBurned: number | null;
  totalDurationSeconds: number | null;
  runDate: string | null;
  startTime: string | null;
  primaryBenefitEvaluation: string | null;
};

function sanitizeResponse(value: ParseGarminScreenshotResponse): ParseGarminScreenshotResponse {
  return {
    surface: value.surface === "Outdoor" || value.surface === "Treadmill" ? value.surface : null,
    distanceMiles: typeof value.distanceMiles === "number" && value.distanceMiles > 0 ? Number(value.distanceMiles.toFixed(2)) : null,
    heartRateBpm: typeof value.heartRateBpm === "number" && value.heartRateBpm > 0 ? Math.round(value.heartRateBpm) : null,
    caloriesBurned: typeof value.caloriesBurned === "number" && value.caloriesBurned > 0 ? Math.round(value.caloriesBurned) : null,
    totalDurationSeconds:
      typeof value.totalDurationSeconds === "number" && value.totalDurationSeconds > 0 ? Math.round(value.totalDurationSeconds) : null,
    runDate: (() => {
      if (typeof value.runDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.runDate.trim())) {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${value.runDate.trim().slice(5)}`;
      }
      return null;
    })(),
    startTime: typeof value.startTime === "string" && /^\d{2}:\d{2}$/.test(value.startTime.trim()) ? value.startTime.trim() : null,
    primaryBenefitEvaluation:
      typeof value.primaryBenefitEvaluation === "string" && value.primaryBenefitEvaluation.trim()
        ? value.primaryBenefitEvaluation.trim()
        : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ParseGarminScreenshotRequest;
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";

    if (!imageDataUrl) {
      return Response.json({ error: "imageDataUrl is required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is required to parse Garmin screenshots." }, { status: 503 });
    }

    const ai = await requestAiImageJson<ParseGarminScreenshotResponse>(
      GARMIN_SCREENSHOT_PROMPT,
      imageDataUrl,
      { source: "garmin-run-screenshot" },
      280,
    );

    return Response.json(sanitizeResponse(ai));
  } catch {
    return Response.json({ error: "Failed to parse Garmin screenshot." }, { status: 500 });
  }
}