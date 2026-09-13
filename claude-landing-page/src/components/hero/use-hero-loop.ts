"use client";

import { useEffect, useRef, useState } from "react";
import { ROTATION } from "@/content/copy";

export type HeroPhase = "idle" | "tap" | "speak" | "brief" | "reply" | "sent" | "clear";
export type WaveMode = "idle" | "speak" | "reply";

export type HeroState = {
  screen: "idle" | "live";
  phase: HeroPhase;
  /** index into ROTATION */
  index: number;
  /** words of the YOU bubble revealed so far (0 = bubble hidden) */
  typed: number;
  /** seconds since the call went live, continuous across prompts */
  elapsed: number;
  amp: number;
  mode: WaveMode;
  arcs: "none" | "out" | "back";
  pressed: boolean;
  showBrief: boolean;
  showReply: boolean;
  showSent: boolean;
  clearing: boolean;
};

const IDLE = 1.6; // idle beat before LIVE (TAP at 1.2)
const TAP = 1.2;
const CYCLE = 8.0;
const N = ROTATION.length;
const ROTATION_LEN = IDLE + CYCLE * N;
const WORD_MS = 60;

const INITIAL: HeroState = {
  screen: "idle",
  phase: "idle",
  index: 0,
  typed: 0,
  elapsed: 0,
  amp: 0,
  mode: "idle",
  arcs: "none",
  pressed: false,
  showBrief: false,
  showReply: false,
  showSent: false,
  clearing: false,
};

function derive(t: number, reduced: boolean): HeroState {
  if (t < IDLE) {
    return { ...INITIAL, phase: t >= TAP ? "tap" : "idle", pressed: t >= TAP && t < TAP + 0.3 };
  }
  const live = t - IDLE;
  const index = Math.min(N - 1, Math.floor(live / CYCLE));
  const c = live - index * CYCLE;
  const words = ROTATION[index].you.split(" ").length;
  const base: HeroState = {
    ...INITIAL,
    screen: "live",
    index,
    elapsed: Math.floor(live),
    amp: 0.25,
    mode: "idle",
  };
  if (c < 2.8) {
    const typingStart = 0.6;
    const typed = reduced
      ? c >= typingStart ? words : 0
      : c < typingStart ? 0 : Math.min(words, Math.floor(((c - typingStart) * 1000) / WORD_MS) + 1);
    const stillTalking = typed < words || c < 1.4;
    return { ...base, phase: "speak", typed, amp: stillTalking ? 1 : 0.55, mode: "speak", arcs: reduced || !stillTalking ? "none" : "out" };
  }
  if (c < 3.8) return { ...base, phase: "brief", typed: words, showBrief: true, amp: 0.25, mode: "idle" };
  if (c < 5.0) {
    const burst = c < 4.5;
    return { ...base, phase: "reply", typed: words, showReply: true, amp: burst ? 0.8 : 0.35, mode: "reply", arcs: reduced ? "none" : "back" };
  }
  if (c < 6.6) return { ...base, phase: "sent", typed: words, showReply: true, showSent: true, amp: 0.25, mode: "idle" };
  if (c < 7.2) return { ...base, phase: "clear", typed: words, showReply: true, showSent: true, clearing: true, amp: 0.2, mode: "idle" };
  return { ...base, phase: "clear", typed: 0, amp: 0.2, mode: "idle" };
}

function same(a: HeroState, b: HeroState) {
  return (
    a.screen === b.screen && a.phase === b.phase && a.index === b.index && a.typed === b.typed &&
    a.elapsed === b.elapsed && a.amp === b.amp && a.mode === b.mode && a.arcs === b.arcs &&
    a.pressed === b.pressed && a.showBrief === b.showBrief && a.showReply === b.showReply &&
    a.showSent === b.showSent && a.clearing === b.clearing
  );
}

/**
 * One clock for the whole hero demo. rAF-timestamped; state only changes at
 * phase boundaries (plus the per-word typing and per-second timer).
 */
export function useHeroLoop({ paused, reduced, startDelay = 1.2 }: { paused: boolean; reduced: boolean; startDelay?: number }) {
  const [state, setState] = useState<HeroState>(INITIAL);
  const stateRef = useRef(state);
  const offsetRef = useRef(-startDelay); // seconds of loop time already elapsed when (re)started
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      // freeze: bank the elapsed loop time
      if (startedAtRef.current !== null) {
        offsetRef.current += (performance.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
      }
      return;
    }
    let raf = 0;
    startedAtRef.current = performance.now();
    const tick = (now: number) => {
      const started = startedAtRef.current ?? now;
      const raw = offsetRef.current + (now - started) / 1000;
      const t = raw < 0 ? 0 : raw % ROTATION_LEN;
      const next = derive(t, reduced);
      if (!same(stateRef.current, next)) {
        stateRef.current = next;
        setState(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || startedAtRef.current === null) return;
      // restart at the beginning of the current prompt cycle so nothing drifts
      const now = performance.now();
      const raw = offsetRef.current + (now - startedAtRef.current) / 1000;
      const t = raw < 0 ? 0 : raw % ROTATION_LEN;
      const cycleStart = t < IDLE ? 0 : IDLE + Math.floor((t - IDLE) / CYCLE) * CYCLE;
      offsetRef.current = cycleStart;
      startedAtRef.current = now;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused, reduced]);

  return state;
}
