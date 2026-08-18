import { useSyncExternalStore } from "react";
import type { BoardState, TranscriptEntry } from "@/hooks/useTraceSession";

export type SavedSession = {
  id: string;
  mode: "low-vision" | "blind";
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
  // from a quota error.
  let toStore = list.slice(0, MAX_SESSIONS);
  while (toStore.length > 0) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(toStore));
      break;
    } catch {
      toStore = toStore.slice(0, -1);
    }
  }
  cache = toStore;
  sortedCache = [...cache].sort((a, b) => b.startedAt - a.startedAt);
  loaded = true;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
