"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureFrame, diffScore, fingerprint } from "@/lib/frame";
import { createRecognizer } from "@/lib/speech";
import { saveSession } from "@/lib/history";

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

export function useTraceSession(
  mode: "low-vision" | "blind",
  meta?: { folderId?: string; title?: string },
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<SessionStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<BoardState[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
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
    const recognizer = createRecognizer({
      onFinal: (text) => {
        const entry = { time: now(), text };
        transcriptRef.current = [...transcriptRef.current, entry].slice(-50);
        setTranscript(transcriptRef.current);
      },
      onInterim: setInterim,
      onUnavailable: (reason) => setSpeechError(reason),
    });
    stopRecognizer.current = () => recognizer?.stop();
    return () => recognizer?.stop();
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
      mode,
      folderId: meta?.folderId,
      title: meta?.title,
      startedAt: startedAt.current,
      endedAt: Date.now(),
      states: statesRef.current,
      transcript: transcriptRef.current,
    });
  }, [mode, meta?.folderId, meta?.title]);

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
    endSession,
  };
}
