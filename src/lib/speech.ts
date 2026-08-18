// Web Speech API wrappers: live transcription in, spoken narration out.
// SpeechRecognition is not in TypeScript's DOM lib, so we declare the
// minimal surface we use.

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
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

// Errors that mean recognition can never succeed here — stop retrying and
// tell the caller. Everything else (network blips, silence timeouts,
// "aborted" from our own restart race) is expected during a long session
// and gets retried.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

// If recognition keeps failing before it has ever produced a single result,
// something is wrong beyond normal transient errors (e.g. the browser can't
// reach the speech recognition service at all) — surface it instead of
// retrying silently forever.
const MAX_CONSECUTIVE_ERRORS_BEFORE_GIVING_UP = 6;

export function createRecognizer(handlers: {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onUnavailable: (reason: string) => void;
}): { stop: () => void } | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onUnavailable("Speech recognition isn't supported in this browser.");
    return null;
  }

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let stopped = false;
  let everGotResult = false;
  let consecutiveErrors = 0;

  rec.onresult = (e) => {
    everGotResult = true;
    consecutiveErrors = 0;
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0].transcript.trim();
      if (!text) continue;
      if (result.isFinal) handlers.onFinal(text);
      else interim += ` ${text}`;
    }
    handlers.onInterim(interim.trim());
  };
  // Chrome stops recognition on silence; restart until told to stop.
  rec.onend = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch (err) {
      console.error("[trace] speech recognition failed to restart", err);
      stopped = true;
      handlers.onUnavailable("Live transcription stopped unexpectedly.");
    }
  };
  rec.onerror = (e) => {
    console.error("[trace] speech recognition error:", e.error);
    if (FATAL_ERRORS.has(e.error)) {
      stopped = true;
      handlers.onUnavailable(
        e.error === "audio-capture"
          ? "No microphone was found. Check that one is connected and not in use by another app."
          : "Microphone access was denied. Allow microphone access and reload.",
      );
      return;
    }
    if (!everGotResult) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS_BEFORE_GIVING_UP) {
        stopped = true;
        handlers.onUnavailable(
          "Couldn't reach the speech recognition service — check your network connection and reload.",
        );
      }
    }
  };

  try {
    rec.start();
  } catch (err) {
    console.error("[trace] speech recognition failed to start", err);
    handlers.onUnavailable("Live transcription failed to start.");
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      rec.stop();
    },
  };
}

/** Speak text aloud, replacing anything currently being spoken. */
export function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
