"use client";

import Link from "next/link";
import { deleteSession, useSessions } from "@/lib/history";

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(startedAt: number, endedAt: number) {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Date(startedAt).toLocaleTimeString([], opts)} – ${new Date(endedAt).toLocaleTimeString([], opts)}`;
}

export default function HistoryPage() {
  const sessions = useSessions();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Past classes</h1>
        <Link
          href="/"
          className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
        >
          New session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-10 max-w-md text-lg leading-8 text-muted">
          Nothing saved yet. Sessions are saved automatically here when you
          end a class.
        </p>
      ) : (
        <ol className="mt-8 divide-y divide-line-soft border-t border-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-5">
              <Link
                href={`/history/${s.id}`}
                className="flex flex-1 flex-col gap-1 hover:opacity-70"
              >
                <span className="font-mono text-xs tracking-wide text-muted uppercase">
                  {formatDate(s.startedAt)} · {formatTimeRange(s.startedAt, s.endedAt)} ·{" "}
                  {s.mode === "low-vision" ? "Low Vision" : "Blind"}
                </span>
                <span className="text-xl font-semibold tracking-tight">
                  {s.states[s.states.length - 1]?.heading || "Untitled class"}
                </span>
                <span className="text-base text-muted">
                  {s.states.length} board update{s.states.length === 1 ? "" : "s"}
                </span>
              </Link>
              <button
                onClick={() => deleteSession(s.id)}
                aria-label={`Delete class from ${formatDate(s.startedAt)}`}
                className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
              >
                Delete
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
