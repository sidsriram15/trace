import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ACTION_DESCRIPTIONS, type VoiceAction } from "@/lib/commands";

export const maxDuration = 15;

const MODEL = "Qwen/Qwen2.5-VL-72B-Instruct";

function getClient() {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) throw new Error("NEBIUS_API_KEY is not set");
  return new OpenAI({ baseURL: "https://api.tokenfactory.nebius.com/v1/", apiKey });
}

/**
 * Fallback for when the phrase-matching in src/lib/commands.ts doesn't
 * recognize what was said. That matching is fast and free but rigid — it
 * only knows the exact phrasings it was written for. This asks a model to
 * pick the closest matching action instead, so unusual phrasing still
 * works rather than just failing with "I don't know how to do that."
 *
 * Only called as a fallback, and only with the actions valid on the
 * current screen, so it can't return something the page can't handle.
 */
export async function POST(req: Request) {
  let body: { text?: string; allowed?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ action: null }, { status: 400 });
  }

  const text = body.text?.trim();
  const allowed = (body.allowed ?? []).filter(
    (a): a is VoiceAction => a in ACTION_DESCRIPTIONS,
  );
  if (!text || allowed.length === 0) {
    return NextResponse.json({ action: null });
  }

  const menu = allowed.map((a) => `- "${a}": ${ACTION_DESCRIPTIONS[a]}`).join("\n");
  const system =
    "You interpret one spoken phrase from a blind student using a voice-controlled " +
    "app, and map it to exactly one of the actions available on the current screen. " +
    `Only these actions are valid here:\n${menu}\n\n` +
    "The phrase may be informally worded, contain filler words, or be a speech-to-text " +
    "misrecognition — use your best judgement about what was meant. If nothing here " +
    'reasonably matches, respond with {"action": null}. ' +
    "Respond with ONLY a JSON object, no markdown fences, no prose: " +
    '{"action": "<one of the actions above, or null>", "value": "<optional string, only include if that action uses one>"}';

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 100,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Phrase: "${text}"` },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as { action?: string | null; value?: string };

    if (!parsed.action || !allowed.includes(parsed.action as VoiceAction)) {
      return NextResponse.json({ action: null });
    }
    return NextResponse.json({ action: parsed.action, value: parsed.value });
  } catch {
    return NextResponse.json({ action: null });
  }
}
