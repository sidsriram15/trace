"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/history";
import { speak } from "@/lib/speech";

function Notes({ markdown }: { markdown: string }) {
  const blocks = markdown.split("\n").filter((line) => line.trim());
  return (
    <div className="space-y-3">
      {blocks.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-3 text-xl font-semibold tracking-tight first:pt-0">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <p key={i} className="pl-5 text-lg leading-8">
              – {trimmed.slice(2)}
            </p>
          );
        }
        return (
          <p key={i} className="text-lg leading-8">
            {trimmed.replace(/^#+\s*/, "")}
          </p>
        );
      })}
    </div>
  );
}

export default function HistoryDetail() {
  const params = useParams<{ id: string }>();
  const session = useSession(params.id);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (session === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
        <p className="text-lg text-muted">This class wasn&apos;t found.</p>
        <Link href="/history" className="mt-4 underline hover:no-underline">
          Back to past classes
        </Link>
      </div>
    );
  }

  const selected =
    selectedId === null
      ? session.states[session.states.length - 1]
      : session.states.find((s) => s.id === selectedId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/history" className="underline hover:no-underline">
              Past classes
            </Link>
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {selected?.heading ?? "Untitled class"}
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

      {selected?.image && (
        <section aria-label="Whiteboard capture" className="relative mt-6 min-h-[52vh] border border-line bg-surface">
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
                <span className="mt-1 block text-base font-medium">{state.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
        <section aria-label="Structured notes">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            Notes
          </h2>
          <div className="mt-5">
            {selected?.notes ? (
              <Notes markdown={selected.notes} />
            ) : (
              <p className="text-base leading-7 text-faint">No notes captured.</p>
            )}
          </div>
        </section>

        <section aria-label="Narration and transcript">
          <h2 className="border-b border-line pb-2 font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
            {session.mode === "blind" ? "Narration history" : "Transcript"}
          </h2>
          <div className="mt-5 space-y-5">
            {session.mode === "blind" ? (
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
