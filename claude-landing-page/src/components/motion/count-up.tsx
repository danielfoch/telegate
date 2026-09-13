"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

type Props = {
  to: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  /** Start above and land on `to` (the "$0 counts down 9→0" grin). */
  countDown?: boolean;
  delay?: number;
};

export function CountUp({ to, from, prefix = "", suffix = "", decimals = 0, duration = 1.1, className = "", countDown = false, delay = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotionSafe();
  const start = from ?? (countDown ? 9 : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;
    if (reduced || !inView) {
      el.textContent = fmt(reduced ? to : start);
      return;
    }
    const controls = animate(start, to, {
      duration: countDown ? 0.6 : duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => { el.textContent = fmt(countDown ? Math.round(v) : v); },
    });
    return () => controls.stop();
  }, [inView, reduced, start, to, prefix, suffix, decimals, duration, countDown, delay]);

  return (
    <span ref={ref} className={`tabular ${className}`} aria-label={`${prefix}${to}${suffix}`}>
      {`${prefix}${to.toFixed(decimals)}${suffix}`}
    </span>
  );
}
