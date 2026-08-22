"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/history";
import { speak } from "@/lib/speech";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
import { MindMap } from "@/components/MindMap";
import { useFolders } from "@/lib/folders";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";
import type { VoiceCommand } from "@/lib/commands";
import type { BoardState } from "@/hooks/useTraceSession";

/** Full hands-free read-through of a past class. */
function LessonPlayback({ states }: { states: BoardState[] }) {
  const { index, playing, playFrom, pause, next, prev } =
    useLessonPlayback(states);
  const current = index === null ? null : states[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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

  // Playback commands spoken into the global push-to-talk button arrive
  // here as an event, so "play this class" works without finding a button.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const action = (e as CustomEvent<VoiceCommand>).detail?.action;
      if (action === "play") playFrom(index ?? 0);
      else if (action === "pause") pause();
      else if (action === "next") next();
      else if (action === "previous") prev();
      else if (action === "repeat") playFrom(index ?? 0);
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [index, playFrom, pause, next, prev]);

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
      <p className="mt-3 text-center font-mono text-xs leading-6 tracking-wide text-faint uppercase">
        Say &ldquo;play&rdquo;, &ldquo;next&rdquo;, &ldquo;previous&rdquo; ·
        Space — play / pause · Left and right arrows — move between updates
      </p>
    </section>
  );
}

export default function HistoryDetail() {
  const params = useParams<{ id: string }>();
  const session = useSession(params.id);
  const folders = useFolders();

  useSpokenGuidance(
    session
      ? `${session.title || "A saved class"}, with ${session.states.length} board update${
          session.states.length === 1 ? "" : "s"
        }. Say "play" or press Space to hear the whole class read back to you.`
      : "This class wasn't found.",
  );

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

  const latest = session.states[session.states.length - 1];
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
            {session.title || latest?.heading || "Untitled class"}
          </h1>
        </div>
        <p className="font-mono text-sm tracking-wide text-muted uppercase">
          {new Date(session.startedAt).toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="mt-8">
        <LessonPlayback states={session.states} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
        <section aria-label="Structured notes">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Notes
          </h2>
          <div className="mt-6">
            {latest?.notes ? (
              <MindMap markdown={latest.notes} />
            ) : (
              <p className="text-base leading-7 text-faint">No notes captured.</p>
            )}
          </div>
        </section>

        <section aria-label="Every board update">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Every board update
          </h2>
          <ol className="mt-5 space-y-5">
            {[...session.states].reverse().map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => speak(s.narration)}
                  className="block w-full text-left hover:opacity-70"
                >
                  <span className="block font-mono text-xs text-muted">
                    {s.time}
                    {s.erased ? " · board erased" : ""}
                  </span>
                  <span className="block text-lg leading-8">{s.narration}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
