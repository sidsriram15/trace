import Link from "next/link";
import type { SavedSession } from "@/lib/history";

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

export function ClassRow({
  session,
  onDelete,
}: {
  session: SavedSession;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-4 py-5">
      <Link
        href={`/history/${session.id}`}
        className="flex flex-1 flex-col gap-1 hover:opacity-70"
      >
        <span className="font-mono text-xs tracking-wide text-muted uppercase">
          {formatDate(session.startedAt)} ·{" "}
          {formatTimeRange(session.startedAt, session.endedAt)}
        </span>
        <span className="text-xl font-semibold tracking-tight">
          {session.title ||
            session.states[session.states.length - 1]?.heading ||
            "Untitled class"}
        </span>
        <span className="text-base text-muted">
          {session.states.length} board update
          {session.states.length === 1 ? "" : "s"}
        </span>
      </Link>
      <button
        onClick={onDelete}
        aria-label={`Delete class from ${formatDate(session.startedAt)}`}
        className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
      >
        Delete
      </button>
    </li>
  );
}
