import OpenAI from "openai";

export const runtime = "nodejs";

type OpenAiPingRequest = {
  prompt?: string;
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as OpenAiPingRequest;
    const prompt =
      typeof body.prompt === "string" && body.prompt.trim().length > 0
        ? body.prompt.trim()
        : "Give one short motivational running tip.";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 80,
    });

    return Response.json({ text: result.output_text?.trim() ?? "No response text returned." });
  } catch {
    return Response.json({ error: "Failed to contact OpenAI." }, { status: 500 });
  }
}