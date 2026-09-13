"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

type Props = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode;
  delay?: number;
  y?: number;
  amount?: number;
  once?: boolean;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({ delay = 0, y = 32, amount = 0.3, once = true, children, ...rest }: Props) {
  const reduced = useReducedMotionSafe();
  if (reduced) return <div className={rest.className as string | undefined} style={rest.style as CSSProperties | undefined}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
