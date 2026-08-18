"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/history";
import { speak } from "@/lib/speech";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
import { MindMap } from "@/components/MindMap";
import { useFolders } from "@/lib/folders";
import type { BoardState } from "@/hooks/useTraceSession";

/** Full hands-free read-through of a past class, for blind mode. */
function LessonPlayback({ states }: { states: BoardState[] }) {
  const { index, playing, playFrom, pause, next, prev } =
    useLessonPlayback(states);
  const current = index === null ? null : states[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("button, input"))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (playing) pause();
        else playFrom(index ?? 0);
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, index, playFrom, pause, next, prev]);

  return (
    <section aria-label="Listen to this class" className="border-y-2 border-line py-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Listen to this class
        </h2>
        {index !== null && (
          <p className="font-mono text-xs tracking-wide text-muted uppercase">
            {index + 1} of {states.length}
          </p>
        )}
      </div>

      <div aria-live="polite" className="mt-6 min-h-24">
        {current ? (
          <>
            <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">
              {current.time}
              {current.erased ? " · board erased" : ""}
            </p>
            <p className="mt-3 text-3xl leading-[1.35] font-medium tracking-tight text-balance sm:text-4xl">
              {current.narration}
            </p>
          </>
        ) : (
          <p className="text-2xl leading-9 font-medium text-muted">
            {states.length} board update{states.length === 1 ? "" : "s"} were
            captured in this class. Press play to hear the whole thing, start
            to finish.
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <button
          onClick={prev}
          disabled={index === null || index === 0}
          className="border-2 border-line px-4 py-5 text-lg font-semibold hover:bg-surface disabled:border-line-soft disabled:text-faint"
        >
          Previous
        </button>
        <button
          onClick={() => (playing ? pause() : playFrom(index ?? 0))}
          className="border-2 border-line bg-foreground px-4 py-5 text-lg font-semibold text-background hover:bg-muted"
        >
          {playing ? "Pause" : index === null ? "Play this class" : "Resume"}
        </button>
        <button
          onClick={next}
          disabled={index === null || index === states.length - 1}
          className="border-2 border-line px-4 py-5 text-lg font-semibold hover:bg-surface disabled:border-line-soft disabled:text-faint"
        >
          Next
        </button>
      </div>
      <p className="mt-3 text-center font-mono text-xs tracking-wide text-faint uppercase">
        Space — play / pause · Left arrow — previous · Right arrow — next
      </p>
    </section>
  );
}

export default function HistoryDetail() {
  const params = useParams<{ id: string }>();
  const session = useSession(params.id);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const folders = useFolders();

  if (session === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
        <p className="text-lg text-muted">This class wasn&apos;t found.</p>
        <Link href="/" className="mt-4 underline hover:no-underline">
          Back to your classes
        </Link>
      </div>
    );
  }

  const isBlind = session.mode === "blind";
  const selected =
    selectedId === null
      ? session.states[session.states.length - 1]
      : session.states.find((s) => s.id === selectedId);
  const folderName = session.folderId
    ? folders.find((f) => f.id === session.folderId)?.name
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/" className="underline hover:no-underline">
              Your classes
            </Link>
            {folderName && <> · {folderName}</>}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {session.title || selected?.heading || "Untitled class"}
          </h1>
        </div>
        <p className="font-mono text-sm tracking-wide text-muted uppercase">
          {new Date(session.startedAt).toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          · {session.mode === "low-vision" ? "Low Vision" : "Blind"}
        </p>
      </div>

      {isBlind ? (
        <div className="mt-8">
          <LessonPlayback states={session.states} />
        </div>
      ) : (
        <>
          {selected?.image && (
            <section
              aria-label="Whiteboard capture"
              className="relative mt-6 min-h-[52vh] border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.image}
                alt={`Whiteboard: ${selected.heading}`}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </section>
          )}

          <nav aria-label="Board timeline" className="border-x border-b border-line">
            <ol className="flex overflow-x-auto">
              {session.states.map((state) => (
                <li key={state.id} className="flex min-w-44 flex-1">
                  <button
                    onClick={() => setSelectedId(state.id)}
                    aria-current={selected?.id === state.id ? "true" : undefined}
                    className={`w-full border-l border-line-soft px-4 py-3 text-left first:border-l-0 ${
                      selected?.id === state.id
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
            </ol>
          </nav>
        </>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
        <section aria-label="Structured notes">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Notes
          </h2>
          <div className="mt-6">
            {selected?.notes ? (
              <MindMap markdown={selected.notes} />
            ) : (
              <p className="text-base leading-7 text-faint">No notes captured.</p>
            )}
          </div>
        </section>

        <section aria-label="Narration and transcript">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            {isBlind ? "Every board update" : "Transcript"}
          </h2>
          <div className="mt-5 space-y-5">
            {isBlind ? (
              [...session.states].reverse().map((s) => (
                <button
                  key={s.id}
                  onClick={() => speak(s.narration)}
                  className="block w-full text-left hover:opacity-70"
                >
                  <span className="block font-mono text-xs text-muted">{s.time}</span>
                  <span className="block text-lg leading-8">{s.narration}</span>
                </button>
              ))
            ) : session.transcript.length > 0 ? (
              session.transcript.map((entry, i) => (
                <p key={i} className="text-lg leading-8">
                  {entry.text}
                </p>
              ))
            ) : (
              <p className="text-base leading-7 text-faint">No transcript captured.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
