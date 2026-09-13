"use client";

import type { CSSProperties } from "react";

type Props = { arcs: "none" | "out" | "back"; className?: string };

/**
 * Sound travelling between the person out of frame (the VoiceDot, left) and
 * the phone. Outbound rings grow from the dot toward the phone's mic; the reply
 * grows from the phone's earpiece back toward the dot, in mint. Each ring is a
 * full circle scaled about its own centre (fill-box) and clipped to a half.
 * Coordinates live in a 600×650 box that matches the phone column.
 */
export function WaveArcs({ arcs, className = "" }: Props) {
  const R = 210;
  return (
    <svg viewBox="0 0 600 650" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden data-arcs={arcs}>
      <defs>
        <clipPath id="tg-clip-right"><rect x="0" y="-400" width="800" height="1000" /></clipPath>
        <clipPath id="tg-clip-left"><rect x="-800" y="-400" width="800" height="1000" /></clipPath>
      </defs>
      {arcs === "out" ? (
        <g transform="translate(70 300)" clipPath="url(#tg-clip-right)" className="text-ink">
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} r={R} className="arc" style={{ "--k": k, stroke: "currentColor" } as CSSProperties} />
          ))}
        </g>
      ) : null}
      {arcs === "back" ? (
        <g transform="translate(300 70)" clipPath="url(#tg-clip-left)" className="text-mint-text">
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} r={R} className="arc" style={{ "--k": k, stroke: "currentColor" } as CSSProperties} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
