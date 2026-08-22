"use client";

import { useEffect, useRef } from "react";
import { speak } from "@/lib/speech";
import { getSettings } from "@/lib/settings";

/**
 * Speak a screen's instructions when the student lands on it.
 *
 * Sighted users get this for free by glancing at the page. Without it a
 * blind student has to tab through a screen to find out what it even is —
 * so this is the spoken equivalent of that glance, not an extra flourish.
 * Off if the student turns spoken guidance off in settings; screen-reader
 * users often have their own and don't want two voices at once.
 *
 * Speaks once per visit. The short delay lets the page settle first, so
 * text that depends on data loaded after hydration (a class count, say) is
 * final by the time it's read — and only ever gets read once.
 */
export function useSpokenGuidance(text: string, enabled = true) {
  const textRef = useRef(text);
  const spoken = useRef(false);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!enabled || spoken.current) return;
    if (!getSettings().spokenGuidance) return;
    const timer = setTimeout(() => {
      spoken.current = true;
      speak(textRef.current);
    }, 400);
    return () => clearTimeout(timer);
  }, [enabled]);
}
