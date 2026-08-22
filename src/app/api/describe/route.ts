import OpenAI from "openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const MODEL = "Qwen/Qwen2.5-VL-72B-Instruct";

const SYSTEM = `You are the vision engine for Trace, an app that gives blind students real-time access to classroom content.

Each request contains: a camera frame of whatever the camera is pointed at, the structured notes accumulated so far, and the teacher's most recent spoken words (may be empty or noisy).

Treat ANY readable text, document, book, paper, screen, or writing surface as valid classroom content — not just a whiteboard. If you can read text or see educational material, capture it.

Respond with ONLY a JSON object — no markdown fences, no prose:
{
  "changed": boolean,   // true if there is ANY readable text or content that is not already fully captured in the notes
  "erased": boolean,    // was a significant portion of the previous content removed or replaced?
  "label": string,      // 2-4 word timeline label, e.g. "Worked example 1"
  "heading": string,    // short title of what is currently visible
  "narration": string,  // 1-2 spoken-style sentences for a blind student describing what is visible or what just changed. Never use visual-only language like colors or positions.
  "notes": string       // updated CUMULATIVE structured notes in markdown ("## " section headings, "- " bullets). Merge the previous notes with newly visible content. Keep earlier sections even if no longer visible — that history is the point of Trace.
}

Only set changed=false if: the image is too blurry to read, the camera is pointed at nothing useful (floor, ceiling, a plain wall), OR the content is already fully captured in the existing notes.
If the image is unreadable, put a short helpful hint in narration (e.g. "The camera may have moved — no readable content visible.").`;

export async function POST(req: Request) {
  let body: {
    image?: string;
    notes?: string;
    transcript?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  const context = [
    `NOTES SO FAR:\n${body.notes?.trim() || "(none — this is the first capture)"}`,
    `TEACHER'S RECENT WORDS:\n${body.transcript?.trim() || "(no transcript yet)"}`,
    "Here is the latest camera frame of the whiteboard. Compare it against the notes and respond with the JSON object.",
  ].join("\n\n");

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${body.image}` },
            },
            { type: "text", text: context },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      changed: Boolean(parsed.changed),
      erased: Boolean(parsed.erased),
      label: String(parsed.label ?? ""),
      heading: String(parsed.heading ?? ""),
      narration: String(parsed.narration ?? ""),
      notes: String(parsed.notes ?? body.notes ?? ""),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Vision request failed: ${detail}` },
      { status: 502 },
    );
  }
}
