import OpenAI from "openai";

const AI_MODEL = "gpt-4o-mini";

let openAiClient: OpenAI | null = null;

function getClient() {
  if (!openAiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    openAiClient = new OpenAI({ apiKey });
  }

  return openAiClient;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

export async function requestAiJson<T>(instruction: string, input: unknown, maxOutputTokens = 260): Promise<T> {
  const client = getClient();

  const response = await client.responses.create({
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: instruction,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(input),
          },
        ],
      },
    ],
    max_output_tokens: maxOutputTokens,
  });

  const rawText = response.output_text?.trim();
  if (!rawText) {
    throw new Error("AI returned an empty response.");
  }

  const jsonText = extractJson(rawText);
  return JSON.parse(jsonText) as T;
}

export async function requestAiImageJson<T>(
  instruction: string,
  imageDataUrl: string,
  input?: unknown,
  maxOutputTokens = 260,
): Promise<T> {
  const client = getClient();

  const userContent: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" }> = [
    {
      type: "input_text",
      text: input === undefined ? "Extract the structured run data from this Garmin screenshot." : JSON.stringify(input),
    },
    {
      type: "input_image",
      image_url: imageDataUrl,
      detail: "auto",
    },
  ];

  const response = await client.responses.create({
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: instruction,
          },
        ],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    max_output_tokens: maxOutputTokens,
  });

  const rawText = response.output_text?.trim();
  if (!rawText) {
    throw new Error("AI returned an empty response.");
  }

  const jsonText = extractJson(rawText);
  return JSON.parse(jsonText) as T;
}
