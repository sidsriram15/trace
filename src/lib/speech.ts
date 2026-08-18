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

export function createRecognizer(handlers: {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onUnavailable: () => void;
}): { stop: () => void } | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onUnavailable();
    return null;
  }

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let stopped = false;

  rec.onresult = (e) => {
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
    if (!stopped) {
      try {
        rec.start();
      } catch {
        /* already restarting */
      }
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stopped = true;
      handlers.onUnavailable();
    }
  };

  try {
    rec.start();
  } catch {
    handlers.onUnavailable();
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
export function speak(text: string) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
