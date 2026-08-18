"use client";

import { useSyncExternalStore } from "react";

export type AccessibilityMode = "low-vision" | "blind";

const KEY = "trace-default-mode";
const DEFAULT_MODE: AccessibilityMode = "low-vision";

let cache: AccessibilityMode = DEFAULT_MODE;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(KEY);
  if (raw === "low-vision" || raw === "blind") cache = raw;
  loaded = true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDefaultMode(mode: AccessibilityMode): void {
  cache = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* storage full or unavailable — preference just won't persist */
  }
  loaded = true;
  notify();
}

/** The student's saved accessibility mode preference, set on /settings. */
export function useDefaultMode(): AccessibilityMode {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return cache;
    },
    () => DEFAULT_MODE,
  );
}
