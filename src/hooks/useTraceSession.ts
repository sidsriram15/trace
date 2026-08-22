"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureFrame, diffScore, fingerprint } from "@/lib/frame";
import { ensureMicrophone, listen, microphoneLabel, pulse } from "@/lib/speech";
import { saveSession } from "@/lib/history";
import { isWakePhrase, parseWakeCommand, type VoiceAction } from "@/lib/commands";

export type BoardState = {
  id: number;
  time: string; // "9:21 AM"
  label: string;
  heading: string;
  narration: string;
  notes: string;
  erased: boolean;
  image: string; // JPEG data URL of the frame that produced this state
};

export type TranscriptEntry = { time: string; text: string };

export type SessionStatus = "starting" | "live" | "error";

const CAPTURE_INTERVAL_MS = 4000;
// Mean luminance delta (0–255) on the downscaled frame that counts as
// "the board probably changed" — tuned loose; Claude makes the real call.
const DIFF_THRESHOLD = 5;
// Re-check with the model occasionally even if pixels look stable, so slow
// handwriting accumulation isn't missed forever.
const FORCE_ANALYZE_MS = 30000;

function now() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Commands the student can speak while a class is running. */
export const IN_CLASS_COMMANDS = [
  "pause",
  "resume",
  "repeat",
  "help",
  "end",
  "status",
] as const satisfies readonly VoiceAction[];

