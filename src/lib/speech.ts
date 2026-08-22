// Web Speech API: live transcription in, spoken narration out.
//
// The browser gives a page exactly one usable SpeechRecognition session at a
// time — a second one steals the microphone and both start failing. So this
// module owns a single recognizer for the whole app and routes its results
// to whoever is currently listening, rather than letting each feature build
// its own. Callers push a listener on, pop it off when done; the recognizer
// underneath never stops, so handing the microphone from lecture
// transcription to a voice command and back is free.
//
// SpeechRecognition is not in TypeScript's DOM lib, so the surface we use is
// declared here.

import { getSettings } from "@/lib/settings";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [i: number]: RecognitionResult };
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

export type SpeechListener = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Fatal means it will not recover on its own; anything else self-heals. */
  onError?: (reason: string, fatal: boolean) => void;
};

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return getCtor() !== null;
}

/**
 * Open the microphone once, explicitly, before starting recognition.
 *
 * SpeechRecognition requests permission implicitly, and when that request is
 * dismissed or lands on a device that produces no audio it just goes quiet —
 * indistinguishable from a silent room. Asking directly turns those cases
 * into a specific message, and names the device actually being used so a
 * wrong default input is obvious rather than mysterious.
 *
 * Resolves to null when the microphone is usable, or a reason when not.
 */
export async function ensureMicrophone(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "This browser can't open a microphone. Chrome supports it.";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    // Hand the device straight back — SpeechRecognition opens its own
    // capture, and holding this one can lock it out on some systems.
    stream.getTracks().forEach((t) => t.stop());
    if (!track) return "No microphone input was available.";
    lastMicLabel = track.label || null;
    return null;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError") {
      return "Microphone access was blocked. Allow the microphone for this site in your browser, then reload.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "No microphone was found. Connect one, or pick a different input device, then reload.";
    }
    if (name === "NotReadableError") {
      return "The microphone is already in use by another app. Close it, then reload.";
    }
    return "Couldn't open the microphone. Check your input device, then reload.";
  }
}

let lastMicLabel: string | null = null;

/** Which input device the last successful microphone check actually used. */
export function microphoneLabel(): string | null {
  return lastMicLabel;
}

let rec: Recognition | null = null;
let running = false;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let networkFailures = 0;

// Most recent listener wins. Popping one restores whoever was underneath,
// which is how a voice command borrows the microphone mid-class and gives
// it straight back to the lecture transcript.
const stack: SpeechListener[] = [];

// Trace's own narration reaches the microphone. Without this it transcribes
// itself into the lecture notes and, worse, hears its own words as commands.
let mutedUntil = 0;

function active(): SpeechListener | null {
  return stack.length ? stack[stack.length - 1] : null;
}

function fail(reason: string, fatal: boolean) {
  for (const listener of [...stack]) listener.onError?.(reason, fatal);
}

function scheduleRestart() {
  if (restartTimer || !stack.length) return;
  // Backing off only on repeated network failures: a `no-speech` timeout is
  // routine and should come back immediately, but a genuinely unreachable
  // speech service shouldn't be hammered.
  const delay = Math.min(300 * 2 ** Math.min(networkFailures, 4), 5000);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!stack.length || running) return;
    try {
      rec?.start();
    } catch {
      // Chrome throws if the previous session hasn't fully released yet.
      // That is recoverable and must never be terminal — the old code gave
      // up here, which silently killed transcription for the whole class.
      scheduleRestart();
    }
  }, delay);
}

function ensure(): Recognition | null {
  if (rec) return rec;
  const Ctor = getCtor();
  if (!Ctor) return null;

  const r = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";
  r.maxAlternatives = 1;

  r.onstart = () => {
    running = true;
    networkFailures = 0;
  };

  r.onresult = (e) => {
    if (Date.now() < mutedUntil) return;
    const listener = active();
    if (!listener) return;

    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = (result[0]?.transcript ?? "").trim();
      if (!text) continue;
      if (result.isFinal) listener.onFinal?.(text);
      else interim += ` ${text}`;
    }
    const pending = interim.trim();
    if (pending) listener.onInterim?.(pending);
  };

  r.onerror = (e) => {
    switch (e.error) {
      case "not-allowed":
      case "service-not-allowed":
        stack.length = 0;
        fail(
          "Microphone access is blocked. Allow the microphone for this site in your browser, then reload.",
          true,
        );
        return;
      case "audio-capture":
        stack.length = 0;
        fail(
          "No microphone was found. Check that one is connected and selected as your input device, then reload.",
          true,
        );
        return;
      case "network":
        networkFailures++;
        if (networkFailures >= 5) {
          fail(
            "Can't reach the speech recognition service. Check your internet connection.",
            false,
          );
        }
        return;
      default:
        // no-speech and aborted are routine: Chrome ends the session after a
        // stretch of silence, and onend restarts it.
        return;
    }
  };

  r.onend = () => {
    running = false;
    if (stack.length) scheduleRestart();
  };

  rec = r;
  return r;
}

/**
 * Start receiving speech. The returned function stops this listener and
 * hands the microphone back to whoever had it before.
 */
export function listen(listener: SpeechListener): () => void {
  const r = ensure();
  if (!r) {
    listener.onError?.(
      "Speech recognition isn't supported in this browser. Chrome supports it.",
      true,
    );
    return () => {};
  }

  stack.push(listener);
  if (!running) {
    try {
      r.start();
    } catch {
      scheduleRestart();
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const i = stack.lastIndexOf(listener);
    if (i !== -1) stack.splice(i, 1);
    if (!stack.length) {
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      try {
        r.stop();
      } catch {
        /* not running */
      }
    }
  };
}

/** Speak text aloud, replacing anything currently being spoken. */
export function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const rate = getSettings().speechRate;

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    // A short tail so the end of the sentence doesn't land in the mic.
    mutedUntil = Date.now() + 400;
    onEnd?.();
  };

  mutedUntil = Number.MAX_SAFE_INTEGER;
  utterance.onend = finish;
  utterance.onerror = finish;

  // Chrome drops utterances queued in the same tick as cancel(), and
  // sometimes never fires onend at all — so unmuting also gets a failsafe
  // based on how long this text should take to say.
  const estimatedMs = (text.length / 12) * 1000 * (1 / Math.max(rate, 0.1));
  setTimeout(finish, Math.min(estimatedMs + 5000, 60000));
  setTimeout(() => synth.speak(utterance), 60);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  mutedUntil = Date.now() + 300;
}

/**
 * A short buzz, if the student has haptics on and the device supports it.
 * TTS is often mid-sentence when the next board update lands, so a
 * non-auditory "something new arrived" cue is worth having.
 */
export function pulse(pattern: number | number[] = 40) {
  if (!getSettings().haptics) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  nav.vibrate?.(pattern);
}
