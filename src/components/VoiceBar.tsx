"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { restoreSession } from "@/lib/account";
import { speak } from "@/lib/speech";
import type { VoiceAction } from "@/lib/commands";

/** What each screen can be told to do, and what it says when asked. */
function commandsFor(pathname: string): {
  allowed: VoiceAction[];
  help: string;
  where: string;
} {
  const nav: VoiceAction[] = ["home", "new", "settings", "help", "status"];

  if (pathname === "/")
    return {
      allowed: nav,
      where: "Your classes. This is the home page, listing every class you've saved.",
      help: 'On your classes you can say: "new class" to start one, "settings" to change the voice and reading speed, or "where am I". Press the space bar any time to talk to Trace.',
    };
  if (pathname === "/new")
    return {
      allowed: [...nav, "name", "folder", "play"],
      where: "Starting a new class. Choose a folder, name it, or begin straight away.",
      help:
        "Here you can say four things. " +
        'One: "call it" and a name, for example "call it chapter four momentum". ' +
        'Two: "put it in" and a folder, for example "put it in science" — if that folder does not exist yet, Trace makes it. ' +
        'Three: "start class" to begin. ' +
        'Four: "my classes" to go back, or "settings".',
    };
  if (pathname === "/settings")
    return {
      allowed: nav,
      where: "Settings. Reading speed, vibration, spoken guidance and your account.",
      help: 'In settings you can say: "my classes" to go back, or "new class" to start one.',
    };
  if (pathname === "/account")
    return {
      allowed: nav,
      where: "The sign-in page. You can use Trace without an account at all.",
      help: 'Here you can say: "my classes" to go back and keep using Trace without an account.',
    };
  if (pathname.startsWith("/history/"))
    return {
      allowed: [...nav, "play", "pause", "next", "previous", "repeat"],
      where: "A saved class. You can play it back from here.",
      help: 'In a saved class you can say: "play" to hear the whole class, "pause", "next", "previous", or "my classes" to go back.',
    };
  if (pathname === "/blind")
    return {
      allowed: ["pause", "resume", "repeat", "end", "help", "status", "name"],
      where: "A class in progress. Trace is watching the board.",
      help:
        "During a class you can say: " +
        '"pause" to stop Trace reading and stop it watching the board, ' +
        '"resume" to start again, ' +
        '"repeat" to hear the last thing again, ' +
        '"call it" and a name to rename this class, ' +
        '"where am I" to hear what is going on, ' +
        'or "end class" to save it and finish. ' +
        'Any of these also work hands-free by saying "Trace" first, for example "Trace, pause". ' +
        "On the keyboard: space bar pauses and resumes, R repeats, E ends the class, and H repeats this list.",
    };
  return {
    allowed: nav,
    where: "Trace.",
    help: 'You can say: "my classes", "new class", or "settings".',
  };
}

/**
 * Push-to-talk, on every screen including a live class. The recognizer is
 * shared app-wide, so pressing V mid-class borrows the microphone from the
 * lecture transcript for one utterance and gives it straight back — the
 * wake word is for hands-free use, not the only way in.
 */
export function VoiceBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { allowed, help, where } = commandsFor(pathname);

  useEffect(() => {
    void restoreSession();
  }, []);

  const { listenState, heard, listen } = useVoiceCommands({
    allowed,
    help,
    // In a class the space bar pauses; everywhere else it opens the mic.
    spaceToTalk: pathname !== "/blind",
    onCommand: (command) => {
      switch (command.action) {
        case "home":
          speak("Your classes.");
          router.push("/");
          break;
        case "new":
          // Already here: "start class" means begin, not navigate.
          if (pathname === "/new") {
            window.dispatchEvent(
              new CustomEvent("trace:command", { detail: { action: "play" } }),
            );
          } else {
            router.push("/new");
          }
          break;
        case "settings":
          speak("Settings.");
          router.push("/settings");
          break;
        case "status":
          speak(where);
          break;
        default:
          // Playback, naming and in-class commands are handled by the page
          // showing them, which listens for them on the window.
          window.dispatchEvent(new CustomEvent("trace:command", { detail: command }));
      }
    },
  });

  const label =
    listenState === "listening"
      ? "Listening — say a command"
      : pathname === "/blind"
        ? "Talk to Trace (press V)"
        : "Talk to Trace (press space)";

  return (
    <>
      {/* Announced to screen readers without stealing focus. */}
      <p aria-live="polite" className="sr-only">
        {listenState === "listening" ? "Listening." : (heard ?? "")}
      </p>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4">
        <button
          onClick={listen}
          aria-pressed={listenState === "listening"}
          className={`pointer-events-auto border-2 border-line px-5 py-4 font-mono text-sm font-semibold tracking-wide uppercase ${
            listenState === "listening"
              ? "bg-live text-background"
              : "bg-foreground text-background hover:bg-muted"
          }`}
        >
          {label}
        </button>
      </div>
    </>
  );
}
