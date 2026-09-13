"use client";

import type { CSSProperties } from "react";
import type { WaveMode } from "@/components/hero/use-hero-loop";

type Props = {
  amp: number;
  mode: WaveMode;
  bars?: number;
  className?: string;
};

/** 28 bars (20 on small screens). Bars animate scaleY only; amplitude is the wrapper's scaleY. */
export function Waveform({ amp, mode, bars = 28, className = "" }: Props) {
  return (
    <div
      className={`wave ${className}`}
      data-mode={mode}
      style={{ "--amp": Math.max(0.12, amp) } as CSSProperties}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={`wave-bar ${i >= 20 ? "hidden sm:block" : ""}`} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}
