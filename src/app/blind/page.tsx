"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTraceSession } from "@/hooks/useTraceSession";
import { speak, stopSpeaking } from "@/lib/speech";

export default function BlindMode() {
  const router = useRouter();
  const { videoRef, status, stopped, error, states, latest, endSession } = useTraceSession("blind");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const spokenCount = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
    if (status === "live") speak("Trace is live and watching the board.");
    else if (status === "error" && error) speak(error);
  }, [status, error]);

  // Keyboard shortcuts: Space pause/resume, R repeat (when not on a control)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("button, input"))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => {
          if (!p) stopSpeaking();
          return !p;
        });
      } else if (e.key.toLowerCase() === "r" && latest) {
        speak(latest.narration);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [latest]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
      {/* Camera still watches the board; the feed itself isn't the product here */}
      <video ref={videoRef} muted playsInline className="sr-only" aria-hidden="true" />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Blind mode</h1>
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
              onClick={() => { stopSpeaking(); endSession(); router.push("/"); }}
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

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() =>
            setPaused((p) => {
              if (!p) stopSpeaking();
              return !p;
            })
          }
          className="border-2 border-line bg-foreground px-6 py-5 text-xl font-semibold text-background hover:bg-muted"
        >
          {paused ? "Resume narration" : "Pause narration"}
        </button>
        <button
          onClick={() => latest && speak(latest.narration)}
          disabled={!latest}
          className="border-2 border-line px-6 py-5 text-xl font-semibold hover:bg-surface disabled:border-line-soft disabled:text-faint"
        >
          Repeat last
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-xs tracking-wide text-faint uppercase">
        Space — pause · R — repeat
      </p>

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
