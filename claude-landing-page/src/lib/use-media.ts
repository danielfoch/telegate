"use client";

import { useEffect, useState } from "react";
import { useReducedMotion as useReducedMotionRaw } from "motion/react";

function useMedia(query: string, initial = false) {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** ≥1024px: sticky stages, scroll scrubs and pointer effects are enabled. */
export function useIsDesktop() {
  return useMedia("(min-width: 1024px)");
}

/** A real pointer that can hover. Touch devices get idle floats instead of tilt. */
export function usePointerFine() {
  return useMedia("(hover: hover) and (pointer: fine)");
}

/** True once the component is mounted on the client. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

/**
 * `useReducedMotion` that only turns true after mount, so the first client
 * render matches the server-rendered markup (no hydration mismatch).
 */
export function useReducedMotionSafe() {
  const reduced = useReducedMotionRaw();
  const mounted = useMounted();
  return !!reduced && mounted;
}
