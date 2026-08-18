import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
          Follow the whiteboard and the lecture, live.
        </h1>
        <Link
          href="/history"
          className="shrink-0 border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
        >
          Past classes
        </Link>
      </div>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
        Point a camera at the board before class starts. Trace captures what
        the teacher writes and says, keeps every erased board state, and
        presents the class in the form that works for you.
      </p>

      <div className="mt-14 flex-1">
        <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Select mode
        </h2>
        <div className="mt-3 border-t border-line">
          <Link
            href="/low-vision"
            className="group grid gap-2 border-b border-line py-8 sm:grid-cols-[1fr_2fr] sm:gap-8"
          >
            <span className="text-2xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
              Low Vision
            </span>
            <span className="max-w-xl text-base leading-7 text-muted">
              A large, high-contrast view of the board, reorganized into
              structured notes as the lesson unfolds. Scroll back through
              everything — including what was erased.
            </span>
          </Link>
          <Link
            href="/blind"
            className="group grid gap-2 border-b border-line py-8 sm:grid-cols-[1fr_2fr] sm:gap-8"
          >
            <span className="text-2xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
              Blind
            </span>
            <span className="max-w-xl text-base leading-7 text-muted">
              Spoken narration of what changes on the board and how it
              connects to what the teacher is saying — described in context,
              not read off flat. Replay anything, any time.
            </span>
          </Link>
        </div>
      </div>

      <p className="mt-12 max-w-xl font-mono text-xs leading-5 tracking-wide text-faint">
        Requires camera and microphone access. Runs in the browser — nothing
        to install.
      </p>
    </div>
  );
}
