"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, speak, stopSpeaking } from "@/lib/speech";
import { matchCommand, type VoiceAction } from "@/lib/commands";

export type ListenState = "idle" | "listening" | "unavailable";

// How long to wait for speech before giving up, and how long to wait after
// the student stops talking before acting on what they said. Continuous
// recognition often never marks a short phrase final, so a silence timer is
// what actually ends most commands.
const NO_SPEECH_MS = 7000;
const SETTLE_MS = 1100;

/**
 * Push-to-talk voice commands.
 *
 * Borrows the app's single shared recognizer for the length of one
 * utterance and hands it straight back, so this works the same on a quiet
 * screen and in the middle of a class where the lecture transcript is
 * already using the microphone.
 */
export function useVoiceCommands(options: {
  allowed: readonly VoiceAction[];
  onCommand: (action: VoiceAction) => void;
  /** Spoken when the student asks what they can say here. */
  help: string;
  enabled?: boolean;
}) {
  const [listenState, setListenState] = useState<ListenState>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const sessionRef = useRef<{ cancel: () => void } | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const stop = useCallback(() => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setListenState("idle");
  }, []);

  const start = useCallback(() => {
    if (sessionRef.current) {
      stop();
      return;
    }

    stopSpeaking();
    setHeard(null);
    setListenState("listening");

    let best = "";
    let settle: ReturnType<typeof setTimeout> | null = null;
    let giveUp: ReturnType<typeof setTimeout> | null = null;
    let release = () => {};
    let done = false;

    const teardown = () => {
      done = true;
      if (settle) clearTimeout(settle);
      if (giveUp) clearTimeout(giveUp);
      release();
    };

    const finish = (text: string) => {
      if (done) return;
      teardown();
      sessionRef.current = null;
      setListenState("idle");

      const { allowed, onCommand, help } = optionsRef.current;
      const said = text.trim();
      if (!said) {
        setHeard("Didn't catch that.");
        speak("Didn't catch that. Try again.");
        return;
      }
      setHeard(said);
      const action = matchCommand(said, allowed);
      if (action === "help") speak(help);
      else if (action) onCommand(action);
      else speak(`I don't know how to ${said} here. Say help to hear your options.`);
    };

    giveUp = setTimeout(() => finish(best), NO_SPEECH_MS);

    const bump = (text: string) => {
      best = text;
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => finish(best), SETTLE_MS);
    };

    release = listen({
      onInterim: bump,
      onFinal: (text) => finish(text),
      onError: (reason, fatal) => {
        if (!fatal || done) return;
        teardown();
        sessionRef.current = null;
        setListenState("unavailable");
        setHeard(reason);
        speak(reason);
      },
    });

    sessionRef.current = {
      cancel: () => {
        if (done) return;
        teardown();
      },
    };
  }, [stop]);

  // "V" anywhere opens the mic, so voice commands don't depend on finding a
  // button first. Skipped while typing, and while a modifier is held so it
  // can't shadow a browser or screen-reader shortcut.
  useEffect(() => {
    if (options.enabled === false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
        return;
      if (e.key.toLowerCase() === "v") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start, options.enabled]);

  useEffect(() => () => sessionRef.current?.cancel(), []);

  return { listenState, heard, listen: start };
}
