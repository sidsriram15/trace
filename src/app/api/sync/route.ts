import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, dataKey, readToken } from "@/server/auth";
import { del, get, set } from "@/server/store";

export const runtime = "nodejs";
export const maxDuration = 30;

type Payload = { sessions: unknown[]; folders: unknown[]; updatedAt: number };

async function currentUser(): Promise<string | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

/** Pull this account's classes and folders. */
export async function GET() {
  const username = await currentUser();
  if (!username)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const data = await get<Payload>(dataKey(username));
  return NextResponse.json(
    data ?? { sessions: [], folders: [], updatedAt: 0 },
  );
}

/** Push this account's classes and folders, replacing what's stored. */
export async function PUT(request: Request) {
  const username = await currentUser();
  if (!username)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Partial<Payload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!Array.isArray(body.sessions) || !Array.isArray(body.folders))
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });

  const payload: Payload = {
    sessions: body.sessions,
    folders: body.folders,
    updatedAt: Date.now(),
  };
  await set(dataKey(username), payload);
  return NextResponse.json({ updatedAt: payload.updatedAt });
}

/** Delete everything stored for this account. */
export async function DELETE() {
  const username = await currentUser();
  if (!username)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await del(dataKey(username));
  return NextResponse.json({ ok: true });
}
