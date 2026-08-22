"use client";

import { useSyncExternalStore } from "react";

/**
 * Student preferences. Trace is a blind-first app — there is no mode to
 * pick — so what lives here is how narration is delivered, not what kind
 * of user you are.
 */
export type Settings = {
  /** SpeechSynthesis rate. Screen-reader users often want 2x+. */
  speechRate: number;
  /** Vibrate when the board changes (mobile), as a non-auditory cue. */
  haptics: boolean;
  /** Speak page instructions on arrival. */
  spokenGuidance: boolean;
};

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;

const KEY = "trace-settings";
const DEFAULTS: Settings = {
  // Must be one of SPEECH_RATES, or the settings radio group opens with
  // nothing selected and there's no way to hear what the current speed is.
  speechRate: 1,
  haptics: true,
  spokenGuidance: true,
};

let cache: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) cache = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    cache = DEFAULTS;
  }
  loaded = true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateSettings(patch: Partial<Settings>): void {
  ensureLoaded();
  cache = { ...cache, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — preferences just won't persist */
  }
  loaded = true;
  notify();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return cache;
    },
    () => DEFAULTS,
  );
}

/**
 * Read settings outside React — `speak()` and the capture hook need the
 * current rate/haptics preference without being components.
 */
export function getSettings(): Settings {
  ensureLoaded();
  return cache;
}
