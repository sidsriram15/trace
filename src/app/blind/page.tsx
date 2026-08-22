"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTraceSession } from "@/hooks/useTraceSession";
import { speak, stopSpeaking } from "@/lib/speech";
import { useFolders } from "@/lib/folders";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";
import type { VoiceCommand } from "@/lib/commands";

/** Spoken names arrive lowercased from the recognizer. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const HELP =
  "During a class you can say commands hands-free by saying Trace first. For example: " +
  '"Trace, pause" to stop it reading and stop it watching the board, ' +
  '"Trace, resume" to start again, ' +
  '"Trace, repeat" to hear the last thing again, ' +
  '"Trace, call it" and a name to rename this class — for example, Trace, call it chapter four, ' +
  '"Trace, where am I" to hear what is going on, ' +
  'or "Trace, end class" to save it and finish. ' +
  "You can also press space or V on the keyboard to give a command without saying Trace first. " +
  "Other keyboard shortcuts: P pauses and resumes, R repeats, E ends the class, and H repeats this list.";

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
  // Starts from the name chosen on the way in, but stays editable: a class
  // often turns out to be about something other than what it was called.
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const folders = useFolders();
  const folderName = folderId
    ? folders.find((f) => f.id === folderId)?.name
    : undefined;

  // Announce on arrival — a blind student has no other way to know the page
  // loaded and what to do while the camera connects.
  useSpokenGuidance(
    "Class starting. Opening the camera — point it at the whiteboard. " +
      'Say "Trace, help" any time to hear what you can ask for. ' +
      "Press H on the keyboard to hear what you can say, or press space to give a command.",
  );

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const spokenCount = useRef(0);
  const latestRef = useRef<{ narration: string } | null>(null);
  const endRef = useRef<() => void>(() => {});
  // Read inside `finish`, which is built before `states`/`transcript` exist.
  const statesRef = useRef<unknown[]>([]);
  const transcriptRef = useRef<unknown[]>([]);

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
    (command: VoiceCommand) => {
      switch (command.action) {
        case "name": {
          if (!command.value) break;
          const named = titleCase(command.value);
          setTitle(named);
          speak(`Called this class ${named}.`);
          break;
        }
        case "pause":
          togglePause(true);
          speak("Paused. Not reading or watching the board. Say resume to start again.");
          break;
        case "resume":
          togglePause(false);
          speak("Watching the board again.");
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
    analyzing,
    endSession,
  } = useTraceSession({ folderId, title, paused, onCommand: runCommand });

  const finish = useCallback(() => {
    stopSpeaking();
    // A class with nothing on the board OR in the transcript isn't saved.
    // Saying so is the difference between "ended, nothing to keep" and "the
    // button is broken" — there is nothing on screen afterwards to tell
    // them apart.
    const captured = statesRef.current.length;
    const heard = transcriptRef.current.length;
    speak(
      captured === 0 && heard === 0
        ? "Class ended. Nothing was captured, so there was nothing to save."
        : captured === 0
          ? "Class ended and saved, with spoken transcript but no board updates."
          : `Class ended and saved, with ${captured} board update${captured === 1 ? "" : "s"}.`,
    );
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
    statesRef.current = states;
  }, [states]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
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

  // Announce camera ready and errors aloud — visual status indicators are
  // useless here. Delay the "live" message so it doesn't overlap with
  // useSpokenGuidance's intro.
  const announcedLive = useRef(false);
  useEffect(() => {
    if (status === "live" && !announcedLive.current) {
      announcedLive.current = true;
      const name = [folderName, title].filter(Boolean).join(", ");
      setTimeout(() => {
        speak(
          name
            ? `Camera ready. Watching the board for ${name}.`
            : "Camera ready. Watching the board.",
        );
      }, 1800);
    } else if (status === "error" && error) {
      speak(`Camera problem: ${error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, error]);

  // Commands spoken through the push-to-talk bar arrive here.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const command = (e as CustomEvent<VoiceCommand>).detail;
      if (command?.action) runCommand(command);
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [runCommand]);

  // Keyboard shortcuts mirror the voice commands exactly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing) return;

      // Space is push-to-talk here too, same as every other screen — it no
      // longer pauses. P takes over that job so pausing by keyboard doesn't
      // disappear.
      if (e.key.toLowerCase() === "p") runCommand({ action: pausedRef.current ? "resume" : "pause" });
      else if (e.key.toLowerCase() === "r") runCommand({ action: "repeat" });
      else if (e.key.toLowerCase() === "e") runCommand({ action: "end" });
      else if (e.key.toLowerCase() === "h") runCommand({ action: "help" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCommand]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
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

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => runCommand({ action: paused ? "resume" : "pause" })}
          className="border-2 border-line bg-foreground px-6 py-5 text-xl font-semibold text-background hover:bg-muted"
        >
          {paused ? "Resume class" : "Pause class"}
        </button>
        <button
          onClick={finish}
          disabled={stopped}
          className="border-2 border-line px-6 py-5 text-xl font-semibold hover:bg-surface disabled:border-line-soft disabled:text-faint"
        >
          End class &amp; save
        </button>
      </div>
      <p className="mt-3 font-mono text-xs leading-6 tracking-wide text-faint uppercase">
        P pauses · R repeats · E ends · H lists everything · Space or V gives a command
      </p>

      {/* Aiming the camera is the one part of this a blind student may need
          a sighted person for, so what it sees has to be on screen. */}
      <section aria-label="What the camera sees" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
          <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            What the camera sees
          </h2>
          <p className="font-mono text-xs tracking-wide text-faint uppercase">
            {paused ? "Paused" : analyzing ? "Reading the board" : "Watching"}
          </p>
        </div>
        <div className="relative mt-4 aspect-video w-full border border-line bg-surface">
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          />
          {status !== "live" && (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <p className="max-w-md text-center text-lg leading-8 text-muted">
                {error ?? "Starting the camera…"}
              </p>
            </div>
          )}
          {paused && status === "live" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <p className="text-xl font-semibold">Paused</p>
            </div>
          )}
        </div>
      </section>

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
