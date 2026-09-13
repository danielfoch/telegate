"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef } from "react";

export type Ground = "paper" | "terminal" | "deep" | "mint" | "footer";

const SCENES: { id: string; ground: Ground }[] = [
  { id: "hero", ground: "paper" },
  { id: "install", ground: "terminal" },
  { id: "prompt", ground: "terminal" },
  { id: "talk", ground: "paper" },
  { id: "tree", ground: "deep" },
  { id: "pricing", ground: "mint" },
  { id: "footer", ground: "footer" },
];

/** Sets html[data-ground] from whichever section sits under the nav bar. */
export function GroundWatcher() {
  const { scrollY } = useScroll();
  const stops = useRef<{ top: number; ground: Ground }[]>([]);

  useEffect(() => {
    const measure = () => {
      stops.current = SCENES.flatMap(({ id, ground }) => {
        const el = document.getElementById(id);
        if (!el) return [];
        const top = el.getBoundingClientRect().top + window.scrollY;
        return [{ top, ground }];
      }).sort((a, b) => a.top - b.top);
      apply(window.scrollY);
    };
    const apply = (y: number) => {
      const probe = y + 64;
      let ground: Ground = "paper";
      for (const s of stops.current) if (probe >= s.top) ground = s.ground;
      if (document.documentElement.dataset.ground !== ground) document.documentElement.dataset.ground = ground;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("orientationchange", measure);
    const t = window.setTimeout(measure, 800);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
      window.clearTimeout(t);
    };
  }, []);

  useMotionValueEvent(scrollY, "change", (y) => {
    const probe = y + 64;
    let ground: Ground = "paper";
    for (const s of stops.current) if (probe >= s.top) ground = s.ground;
    if (document.documentElement.dataset.ground !== ground) document.documentElement.dataset.ground = ground;
  });

  return null;
}
