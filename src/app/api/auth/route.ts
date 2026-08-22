import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createAccount,
  issueToken,
  normalizeUsername,
  readToken,
  validatePin,
  validateUsername,
  verifyAccount,
} from "@/server/auth";

export const runtime = "nodejs";

/** Who's signed in on this device, if anyone. */
export async function GET() {
  const store = await cookies();
  const username = await readToken(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ username });
}

/** Create an account or sign in to an existing one. */
export async function POST(request: Request) {
  let body: { username?: unknown; pin?: unknown; intent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const username = normalizeUsername(String(body.username ?? ""));
  const pin = String(body.pin ?? "");
  const intent = body.intent === "create" ? "create" : "signin";

  const nameError = validateUsername(username);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  if (intent === "create") {
    const pinError = validatePin(pin);
    if (pinError) return NextResponse.json({ error: pinError }, { status: 400 });
    const created = await createAccount(username, pin);
    if (!created.ok)
      return NextResponse.json({ error: created.error }, { status: 409 });
  } else {
    const result = await verifyAccount(username, pin);
    if (!result.ok)
      return NextResponse.json(
        { error: result.error },
        { status: result.retryAfterMs ? 429 : 401 },
      );
  }

  const response = NextResponse.json({ username });
  response.cookies.set(SESSION_COOKIE, await issueToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** Sign out. Class history stays on the server, ready for the next sign-in. */
export async function DELETE() {
  const response = NextResponse.json({ username: null });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
