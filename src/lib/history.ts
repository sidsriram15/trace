import { useSyncExternalStore } from "react";
import type { BoardState, TranscriptEntry } from "@/hooks/useTraceSession";

export type SavedSession = {
  id: string;
  /**
   * Trace used to have a low-vision mode alongside the blind one. It
   * doesn't any more, but classes saved back then are still in people's
   * browsers, so the field stays readable and unused.
   */
  mode?: string;
  folderId?: string;
  title?: string;
  startedAt: number;
  endedAt: number;
  states: BoardState[];
  transcript: TranscriptEntry[];
};

const KEY = "trace-history";
const MAX_SESSIONS = 20;

let cache: SavedSession[] = [];
let sortedCache: SavedSession[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as SavedSession[]) : [];
  } catch {
    cache = [];
  }
  sortedCache = [...cache].sort((a, b) => b.startedAt - a.startedAt);
  loaded = true;
}

function commit(list: SavedSession[]) {
  // Drop oldest sessions until it fits — board-state images are the bulk of
  // the payload, so trimming session count is the cheapest way to recover
  // from a quota error. Runs at least once so that clearing history down to
  // nothing actually writes the empty list; bailing out early would leave
  // the old classes sitting in storage to reappear on the next load.
  let toStore = list.slice(0, MAX_SESSIONS);
  for (;;) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(toStore));
      break;
    } catch {
      if (toStore.length === 0) break;
      toStore = toStore.slice(0, -1);
    }
  }
  cache = toStore;
  sortedCache = [...cache].sort((a, b) => b.startedAt - a.startedAt);
  loaded = true;
  notify();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current classes, outside React — used by the sync layer. */
export function getSessions(): SavedSession[] {
  ensureLoaded();
  return cache;
}

/** Replace everything, e.g. with what was just pulled for an account. */
export function replaceSessions(list: SavedSession[]): void {
  ensureLoaded();
  commit([...list].sort((a, b) => b.startedAt - a.startedAt));
}

export function saveSession(session: Omit<SavedSession, "id">): void {
  if (session.states.length === 0 || typeof window === "undefined") return;
  ensureLoaded();
  const id = `${session.startedAt}-${Math.random().toString(36).slice(2, 8)}`;
  commit([{ ...session, id }, ...cache]);
}

export function deleteSession(id: string): void {
  ensureLoaded();
  commit(cache.filter((s) => s.id !== id));
}

export function useSessions(): SavedSession[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return sortedCache;
    },
    () => sortedCache,
  );
}

export function useSession(id: string): SavedSession | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return cache.find((s) => s.id === id);
    },
    () => undefined,
  );
}
