import type { RunSurface, RunType, TrainingRecommendation } from "@/lib/types";

type RecommendationDraft = Omit<TrainingRecommendation, "id">;

type ParsedEvent = {
  summary: string;
  description: string;
  dtStart?: Date;
  dtEnd?: Date;
  durationMinutes?: number;
};

type SplitDescription = {
  notes: string;
  aiCoachNote?: string;
};

type ParseIcsOptions = {
  estimatedPace?: string;
};

type WorkoutSectionKey = "warmUp" | "mainSet" | "coolDown";

const SECTION_LABELS: Record<WorkoutSectionKey, string> = {
  warmUp: "Warm Up",
  mainSet: "Main Set",
  coolDown: "Cool Down",
};

function formatStructuredWorkoutNotes(description: string): string | undefined {
  const normalized = description
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return undefined;
  }

  const sectionRegex = /\b(warm(?:[\s-]*)up|wu|main(?:[\s-]*)set|ms|cool(?:[\s-]*)down|cd)\b\s*[:\-]?/gi;
  const matches = [...normalized.matchAll(sectionRegex)];
  if (matches.length < 2) {
    return undefined;
  }

  const sections = new Map<WorkoutSectionKey, string>();
  let warmUpEnd = -1;
  let coolDownStart = -1;

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const rawLabel = current[1].toLowerCase().replace(/[\s-]+/g, "");
    const key: WorkoutSectionKey | undefined =
      rawLabel === "warmup" || rawLabel === "wu"
        ? "warmUp"
        : rawLabel === "mainset" || rawLabel === "ms"
          ? "mainSet"
          : rawLabel === "cooldown" || rawLabel === "cd"
            ? "coolDown"
            : undefined;

    if (!key) {
      continue;
    }

    const start = current.index + current[0].length;
    const end = next?.index ?? normalized.length;
    const value = normalized
      .slice(start, end)
      .trim()
      .replace(/^[\s:;,-]+/, "")
      .replace(/[\s;,-]+$/, "")
      .trim();

    if (value) {
      sections.set(key, value);
      if (key === "warmUp") {
        warmUpEnd = end;
      }
      if (key === "coolDown") {
        coolDownStart = current.index;
      }
    }
  }

  if (!sections.has("mainSet") && warmUpEnd >= 0 && coolDownStart > warmUpEnd) {
    const middleBlock = normalized
      .slice(warmUpEnd, coolDownStart)
      .trim()
      .replace(/^[\s:;,-]+/, "")
      .replace(/[\s;,-]+$/, "")
      .trim();

    if (middleBlock) {
      sections.set("mainSet", middleBlock);
    }
  }

  if (sections.size === 0) {
    return undefined;
  }

  return (["warmUp", "mainSet", "coolDown"] as const)
    .filter((key) => sections.has(key))
    .map((key) => `${SECTION_LABELS[key]}: ${sections.get(key)}`)
    .join("\n");
}

function splitDescriptionAndAiCoachNote(description: string): SplitDescription {
  const raw = description.trim();
  if (!raw) {
    return { notes: "Imported from .ics training plan" };
  }

  const lines = raw.split(/\r?\n/);
  const keptLines: string[] = [];
  const aiLines: string[] = [];

  const markerRegex = /^(?:ai\s*(?:coach\s*)?(?:recommendation|suggestion)|suggested\s*workout|specific\s*workout\s*recommendation|coaching\s*note)\s*[:\-]\s*(.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      keptLines.push(line);
      continue;
    }

    const markerMatch = trimmed.match(markerRegex);
    if (markerMatch?.[1]) {
      aiLines.push(markerMatch[1].trim());
      continue;
    }

    keptLines.push(line);
  }

  const cleanedNotes = keptLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const structuredNotes = formatStructuredWorkoutNotes(cleanedNotes);

  const recommendation = aiLines.join(" ").trim();

  return {
    notes: structuredNotes ?? (cleanedNotes || "Imported from .ics training plan"),
    aiCoachNote: recommendation ? `AI Coach: ${recommendation}` : undefined,
  };
}

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

function detectStrengthTraining(text: string): boolean {
  return /\b(strength(?:\s+training)?|strength\s+day|weights?|weight\s+room|lifting|lift\b|resistance|cross\s*training|core\s+work|upper\s+body|lower\s+body|gym)\b/i.test(
    text,
  );
}

function parseEstimatedPaceMinutesPerMile(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const minuteMatch = trimmed.match(/^(\d+):(\d{2})(?:\s*\/\s*(?:mi|mile|miles))?$/i);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    const seconds = Number(minuteMatch[2]);
    return minutes + seconds / 60;
  }

  const mphMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*mph$/i);
  if (mphMatch) {
    const mph = Number(mphMatch[1]);
    if (mph > 0) {
      return 60 / mph;
    }
  }

  return undefined;
}

function estimateDistanceMiles(durationMinutes: number, estimatedPace: string | undefined, isStrengthTraining: boolean): number | undefined {
  if (isStrengthTraining) {
    return undefined;
  }

  const minutesPerMile = parseEstimatedPaceMinutesPerMile(estimatedPace);
  if (!minutesPerMile || minutesPerMile <= 0 || durationMinutes <= 0) {
    return undefined;
  }

  return Number((durationMinutes / minutesPerMile).toFixed(2));
}

function extractDistanceMiles(text: string, isStrengthTraining: boolean): number | undefined {
  if (isStrengthTraining) {
    return undefined;
  }

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

export function parseIcsToTrainingRecommendations(input: string, options: ParseIcsOptions = {}): RecommendationDraft[] {
  const events = parseEvents(input);

  return events.map((event) => {
    const combinedText = `${event.summary} ${event.description}`.trim();
    const runType = detectRunType(combinedText);
    const surface = detectSurface(combinedText);
    const isStrengthTraining = detectStrengthTraining(combinedText);
    const parsedDescription = splitDescriptionAndAiCoachNote(event.description);

    const dtStart = event.dtStart ?? new Date();
    const durationMinutes =
      event.durationMinutes ??
      (event.dtStart && event.dtEnd
        ? Math.max(1, Math.round((event.dtEnd.getTime() - event.dtStart.getTime()) / 60000))
        : 45);

    const explicitDistanceMiles = extractDistanceMiles(combinedText, isStrengthTraining);
    const distanceMiles = isStrengthTraining
      ? undefined
      : explicitDistanceMiles ?? estimateDistanceMiles(durationMinutes, options.estimatedPace, isStrengthTraining) ?? 5;

    const intervalCount = extractIntervalCount(combinedText);

    return {
      date: dtStart.toISOString(),
      title: event.summary || "Planned Workout",
      notes: parsedDescription.notes,
      aiCoachNote:
        runType === "Tempo" || runType === "Intervals"
          ? parsedDescription.aiCoachNote
          : undefined,
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