export function useTraceSession(meta?: {
  folderId?: string;
  title?: string;
  onCommand?: (action: VoiceAction) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<SessionStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<BoardState[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [micLabel, setMicLabel] = useState<string | null>(null);
  const startedAt = useRef(0);
  const statesRef = useRef<BoardState[]>([]);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const [stopped, setStopped] = useState(false);
  const stoppedRef = useRef(false);
  const stopStream = useRef<(() => void) | null>(null);
  const stopRecognizer = useRef<(() => void) | null>(null);
  const captureInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const inFlight = useRef(false);
  const lastFingerprint = useRef<Uint8Array | null>(null);
  const lastAnalyzedAt = useRef(0);
  const notesRef = useRef("");
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const nextId = useRef(0);
  // Kept in a ref so a new handler identity doesn't tear down and restart
  // the recognizer mid-class.
  const onCommandRef = useRef(meta?.onCommand);
  useEffect(() => {
    onCommandRef.current = meta?.onCommand;
  }, [meta?.onCommand]);

  const analyze = useCallback(async (force = false) => {
    const video = videoRef.current;
    if (!video || inFlight.current) return;

    const print = fingerprint(video);
    if (!print) return;

    const overdue = Date.now() - lastAnalyzedAt.current > FORCE_ANALYZE_MS;
    const moved =
      !lastFingerprint.current ||
      diffScore(print, lastFingerprint.current) > DIFF_THRESHOLD;
    if (!force && !moved && !overdue) return;

    const image = captureFrame(video);
    if (!image) return;

    inFlight.current = true;
    setAnalyzing(true);
    try {
      const tail = transcriptRef.current
        .slice(-6)
        .map((t) => t.text)
        .join(" ");
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: image.split(",")[1],
          notes: notesRef.current,
          transcript: tail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      lastFingerprint.current = print;
      lastAnalyzedAt.current = Date.now();

      if (data.changed) {
        notesRef.current = data.notes;
        const entry = {
          id: nextId.current++,
          time: now(),
          label: data.label || "Board update",
          heading: data.heading || "Whiteboard",
          narration: data.narration,
          notes: data.notes,
          erased: data.erased,
          image,
        };
        statesRef.current = [...statesRef.current, entry];
        setStates(statesRef.current);
        pulse(entry.erased ? [40, 60, 40] : 40);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      inFlight.current = false;
      setAnalyzing(false);
    }
  }, []);

  // Camera + capture loop
  useEffect(() => {
    if (stoppedRef.current) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled || stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("live");
        captureInterval.current = setInterval(() => analyze(), CAPTURE_INTERVAL_MS);
        stopStream.current = () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (captureInterval.current) clearInterval(captureInterval.current);
        };
      } catch {
        if (!cancelled && !stoppedRef.current) {
          setStatus("error");
          setError(
            "Camera unavailable. Allow camera access and reload, then point it at the whiteboard.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (captureInterval.current) clearInterval(captureInterval.current);
    };
  }, [analyze]);

  // Live transcription
  useEffect(() => {
    if (stoppedRef.current) return;
    let release: (() => void) | null = null;
    let cancelled = false;

    // Commands are matched on interim results as well as final ones, so
    // "Trace, pause" acts immediately instead of waiting for the recognizer
    // to decide the phrase is over — which can take several seconds, or
    // never happen at all while someone keeps talking. `lastCommand` stops
    // the same utterance firing twice as its interim text firms up.
    let lastCommand = "";
    let lastCommandAt = 0;

    const tryCommand = (text: string): boolean => {
      const command = parseWakeCommand(text, IN_CLASS_COMMANDS);
      if (!command) return false;
      const nowMs = Date.now();
      if (command === lastCommand && nowMs - lastCommandAt < 4000) return true;
      lastCommand = command;
      lastCommandAt = nowMs;
      onCommandRef.current?.(command);
      return true;
    };

    const startListening = () => {
      if (cancelled) return;
      release = listen({
      onInterim: (text) => {
        if (tryCommand(text)) {
          setInterim("");
          return;
        }
        setInterim(text);
      },
      onFinal: (text) => {
        // The lecture recognizer is the only thing holding the mic during a
        // class, so spoken commands have to be picked out of its stream —
        // wake word required, or "let's pause here" from the teacher would
        // pause narration.
        setInterim("");
        if (tryCommand(text)) return;
        // Addressed to Trace but not understood — don't file it as lecture.
        if (isWakePhrase(text)) return;

        const entry = { time: now(), text };
        transcriptRef.current = [...transcriptRef.current, entry].slice(-50);
        setTranscript(transcriptRef.current);
      },
        onError: (reason, fatal) => setSpeechError(fatal ? reason : null),
      });
      stopRecognizer.current = () => release?.();
    };

    // An unanswered permission prompt leaves getUserMedia pending forever,
    // which on screen is indistinguishable from a quiet room — so say what
    // it's actually waiting for.
    const waiting = setTimeout(() => {
      if (!cancelled) {
        setSpeechError(
          'Waiting for microphone permission — choose "Allow" in your browser.',
        );
      }
    }, 4000);

    // Ask for the microphone explicitly first, so a blocked prompt or a
    // dead input device reports itself instead of looking like a silent room.
    void ensureMicrophone().then((problem) => {
      clearTimeout(waiting);
      if (cancelled) return;
      if (problem) {
        setSpeechError(problem);
        return;
      }
      setMicLabel(microphoneLabel());
      setSpeechError(null);
      startListening();
    });

    return () => {
      cancelled = true;
      clearTimeout(waiting);
      release?.();
    };
  }, []);

  const endSession = useCallback(() => {
    stoppedRef.current = true;
    setStopped(true);
    stopStream.current?.();
    stopRecognizer.current?.();
    if (captureInterval.current) clearInterval(captureInterval.current);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("error"); // repurpose: signals "not live"
    setInterim("");
    saveSession({
      folderId: meta?.folderId,
      title: meta?.title,
      startedAt: startedAt.current,
      endedAt: Date.now(),
      states: statesRef.current,
      transcript: transcriptRef.current,
    });
  }, [meta?.folderId, meta?.title]);

  return {
    videoRef,
    status,
    stopped,
    error,
    states,
    latest: states.length ? states[states.length - 1] : null,
    transcript,
    interim,
    analyzing,
    speechError,
    micLabel,
    endSession,
  };
}
