"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder, deleteFolder, useFolders, type Folder } from "@/lib/folders";
import { deleteSession, useSessions, type SavedSession } from "@/lib/history";
import { ClassRow } from "@/components/ClassRow";
import { useAccount } from "@/lib/account";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";
import { speak } from "@/lib/speech";
import type { VoiceCommand } from "@/lib/commands";

/** Spoken folder names arrive lowercased from the recognizer. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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
  const router = useRouter();
  const folders = useFolders();
  const sessions = useSessions();
  const account = useAccount();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useSpokenGuidance(
    sessions.length === 0
      ? 'Your classes. Nothing saved yet. Press V to talk to Trace, then say "new class" to start one, or "help" to hear everything you can say.'
      : `Your classes. ${sessions.length} saved. Press V to talk to Trace, then say "new class" to start one, or "help" to hear everything you can say.`,
  );

  // "Make a folder called X" and "open X" both work from here without
  // finding anything on screen — the same voice event the /new page
  // listens for, handled differently per action.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const command = (e as CustomEvent<VoiceCommand>).detail;
      if (!command) return;

      if (command.action === "folder" && command.value) {
        const named = titleCase(command.value);
        const existing = folders.find((f) => simplify(f.name) === simplify(named));
        if (existing) {
          speak(`You already have a folder called ${existing.name}.`);
          return;
        }
        createFolder(named);
        speak(`Made a new folder called ${named}.`);
        return;
      }

      if (command.action === "open" && command.value) {
        if (sessions.length === 0) {
          speak("You don't have any saved classes yet.");
          return;
        }
        // useSessions() is already sorted newest first.
        if (command.value === "__last__") {
          router.push(`/history/${sessions[0].id}?autoplay=1`);
          return;
        }
        const said = simplify(command.value);
        const match =
          sessions.find((s) => s.title && simplify(s.title) === said) ??
          sessions.find((s) => s.title && simplify(s.title).includes(said)) ??
          sessions.find((s) => s.title && said.includes(simplify(s.title)));
        if (match) {
          router.push(`/history/${match.id}?autoplay=1`);
        } else {
          speak(`I couldn't find a class called ${command.value}.`);
        }
        return;
      }

      if (command.action === "deletefolder" && command.value) {
        const said = simplify(command.value);
        const match =
          folders.find((f) => simplify(f.name) === said) ??
          folders.find((f) => simplify(f.name).includes(said)) ??
          folders.find((f) => said.includes(simplify(f.name)));
        if (!match) {
          speak(`I couldn't find a folder called ${command.value}.`);
          return;
        }
        deleteFolder(match.id);
        speak(`Deleted the ${match.name} folder. Its classes are still saved, just unsorted.`);
        return;
      }
    };
    window.addEventListener("trace:command", onCommand);
    return () => window.removeEventListener("trace:command", onCommand);
  }, [folders, sessions, router]);

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
          <p className="mt-3 text-base text-muted">
            {account.status === "signed-in" ? (
              <>
                Signed in as{" "}
                <strong className="font-semibold text-foreground">
                  {account.username}
                </strong>{" "}
                — your classes sync across devices.
              </>
            ) : (
              <>
                Saved on this device only.{" "}
                <Link href="/account" className="underline hover:no-underline">
                  Add a PIN
                </Link>{" "}
                to use them elsewhere.
              </>
            )}
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
