import { NextResponse } from "next/server";

export const maxDuration = 30;

// Rachel — clear, warm, well-suited to narrating written content aloud.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
// Turbo model: much lower latency than the standard models, which matters
// here since narration has to start soon after a board update is detected.
const MODEL_ID = "eleven_turbo_v2_5";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY is not set" }, { status: 500 });
  }

  let body: { text?: string; voiceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const voiceId = body.voiceId || DEFAULT_VOICE_ID;

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach ElevenLabs" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `ElevenLabs request failed (${upstream.status}): ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
