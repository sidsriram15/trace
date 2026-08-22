"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder, useFolders } from "@/lib/folders";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";
import { speak } from "@/lib/speech";
import type { VoiceCommand } from "@/lib/commands";

/** Spoken names arrive lowercased from the recognizer. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export default function NewClass() {
  const router = useRouter();
  const folders = useFolders();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Nothing on this page should need to be seen to be used. It also warns
  // about the permission prompt, which is a purely visual dialog Trace
  // can't speak for you — knowing it's coming is the difference between
  // "the app is broken" and "press Allow".
  useSpokenGuidance(
    "Starting a new class. Press V and say \"call it\" followed by a name to " +
      "name this class, or skip that. Say \"start class\", or press Begin " +
      "class, when you're ready. Your browser will ask for camera and " +
      "microphone permission — choose Allow. Then point the camera at the " +
      "board, and Trace will read it out loud as the lesson unfolds.",
  );

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = createFolder(name);
    setSelectedFolder(folder.id);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const begin = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedFolder) params.set("folder", selectedFolder);
    if (title.trim()) params.set("title", title.trim());
    const qs = params.toString();
    router.push(`/blind${qs ? `?${qs}` : ""}`);
  }, [router, selectedFolder, title]);

  // Naming and starting by voice, so the whole screen can be used without
  // finding the text field. The name is read back because a misheard title
  // is otherwise only visible on screen.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const command = (e as CustomEvent<VoiceCommand>).detail;
      if (command?.action === "name" && command.value) {
        const named = titleCase(command.value);
        setTitle(named);
        speak(`Called it ${named}. Say "start class" when you're ready.`);
      } else if (command?.action === "play") {
        begin();
      }
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [begin]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
        Start a new class
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
        Point your camera at the whiteboard once class begins. Trace will
        watch it and read it out loud as the lesson unfolds. Your browser
        will ask for camera and microphone access — choose Allow.
      </p>

      <div className="mt-12">
        <h2 className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase">
          Folder (optional)
        </h2>
        <div className="mt-4 flex flex-wrap gap-3 border-y border-line py-6">
          <button
            onClick={() => setSelectedFolder(null)}
            aria-pressed={selectedFolder === null}
            className={`border-2 px-5 py-3 text-lg font-medium ${
              selectedFolder === null
                ? "border-line bg-foreground text-background"
                : "border-line-soft hover:border-line"
            }`}
          >
            No folder
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFolder(f.id)}
              aria-pressed={selectedFolder === f.id}
              className={`border-2 px-5 py-3 text-lg font-medium ${
                selectedFolder === f.id
                  ? "border-line bg-foreground text-background"
                  : "border-line-soft hover:border-line"
              }`}
            >
              {f.name}
            </button>
          ))}
          {creatingFolder ? (
            <span className="flex items-center gap-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Folder name"
                className="border-2 border-line px-4 py-3 text-lg"
              />
              <button
                onClick={handleCreateFolder}
                className="border-2 border-line bg-foreground px-4 py-3 text-lg font-medium text-background hover:bg-muted"
              >
                Add
              </button>
            </span>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="border-2 border-dashed border-line-soft px-5 py-3 text-lg font-medium hover:border-line"
            >
              + New folder
            </button>
          )}
        </div>
      </div>

      <div className="mt-10">
        <label
          htmlFor="class-title"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          Class name (optional)
        </label>
        <input
          id="class-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter 4 — Momentum"
          className="mt-3 w-full border-2 border-line px-5 py-4 text-xl"
        />
      </div>

      <button
        onClick={begin}
        className="mt-12 border-2 border-line bg-foreground px-8 py-6 text-2xl font-semibold text-background hover:bg-muted"
      >
        Begin class
      </button>
    </div>
  );
}
