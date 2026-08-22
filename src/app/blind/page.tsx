"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTraceSession } from "@/hooks/useTraceSession";
import { speak, stopSpeaking } from "@/lib/speech";
import { useFolders } from "@/lib/folders";
import type { VoiceAction } from "@/lib/commands";

const HELP =
  'While a class is running you can say: "Trace, pause" to stop the narration, ' +
  '"Trace, resume" to start it again, "Trace, repeat" to hear the last update ' +
  'once more, "Trace, where am I", or "Trace, end class". You can also press ' +
  "Space to pause, R to repeat, and H for this list.";

export default function BlindMode() {
  return (
    <Suspense fallback={null}>
      <BlindModeInner />
    </Suspense>
  );
}

function BlindModeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folder") ?? undefined;
  const title = searchParams.get("title") ?? undefined;
  const folders = useFolders();
  const folderName = folderId
    ? folders.find((f) => f.id === folderId)?.name
    : undefined;

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const spokenCount = useRef(0);
  const latestRef = useRef<{ narration: string } | null>(null);
  const endRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const togglePause = useCallback((next?: boolean) => {
    setPaused((p) => {
      const value = next ?? !p;
      if (value) stopSpeaking();
      return value;
    });
  }, []);

  // One handler for every way a command can arrive — spoken, or typed on a
  // keyboard. Keeping them on the same path means neither can quietly fall
  // behind the other.
  const runCommand = useCallback(
    (action: VoiceAction) => {
      switch (action) {
        case "pause":
          togglePause(true);
          speak("Paused.");
          break;
        case "resume":
          togglePause(false);
          speak("Listening to the board again.");
          break;
        case "repeat":
          if (latestRef.current) speak(latestRef.current.narration);
          else speak("Nothing has been read out yet.");
          break;
        case "help":
          speak(HELP);
          break;
        case "status":
          speak(
            latestRef.current
              ? `Class in progress${paused ? ", narration paused" : ""}. The last thing on the board was: ${latestRef.current.narration}`
              : "Class in progress. Nothing has appeared on the board yet.",
          );
          break;
        case "end":
          speak("Ending the class and saving it.");
          endRef.current();
          break;
      }
    },
    [togglePause, paused],
  );

  const {
    videoRef,
    status,
    stopped,
    error,
    states,
    latest,
    transcript,
    interim,
    speechError,
    micLabel,
    endSession,
  } = useTraceSession({ folderId, title, onCommand: runCommand });

  const finish = useCallback(() => {
    stopSpeaking();
    endSession();
    router.push("/");
  }, [endSession, router]);

  // Both of these are read from inside `runCommand`, which is created
  // before either exists — a voice command can arrive at any moment, so
  // they're kept current rather than baked into the callback.
  useEffect(() => {
    latestRef.current = latest;
  }, [latest]);
  useEffect(() => {
    endRef.current = finish;
  }, [finish]);

  // Speak each new narration as it arrives
  useEffect(() => {
    if (states.length > spokenCount.current) {
      const narration = states[states.length - 1].narration;
      spokenCount.current = states.length;
      if (!pausedRef.current) speak(narration);
    }
  }, [states]);

  // Announce session start / camera problems aloud too
  useEffect(() => {
    if (status === "live") {
      const name = [folderName, title].filter(Boolean).join(", ");
      speak(
        (name
          ? `Trace is live and watching the board, for ${name}. `
          : "Trace is live and watching the board. ") +
          'Say "Trace, help" any time to hear what you can ask for.',
      );
    } else if (status === "error" && error) speak(error);
    // Only announce once, when the session first goes live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, error]);

  // Commands spoken through the push-to-talk bar arrive here.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const action = (e as CustomEvent<VoiceAction>).detail;
      if (action) runCommand(action);
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [runCommand]);

  // Keyboard shortcuts mirror the voice commands exactly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("button, input"))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        runCommand(pausedRef.current ? "resume" : "pause");
      } else if (e.key.toLowerCase() === "r") runCommand("repeat");
      else if (e.key.toLowerCase() === "h") runCommand("help");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCommand]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
      {/* Camera still watches the board; the feed itself isn't the product here */}
      <video ref={videoRef} muted playsInline className="sr-only" aria-hidden="true" />

      <div className="flex items-center justify-between gap-4">
        <div>
          {(folderName || title) && (
            <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">
              {[folderName, title].filter(Boolean).join(" · ")}
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">
            {title || "Class in progress"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="font-mono text-sm tracking-wide uppercase">
            {stopped
              ? "Class ended"
              : status === "starting"
                ? "Starting"
                : status === "error"
                  ? "Camera off"
                  : paused
                    ? "Paused"
                    : "Narrating"}
          </p>
          {!stopped && (
            <button
              onClick={finish}
              className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
            >
              End class
            </button>
          )}
        </div>
      </div>

      {/* Current narration — the primary object */}
      <section
        aria-label="Current narration"
        aria-live="polite"
        className="mt-8 border-y-2 border-line py-12"
      >
        {latest ? (
          <>
            <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">
              {latest.time}
              {latest.erased ? " · board erased" : ""}
            </p>
            <p className="mt-4 text-3xl leading-[1.35] font-medium tracking-tight text-balance sm:text-4xl">
              {latest.narration}
            </p>
          </>
        ) : (
          <p className="text-2xl leading-9 font-medium text-muted">
            {error ??
              (status === "live"
                ? "Watching the board. You'll hear a description as soon as something is written."
                : "Starting the camera — point it at the whiteboard.")}
          </p>
        )}
      </section>

      <div className="mt-8">
        <button
          onClick={() => runCommand(paused ? "resume" : "pause")}
          className="w-full border-2 border-line bg-foreground px-6 py-5 text-xl font-semibold text-background hover:bg-muted"
        >
          {paused ? "Resume narration" : "Pause narration"}
        </button>
      </div>
      <p className="mt-3 font-mono text-xs leading-6 tracking-wide text-faint uppercase">
        Say &ldquo;Trace, pause&rdquo; · &ldquo;Trace, repeat&rdquo; ·
        &ldquo;Trace, end class&rdquo; — or press Space to pause, R to
        repeat, H for the full list
      </p>

      {/* Proof the microphone is actually working. Without something on
          screen, a silent failure and a silent classroom look identical. */}
      <section aria-label="Heard in the room" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
          <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Heard in the room
          </h2>
          {micLabel && (
            <p className="font-mono text-xs tracking-wide text-faint uppercase">
              Mic: {micLabel}
            </p>
          )}
        </div>
        <div aria-live="polite" className="mt-5 space-y-3">
          {speechError && (
            <p role="alert" className="text-base leading-7 text-live">
              {speechError}
            </p>
          )}
          {transcript.slice(-4).map((entry, i) => (
            <p key={i} className="text-lg leading-8">
              {entry.text}
            </p>
          ))}
          {interim && (
            <p className="text-lg leading-8 text-muted">{interim}…</p>
          )}
          {!speechError && transcript.length === 0 && !interim && (
            <p className="text-base leading-7 text-faint">
              Listening. Anything spoken in the room appears here.
            </p>
          )}
        </div>
      </section>

      <section aria-label="Narration history" className="mt-14">
        <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Everything so far
        </h2>
        {states.length === 0 ? (
          <p className="py-5 text-base leading-7 text-faint">
            Every board change will be listed here. Select one to hear it
            again.
          </p>
        ) : (
          <ol className="divide-y divide-line-soft">
            {[...states].reverse().map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => speak(entry.narration)}
                  className="grid w-full grid-cols-[5rem_1fr] items-baseline gap-4 py-5 text-left hover:bg-surface"
                >
                  <span className="font-mono text-sm text-muted">
                    {entry.time}
                  </span>
                  <span className="text-lg leading-8">{entry.narration}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
