"use client";

import { useSyncExternalStore } from "react";

export type Folder = { id: string; name: string; createdAt: number };

const KEY = "trace-folders";

let cache: Folder[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Folder[]) : [];
  } catch {
    cache = [];
  }
  loaded = true;
}

function commit(list: Folder[]) {
  cache = list;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — folder list just won't persist */
  }
  loaded = true;
  notify();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current folders, outside React — used by the sync layer. */
export function getFolders(): Folder[] {
  ensureLoaded();
  return cache;
}

/** Replace everything, e.g. with what was just pulled for an account. */
export function replaceFolders(list: Folder[]): void {
  ensureLoaded();
  commit(list);
}

export function createFolder(name: string): Folder {
  ensureLoaded();
  const folder: Folder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: Date.now(),
  };
  commit([...cache, folder]);
  return folder;
}

export function deleteFolder(id: string): void {
  ensureLoaded();
  commit(cache.filter((f) => f.id !== id));
}

export function useFolders(): Folder[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return cache;
    },
    () => cache,
  );
}
