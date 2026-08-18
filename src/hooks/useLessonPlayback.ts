"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speak, stopSpeaking } from "@/lib/speech";

export type PlaybackItem = {
  id: number;
  time: string;
  heading: string;
  narration: string;
  erased: boolean;
};

/**
 * Drives a full read-through of a past class: chains narration entries
 * end-to-end via SpeechSynthesis's onend callback, so a blind student can
 * hit play once and hear the whole board history in order, hands-free.
 */
export function useLessonPlayback(items: PlaybackItem[]) {
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const itemsRef = useRef(items);
  const playingRef = useRef(false);
  const speakItemRef = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const speakItem = useCallback((i: number) => {
    const item = itemsRef.current[i];
    if (!item) return;
    const intro = item.erased ? "Board erased and rewritten. " : "";
    const text = `${intro}${item.heading ? item.heading + ". " : ""}${item.narration}`;
    speak(text, () => {
      if (!playingRef.current) return;
      const next = i + 1;
      if (next < itemsRef.current.length) {
        setIndex(next);
        speakItemRef.current(next);
      } else {
        playingRef.current = false;
        setPlaying(false);
        speak("End of class.");
      }
    });
  }, []);

  useEffect(() => {
    speakItemRef.current = speakItem;
  }, [speakItem]);

  const playFrom = useCallback((i: number) => {
    stopSpeaking();
    playingRef.current = true;
    setPlaying(true);
    setIndex(i);
    speakItemRef.current(i);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopSpeaking();
  }, []);

  const next = useCallback(() => {
    const i = Math.min((index ?? -1) + 1, itemsRef.current.length - 1);
    if (playingRef.current) playFrom(i);
    else setIndex(i);
  }, [index, playFrom]);

  const prev = useCallback(() => {
    const i = Math.max((index ?? 0) - 1, 0);
    if (playingRef.current) playFrom(i);
    else setIndex(i);
  }, [index, playFrom]);

  useEffect(
    () => () => {
      playingRef.current = false;
      stopSpeaking();
    },
    [],
  );

  return { index, playing, playFrom, pause, next, prev };
}
