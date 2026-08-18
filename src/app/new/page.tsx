"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFolder, useFolders } from "@/lib/folders";
import { useDefaultMode } from "@/lib/settings";
import { speak } from "@/lib/speech";

export default function NewClass() {
  const router = useRouter();
  const folders = useFolders();
  const mode = useDefaultMode();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Blind students shouldn't need to read this page to know what to do.
  useEffect(() => {
    if (mode === "blind") {
      speak(
        "Starting a new class. Choose a folder if you'd like, or skip that " +
          "and press Begin class when you're ready. Trace will watch the " +
          "board and read it out loud as the lesson unfolds.",
      );
    }
  }, [mode]);

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = createFolder(name);
    setSelectedFolder(folder.id);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const begin = () => {
    const params = new URLSearchParams();
    if (selectedFolder) params.set("folder", selectedFolder);
    if (title.trim()) params.set("title", title.trim());
    const qs = params.toString();
    router.push(`/${mode}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">
        {mode === "low-vision" ? "Low Vision mode" : "Blind mode"} ·{" "}
        <Link href="/settings" className="underline hover:no-underline">
          Change in Settings
        </Link>
      </p>
      <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
        Start a new class
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
        Point your camera at the whiteboard once class begins. Trace will
        watch it and{" "}
        {mode === "blind"
          ? "read it out loud"
          : "keep large, structured notes"}{" "}
        as the lesson unfolds.
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
