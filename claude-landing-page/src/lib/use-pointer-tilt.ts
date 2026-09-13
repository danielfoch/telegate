"use client";

import { useMotionValue, useSpring } from "motion/react";
import { useCallback } from "react";
import type { PointerEvent } from "react";

/** Pointer-driven tilt (pointer:fine only). Returns springs in degrees / px. */
export function usePointerTilt(enabled: boolean, maxY = 6, maxX = 4) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 120, damping: 18 });
  const shiftX = useSpring(px, { stiffness: 120, damping: 20 });
  const shiftY = useSpring(py, { stiffness: 120, damping: 20 });

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const r = e.currentTarget.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      ry.set(nx * maxY);
      rx.set(-ny * maxX);
      px.set(nx);
      py.set(ny);
    },
    [enabled, maxX, maxY, px, py, rx, ry],
  );
  const onPointerLeave = useCallback(() => {
    rx.set(0); ry.set(0); px.set(0); py.set(0);
  }, [px, py, rx, ry]);

  return { rotateX, rotateY, shiftX, shiftY, onPointerMove, onPointerLeave };
}
