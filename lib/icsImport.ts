import type { RunSurface, RunType, TrainingRecommendation } from "@/lib/types";

type RecommendationDraft = Omit<TrainingRecommendation, "id">;

type ParsedEvent = {
  summary: string;
  description: string;
  dtStart?: Date;
  dtEnd?: Date;
  durationMinutes?: number;
};

function unfoldIcsLines(input: string): string[] {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const result: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }

  return result;
}

function parseIcsDate(value: string): Date | undefined {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    return new Date(year, month - 1, day, 7, 0, 0, 0);
  }

  const utcMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
  }

  const localMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }

  return undefined;
}

function parseIsoDurationMinutes(value: string): number | undefined {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) {
    return undefined;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return days * 24 * 60 + hours * 60 + minutes;
}

function detectRunType(text: string): RunType {
  const t = text.toLowerCase();
  if (t.includes("interval")) return "Intervals";
  if (t.includes("tempo")) return "Tempo";
  if (t.includes("long")) return "Long";
  if (t.includes("recovery")) return "Recovery";
  if (t.includes("hill")) return "Hills";
  if (t.includes("hike")) return "Hike";
  if (t.includes("race")) return "Race";
  return "Easy";
}

function detectSurface(text: string): RunSurface {
  const t = text.toLowerCase();
  if (t.includes("treadmill")) {
    return "Treadmill";
  }
  return "Outdoor";
}

function extractDistanceMiles(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)\b/i);
  if (!match) {
    return 5;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("k")) {
    return Number((amount / 1.60934).toFixed(2));
  }
  return amount;
}

function extractIntervalCount(text: string): number | undefined {
  const match = text.match(/(\d+)\s*x\s*/i);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

function parseEvents(input: string): ParsedEvent[] {
  const lines = unfoldIcsLines(input);
  const events: ParsedEvent[] = [];
  let inEvent = false;
  let current: ParsedEvent = { summary: "", description: "" };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { summary: "", description: "" };
      continue;
    }

    if (line === "END:VEVENT") {
      if (inEvent) {
        events.push(current);
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) {
      continue;
    }

    const idx = line.indexOf(":");
    if (idx < 0) {
      continue;
    }

    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "SUMMARY") {
      current.summary = value;
    } else if (key === "DESCRIPTION") {
      current.description = value.replace(/\\n/g, "\n");
    } else if (key === "DTSTART") {
      current.dtStart = parseIcsDate(value);
    } else if (key === "DTEND") {
      current.dtEnd = parseIcsDate(value);
    } else if (key === "DURATION") {
      current.durationMinutes = parseIsoDurationMinutes(value);
    }
  }

  return events;
}

export function parseIcsToTrainingRecommendations(input: string): RecommendationDraft[] {
  const events = parseEvents(input);

  return events.map((event) => {
    const combinedText = `${event.summary} ${event.description}`.trim();
    const runType = detectRunType(combinedText);
    const surface = detectSurface(combinedText);

    const dtStart = event.dtStart ?? new Date();
    const durationMinutes =
      event.durationMinutes ??
      (event.dtStart && event.dtEnd
        ? Math.max(1, Math.round((event.dtEnd.getTime() - event.dtStart.getTime()) / 60000))
        : 45);

    const distanceMiles = extractDistanceMiles(combinedText);

    const intervalCount = extractIntervalCount(combinedText);

    return {
      date: dtStart.toISOString(),
      title: event.summary || "Planned Workout",
      notes: event.description || "Imported from .ics training plan",
      runType,
      surface,
      distanceMiles,
      durationMinutes,
      targetPace:
        runType === "Tempo" || runType === "Intervals" ? (surface === "Outdoor" ? "7:30/mi" : "8.0 mph") : undefined,
      intervalCount: runType === "Intervals" ? intervalCount ?? 4 : undefined,
      restTimeMinutes: runType === "Intervals" ? 2 : undefined,
    };
  });
}
