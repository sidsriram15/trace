/**
 * Tiny key/value store behind the account + sync API.
 *
 * Backed by Upstash Redis over its REST API when configured (no client
 * library needed — it's plain fetch), and by an in-process map otherwise so
 * the whole sign-in/sync flow can be developed and demoed locally without
 * anyone having to sign up for anything first.
 *
 * The in-memory fallback is explicitly NOT durable: it's per-server-process
 * and vanishes on restart. Deployments must set the Upstash vars.
 */

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isDurable = Boolean(URL_ENV && TOKEN_ENV);

const memory = new Map<string, string>();
let warned = false;

function warnOnce() {
  if (warned || isDurable) return;
  warned = true;
  console.warn(
    "[trace] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set — " +
      "accounts are being kept in memory for this process only and will not " +
      "survive a restart or sync across devices. Set both before deploying.",
  );
}

async function upstash(command: unknown[]): Promise<unknown> {
  const res = await fetch(URL_ENV!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_ENV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Storage request failed (${res.status})`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result ?? null;
}

export async function get<T>(key: string): Promise<T | null> {
  warnOnce();
  const raw = isDurable
    ? ((await upstash(["GET", key])) as string | null)
    : (memory.get(key) ?? null);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  warnOnce();
  const raw = JSON.stringify(value);
  if (isDurable) await upstash(["SET", key, raw]);
  else memory.set(key, raw);
}

/** Set only if the key is currently unset. Returns false if it existed. */
export async function setIfAbsent(key: string, value: unknown): Promise<boolean> {
  warnOnce();
  const raw = JSON.stringify(value);
  if (isDurable) {
    const result = await upstash(["SET", key, raw, "NX"]);
    return result !== null;
  }
  if (memory.has(key)) return false;
  memory.set(key, raw);
  return true;
}

export async function del(key: string): Promise<void> {
  warnOnce();
  if (isDurable) await upstash(["DEL", key]);
  else memory.delete(key);
}
