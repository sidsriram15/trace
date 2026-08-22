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

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Find the folder a student meant. Exact match first, then containment,
 * so "science" reaches "Science 9" and "put it in my science folder"
 * doesn't miss because of the extra words.
 */
function findFolder<T extends { name: string }>(folders: T[], spoken: string): T | null {
  const said = simplify(spoken);
  if (!said) return null;
  return (
    folders.find((f) => simplify(f.name) === said) ??
    folders.find((f) => simplify(f.name).includes(said)) ??
    folders.find((f) => said.includes(simplify(f.name))) ??
    null
  );
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
    "Starting a new class. Press V to talk to Trace. " +
      'Say "call it" and a name to name this class — for example, call it chapter four momentum. ' +
      'Say "put it in" and a folder name to file it — for example, put it in science. ' +
      'Say "start class" when you\'re ready, or press the Begin class button. ' +
      "Your browser will ask for camera and microphone permission — choose Allow. " +
      "Then point the camera at the board, and Trace will read it out loud as the lesson unfolds.",
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
      } else if (command?.action === "folder" && command.value) {
        const existing = findFolder(folders, command.value);
        if (existing) {
          setSelectedFolder(existing.id);
          speak(`Filed under ${existing.name}.`);
        } else {
          // Naming a folder that doesn't exist yet creates it — otherwise
          // the only way to make one is to find the button on screen.
          const created = createFolder(titleCase(command.value));
          setSelectedFolder(created.id);
          speak(`Made a new folder called ${created.name}, and filed this class in it.`);
        }
      } else if (command?.action === "play") {
        begin();
      }
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [begin, folders]);

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
