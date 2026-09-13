"use client";

import { motion } from "motion/react";
import type { ElementType } from "react";
import { useIsDesktop, useReducedMotionSafe } from "@/lib/use-media";

type Props = {
  lines: string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string[];
  /** Start immediately on mount instead of when scrolled into view. */
  onMount?: boolean;
  delay?: number;
  stagger?: number;
  amount?: number;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/** Word-by-word assembly. Blur is desktop-only and only for short headlines. */
export function AssembleHeadline({ lines, as: Tag = "h2", className = "", lineClassName = [], onMount = false, delay = 0, stagger = 0.055, amount = 0.6 }: Props) {
  const reduced = useReducedMotionSafe();
  const desktop = useIsDesktop();
  const wordCount = lines.reduce((n, l) => n + l.split(" ").length, 0);
  const blur = desktop && wordCount <= 6;

  if (reduced) {
    return (
      <Tag className={className}>
        {lines.map((line, i) => (
          <span key={i} className={`block ${lineClassName[i] ?? ""}`}>{line}</span>
        ))}
      </Tag>
    );
  }

  let k = 0;
  const hidden = blur ? { y: "0.6em", opacity: 0, filter: "blur(6px)" } : { y: 16, opacity: 0 };
  const shown = blur ? { y: 0, opacity: 1, filter: "blur(0px)" } : { y: 0, opacity: 1 };
  const trigger = onMount ? { animate: shown } : { whileInView: shown, viewport: { once: true, amount } };

  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className={`block ${lineClassName[i] ?? ""}`}>
          {line.split(" ").map((word, j) => {
            const idx = k++;
            return (
              <motion.span
                key={`${i}-${j}`}
                className="inline-block will-change-transform"
                initial={hidden}
                {...trigger}
                transition={{ duration: 0.6, ease: EASE, delay: delay + idx * stagger }}
              >
                {word}
                {j < line.split(" ").length - 1 ? " " : ""}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
