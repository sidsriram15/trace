"use client";

import Link from "next/link";
import { setDefaultMode, useDefaultMode } from "@/lib/settings";

export default function SettingsPage() {
  const mode = useDefaultMode();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <p className="text-sm text-muted">
        <Link href="/" className="underline hover:no-underline">
          Your classes
        </Link>
      </p>
      <h1 className="mt-1 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
        Settings
      </h1>

      <div className="mt-12">
        <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Accessibility mode
        </h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          This decides how a new class is presented once you start it —
          spoken narration, or a large, high-contrast board view. Change it
          any time; it only applies to classes you start after changing it.
        </p>

        <div className="mt-6 border-t border-line">
          <button
            onClick={() => setDefaultMode("low-vision")}
            aria-pressed={mode === "low-vision"}
            className={`grid w-full gap-2 border-b border-line py-8 text-left sm:grid-cols-[1fr_2fr] sm:gap-8 ${
              mode === "low-vision" ? "bg-surface" : "hover:bg-surface"
            }`}
          >
            <span className="text-2xl font-semibold tracking-tight">
              Low Vision{mode === "low-vision" && " · Current"}
            </span>
            <span className="max-w-xl text-base leading-7 text-muted">
              A large, high-contrast view of the board, reorganized into
              structured notes as the lesson unfolds. Scroll back through
              everything — including what was erased.
            </span>
          </button>
          <button
            onClick={() => setDefaultMode("blind")}
            aria-pressed={mode === "blind"}
            className={`grid w-full gap-2 border-b border-line py-8 text-left sm:grid-cols-[1fr_2fr] sm:gap-8 ${
              mode === "blind" ? "bg-surface" : "hover:bg-surface"
            }`}
          >
            <span className="text-2xl font-semibold tracking-tight">
              Blind{mode === "blind" && " · Current"}
            </span>
            <span className="max-w-xl text-base leading-7 text-muted">
              Spoken narration of what changes on the board and how it
              connects to what the teacher is saying — described in context,
              not read off flat. Replay anything, any time.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
