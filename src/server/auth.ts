import { get, set, setIfAbsent } from "@/server/store";

/**
 * Username + PIN accounts. No email, no password manager, no recovery
 * flow — a blind student on a shared school device can sign in by
 * remembering four digits, which is the whole point.
 *
 * A 4-6 digit PIN is a small secret, so the two things protecting it are
 * doing the work here: PBKDF2 with a per-account salt (so a dump of the
 * store doesn't reveal PINs), and hard lockout after repeated failures (so
 * the small keyspace can't just be walked).
 */

const PBKDF2_ITERATIONS = 210_000;
const SESSION_DAYS = 90;

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export type Account = {
  username: string;
  salt: string;
  hash: string;
  createdAt: number;
};

type Attempts = { fails: number; until: number };

export const SESSION_COOKIE = "trace_session";
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function secret(): string {
  return process.env.TRACE_SESSION_SECRET ?? "trace-dev-secret-not-for-production";
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare, so a wrong PIN can't be narrowed down by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(bits);
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(sig);
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateUsername(name: string): string | null {
  if (name.length < 2) return "Pick a name with at least 2 characters.";
  if (name.length > 32) return "That name is too long — 32 characters at most.";
  if (!/^[a-z0-9 ._-]+$/.test(name))
    return "Names can use letters, numbers, spaces, dots, dashes and underscores.";
  return null;
}

export function validatePin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "Your PIN needs to be 4 to 8 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Pick a PIN that isn't the same digit repeated.";
  if ("0123456789".includes(pin) || "9876543210".includes(pin))
    return "Pick a PIN that isn't a run of digits in order.";
  return null;
}

const userKey = (username: string) => `trace:user:${username}`;
const attemptsKey = (username: string) => `trace:attempts:${username}`;
export const dataKey = (username: string) => `trace:data:${username}`;

export async function createAccount(
  username: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const account: Account = {
    username,
    salt,
    hash: await derive(pin, salt),
    createdAt: Date.now(),
  };
  const created = await setIfAbsent(userKey(username), account);
  if (!created) return { ok: false, error: "That name is already taken." };
  return { ok: true };
}

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterMs?: number };

export async function verifyAccount(
  username: string,
  pin: string,
): Promise<SignInResult> {
  const attempts = (await get<Attempts>(attemptsKey(username))) ?? {
    fails: 0,
    until: 0,
  };
  if (attempts.until > Date.now()) {
    return {
      ok: false,
      error: "Too many wrong PINs. Try again later.",
      retryAfterMs: attempts.until - Date.now(),
    };
  }

  const account = await get<Account>(userKey(username));
  // Derive even when the account doesn't exist, so "no such user" and
  // "wrong PIN" take the same time and give the same message — otherwise
  // this endpoint doubles as a way to enumerate who has an account.
  const candidate = await derive(pin, account?.salt ?? "missing-account-salt");
  const valid = account ? timingSafeEqual(candidate, account.hash) : false;

  if (!valid) {
    const fails = attempts.fails + 1;
    const locked = fails >= MAX_ATTEMPTS;
    await set(attemptsKey(username), {
      fails: locked ? 0 : fails,
      until: locked ? Date.now() + LOCKOUT_MS : 0,
    });
    return {
      ok: false,
      error: locked
        ? "Too many wrong PINs. Try again in 15 minutes."
        : `That name and PIN don't match. ${MAX_ATTEMPTS - fails} ${
            MAX_ATTEMPTS - fails === 1 ? "try" : "tries"
          } left.`,
      retryAfterMs: locked ? LOCKOUT_MS : undefined,
    };
  }

  await set(attemptsKey(username), { fails: 0, until: 0 });
  return { ok: true };
}

export async function issueToken(username: string): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${username}:${expires}`;
  return `${payload}:${await sign(payload)}`;
}

/** Returns the username a token belongs to, or null if it's invalid/expired. */
export async function readToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const at = token.lastIndexOf(":");
  if (at < 0) return null;
  const payload = token.slice(0, at);
  const signature = token.slice(at + 1);
  if (!timingSafeEqual(signature, await sign(payload))) return null;

  const split = payload.lastIndexOf(":");
  const username = payload.slice(0, split);
  const expires = Number(payload.slice(split + 1));
  if (!username || !Number.isFinite(expires) || expires < Date.now()) return null;
  return username;
}
