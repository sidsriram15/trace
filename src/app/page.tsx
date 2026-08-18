"use client";

import Link from "next/link";
import { useState } from "react";
import { createFolder, deleteFolder, useFolders, type Folder } from "@/lib/folders";
import { deleteSession, useSessions, type SavedSession } from "@/lib/history";
import { ClassRow } from "@/components/ClassRow";

function FolderSection({
  folder,
  classes,
  onDeleteFolder,
}: {
  folder: Folder;
  classes: SavedSession[];
  onDeleteFolder?: () => void;
}) {
  return (
    <section aria-label={`${folder.name} folder`}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-xl font-semibold tracking-tight">{folder.name}</h2>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs tracking-wide text-muted uppercase">
            {classes.length} class{classes.length === 1 ? "" : "es"}
          </span>
          {onDeleteFolder && (
            <button
              onClick={onDeleteFolder}
              className="font-mono text-xs tracking-wide text-muted uppercase hover:text-live"
            >
              Delete folder
            </button>
          )}
        </div>
      </div>
      {classes.length === 0 ? (
        <p className="py-5 text-base leading-7 text-faint">No classes yet.</p>
      ) : (
        <ol className="divide-y divide-line-soft">
          {classes.map((s) => (
            <ClassRow key={s.id} session={s} onDelete={() => deleteSession(s.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Home() {
  const folders = useFolders();
  const sessions = useSessions();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder(name);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const grouped = folders.map((folder) => ({
    folder,
    classes: sessions.filter((s) => s.folderId === folder.id),
  }));
  const unsorted = sessions.filter(
    (s) => !s.folderId || !folders.some((f) => f.id === s.folderId),
  );
  const isEmpty = folders.length === 0 && unsorted.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Your classes
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-muted">
            Organized by folder. Point a camera at the whiteboard to start a
            new one.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/settings"
            className="border border-line px-3 py-1.5 font-mono text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
          >
            Settings
          </Link>
          <Link
            href="/new"
            className="border-2 border-line bg-foreground px-4 py-1.5 font-mono text-xs tracking-wide text-background uppercase hover:bg-muted"
          >
            New class
          </Link>
        </div>
      </div>

      <div className="mt-14 flex-1 space-y-12">
        {grouped.map(({ folder, classes }) => (
          <FolderSection
            key={folder.id}
            folder={folder}
            classes={classes}
            onDeleteFolder={() => deleteFolder(folder.id)}
          />
        ))}

        {unsorted.length > 0 && (
          <FolderSection
            folder={{ id: "unsorted", name: "Unsorted", createdAt: 0 }}
            classes={unsorted}
          />
        )}

        {isEmpty && (
          <p className="max-w-md text-lg leading-8 text-muted">
            Nothing here yet. Start your first class, or create a folder to
            organize classes by subject.
          </p>
        )}

        <div className="border-t border-line pt-8">
          {creatingFolder ? (
            <div className="flex flex-wrap items-center gap-3">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Folder name, e.g. Physics"
                className="border-2 border-line px-4 py-3 text-lg"
              />
              <button
                onClick={handleCreateFolder}
                className="border-2 border-line bg-foreground px-4 py-3 text-lg font-medium text-background hover:bg-muted"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }}
                className="text-base text-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="text-left text-lg font-medium text-muted hover:text-foreground"
            >
              + New folder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
