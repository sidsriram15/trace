"use client";

import { useSyncExternalStore } from "react";
import {
  getSessions,
  replaceSessions,
  subscribe as subscribeSessions,
  type SavedSession,
} from "@/lib/history";
import {
  getFolders,
  replaceFolders,
  subscribe as subscribeFolders,
  type Folder,
} from "@/lib/folders";

/**
 * Optional PIN accounts, so a student's classes follow them from a school
 * laptop to a phone.
 *
 * Signed out is a real, complete way to use Trace — not a locked door.
 * Everything works exactly as it always has, entirely in localStorage, and
 * nothing about a class leaves the device except the camera frames the
 * vision model has to see. Signing in adds sync on top of that; it doesn't
 * unlock anything.
 */

export type AccountState = {
  username: string | null;
  status: "unknown" | "guest" | "signed-in";
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
};

let state: AccountState = {
  username: null,
  status: "unknown",
  syncing: false,
  lastSyncedAt: null,
  error: null,
};

const listeners = new Set<() => void>();

function update(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body — treated as no data */
  }
  return { ok: res.ok, data };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeLocal: (() => void) | null = null;
let suppressPush = false;

const PUSH_DEBOUNCE_MS = 1500;

async function push() {
  if (state.status !== "signed-in") return;
  update({ syncing: true });
  const { ok, data } = await call("/api/sync", {
    method: "PUT",
    body: JSON.stringify({ sessions: getSessions(), folders: getFolders() }),
  });
  if (ok) {
    update({
      syncing: false,
      lastSyncedAt: Date.now(),
      error: null,
    });
  } else {
    // A failed push isn't data loss — localStorage still has everything,
    // and the next change re-pushes the whole set.
    update({
      syncing: false,
      error: (data.error as string) ?? "Couldn't save to your account.",
    });
  }
}

function schedulePush() {
  if (suppressPush || state.status !== "signed-in") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS);
}

function watchLocalChanges() {
  if (unsubscribeLocal) return;
  const offSessions = subscribeSessions(schedulePush);
  const offFolders = subscribeFolders(schedulePush);
  unsubscribeLocal = () => {
    offSessions();
    offFolders();
  };
}

function stopWatching() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  unsubscribeLocal?.();
  unsubscribeLocal = null;
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) byId.set(item.id, item);
  return [...byId.values()];
}

/**
 * First pull after signing in: union what's on this device with what's on
 * the account, so signing in on a new device never looks like your classes
 * were wiped, and classes made as a guest come with you. After this, local
 * is the source of truth and pushes replace the stored copy — which is how
 * a delete propagates instead of being resurrected by the next merge.
 */
async function pullAndMerge() {
  update({ syncing: true });
  const { ok, data } = await call("/api/sync");
  if (!ok) {
    update({ syncing: false, error: (data.error as string) ?? "Couldn't load your classes." });
    return;
  }

  const remoteSessions = (data.sessions as SavedSession[]) ?? [];
  const remoteFolders = (data.folders as Folder[]) ?? [];

  suppressPush = true;
  replaceSessions(mergeById(getSessions(), remoteSessions));
  replaceFolders(mergeById(getFolders(), remoteFolders));
  suppressPush = false;

  update({ syncing: false, error: null });
  await push();
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

let checked = false;

/** Restore an existing sign-in on load. Safe to call repeatedly. */
export async function restoreSession(): Promise<void> {
  if (checked) return;
  checked = true;
  const { ok, data } = await call("/api/auth");
  const username = ok ? ((data.username as string | null) ?? null) : null;
  if (username) {
    update({ username, status: "signed-in" });
    watchLocalChanges();
    await pullAndMerge();
  } else {
    update({ username: null, status: "guest" });
  }
}

export async function signIn(
  username: string,
  pin: string,
  intent: "signin" | "create",
): Promise<{ ok: boolean; error?: string }> {
  update({ syncing: true, error: null });
  const { ok, data } = await call("/api/auth", {
    method: "POST",
    body: JSON.stringify({ username, pin, intent }),
  });
  if (!ok) {
    const error = (data.error as string) ?? "Couldn't sign in.";
    update({ syncing: false, error });
    return { ok: false, error };
  }

  checked = true;
  update({ username: data.username as string, status: "signed-in", syncing: false });
  watchLocalChanges();
  await pullAndMerge();
  return { ok: true };
}

/**
 * Sign out and clear this device's copy. The account's classes stay on the
 * server for the next sign-in — but leaving them in localStorage on what
 * may be a shared school laptop would defeat the point of the PIN.
 */
export async function signOut(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    await push();
  }
  stopWatching();
  await call("/api/auth", { method: "DELETE" });
  suppressPush = true;
  replaceSessions([]);
  replaceFolders([]);
  suppressPush = false;
  update({ username: null, status: "guest", lastSyncedAt: null, error: null });
}

/** Erase everything this account has stored on the server, and locally. */
export async function deleteAccountData(): Promise<void> {
  stopWatching();
  await call("/api/sync", { method: "DELETE" });
  suppressPush = true;
  replaceSessions([]);
  replaceFolders([]);
  suppressPush = false;
  update({ lastSyncedAt: null, error: null });
  if (state.status === "signed-in") watchLocalChanges();
}
