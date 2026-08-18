"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTraceSession } from "@/hooks/useTraceSession";
import { MindMap } from "@/components/MindMap";

export default function LowVisionMode() {
  const router = useRouter();
  const {
    videoRef,
    status,
    stopped,
    error,
    states,
    latest,
    transcript,
    interim,
    analyzing,
    speechAvailable,
    endSession,
  } = useTraceSession("low-vision");
  // null = live view; a number = viewing that board state from the timeline
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected =
    selectedId === null ? null : states.find((s) => s.id === selectedId);
  const heading = selected?.heading ?? latest?.heading ?? "Class board";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-2 font-mono text-sm tracking-wide uppercase">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                stopped ? "bg-line-soft" : selected ? "bg-line-soft" : status === "live" ? "bg-live" : "bg-line-soft"
              }`}
            />
            {stopped
              ? "Class ended"
              : selected
                ? `Viewing ${selected.time}`
                : status === "live"
                  ? analyzing
                    ? "Live · reading board"
                    : "Live"
                  : status === "starting"
                    ? "Starting camera"
                    : "Camera off"}
          </p>
          {!stopped && (
            <button
              onClick={() => { endSession(); router.push("/"); }}
              className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
            >
              End class
            </button>
          )}
        </div>
      </div>

      {/* The board — primary object */}
      <section
        aria-label="Whiteboard"
        className="relative mt-6 flex min-h-[52vh] flex-col border border-line bg-surface"
      >
        {/* Live camera feed; hidden (not unmounted) when reviewing history */}
        <video
          ref={videoRef}
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-contain ${
            selected ? "invisible" : ""
          }`}
        />
        {selected && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={selected.image}
            alt={`Whiteboard at ${selected.time}: ${selected.heading}`}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
        {!selected && status !== "live" && (
          <div className="absolute inset-0 flex items-center justify-center p-10">
            <p className="max-w-md text-center text-xl leading-9 text-muted">
              {error ??
                "Starting the camera — point it at the whiteboard and capture begins automatically."}
            </p>
          </div>
        )}
      </section>

      {/* Timeline — every board state, including erased ones */}
      <nav
        aria-label="Board timeline"
        className="border-x border-b border-line"
      >
        <ol className="flex overflow-x-auto">
          {states.map((state) => (
            <li key={state.id} className="flex min-w-44 flex-1">
              <button
                onClick={() => setSelectedId(state.id)}
                aria-current={selectedId === state.id ? "true" : undefined}
                className={`w-full border-l border-line-soft px-4 py-3 text-left first:border-l-0 ${
                  selectedId === state.id
                    ? "bg-foreground text-background"
                    : "hover:bg-surface"
                }`}
              >
                <span className="block font-mono text-xs tracking-wide">
                  {state.time}
                  {state.erased ? " · erased" : ""}
                </span>
                <span className="mt-1 block text-base font-medium">
                  {state.label}
                </span>
              </button>
            </li>
          ))}
          <li className="flex min-w-32 flex-1">
            <button
              onClick={() => setSelectedId(null)}
              aria-current={selectedId === null ? "true" : undefined}
              className={`w-full border-l border-line-soft px-4 py-3 text-left ${
                selectedId === null
                  ? "bg-foreground text-background"
                  : "hover:bg-surface"
              }`}
            >
              <span className="block font-mono text-xs tracking-wide">Now</span>
              <span className="mt-1 block text-base font-medium">Live</span>
            </button>
          </li>
        </ol>
      </nav>

      {error && status === "live" && (
        <p role="alert" className="mt-4 border border-live px-4 py-3 text-base text-live">
          {error}
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
        <section aria-label="Structured notes">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Notes so far
          </h2>
          <div className="mt-6" aria-live="polite">
            {latest?.notes ? (
              <MindMap markdown={latest.notes} />
            ) : (
              <p className="text-base leading-7 text-faint">
                Notes build automatically once the board is read.
              </p>
            )}
          </div>
        </section>

        <section aria-label="Lecture transcript">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Teacher is saying
          </h2>
          <div aria-live="polite" className="mt-5 space-y-4">
            {!speechAvailable && (
              <p className="text-base leading-7 text-faint">
                Live transcription isn&apos;t available in this browser — try
                Chrome, and allow microphone access.
              </p>
            )}
            {transcript.slice(-8).map((entry, i) => (
              <p key={i} className="text-lg leading-8">
                {entry.text}
              </p>
            ))}
            {interim && (
              <p className="text-lg leading-8 text-muted">{interim}…</p>
            )}
            {speechAvailable && transcript.length === 0 && !interim && (
              <p className="text-base leading-7 text-faint">
                Listening for the teacher…
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
