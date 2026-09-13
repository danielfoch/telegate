"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { motion, useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssembleHeadline } from "@/components/motion/assemble-headline";
import { Reveal } from "@/components/motion/reveal";
import { HarnessLogo } from "@/components/harness-logo";
import { RoutedDiagram } from "@/components/tree/routed-diagram";
import { LEAVES } from "@/components/tree/leaves";
import { TREE } from "@/content/copy";
import { DOC_URLS } from "@/content/links";

const CYCLE_MS = 4000;
const HOVER_HOLD_MS = 6000;

export function TreeSection() {
  const ref = useRef<HTMLElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const inView = useInView(diagramRef, { amount: 0.3 });
  const reduced = useReducedMotionSafe();
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [returned, setReturned] = useState(false);
  const holdUntil = useRef(0);
  const started = useInView(diagramRef, { once: true, amount: 0.35 });

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running = inView && visible && started;

  // the active-route cycle (starts after the draw-in)
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (performance.now() < holdUntil.current) return;
      setActive((a) => (a + 1) % LEAVES.length);
      setCycle((c) => c + 1);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [running]);

  // arrival + return blips, timed to the packet animations in RoutedDiagram
  useEffect(() => {
    if (reduced || !running) return;
    const raf = requestAnimationFrame(() => { setArrived(false); setReturned(false); });
    const t = [
      window.setTimeout(() => setArrived(true), 1650),
      window.setTimeout(() => setArrived(false), 2900),
      window.setTimeout(() => setReturned(true), 3800),
      window.setTimeout(() => setReturned(false), 4800),
    ];
    return () => { cancelAnimationFrame(raf); t.forEach((x) => window.clearTimeout(x)); };
  }, [cycle, active, reduced, running]);

  const select = useCallback((i: number) => {
    holdUntil.current = performance.now() + HOVER_HOLD_MS;
    setActive((prev) => {
      if (prev !== i) setCycle((c) => c + 1);
      return i;
    });
  }, []);

  const leaf = LEAVES[active];

  return (
    <section id="tree" ref={ref} className="relative z-[1] rounded-t-[40px] bg-deep px-5 pb-28 pt-24 text-paper-fixed sm:px-8 lg:pb-36 lg:pt-36">
      <div className="mx-auto max-w-[1240px]">
        <p className="eyebrow text-mint">{TREE.eyebrow}</p>
        <AssembleHeadline lines={[TREE.h2]} className="display mt-4 text-[clamp(2.25rem,5vw,4rem)]" />
        <motion.span className="mt-2 block h-1 w-24 origin-left rounded-full bg-mint" initial={reduced ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ delay: 1.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} aria-hidden />
        <Reveal delay={0.2}>
          <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.55] text-muted-on-dark">{TREE.sub}</p>
        </Reveal>

        <div ref={diagramRef} className="mt-12 lg:mt-16">
          <div className="hidden md:block">
            <RoutedDiagram id="tree-d" active={active} cycle={cycle} arrived={arrived} returned={returned} onSelect={select} reduced={reduced} running={running} />
          </div>
          <div className="md:hidden">
            <RoutedDiagram id="tree-m" vertical active={active} cycle={cycle} arrived={arrived} returned={returned} onSelect={select} reduced={reduced} running={running} />
          </div>
        </div>

        {/* route card: the accessible description of the lit route */}
        <div className="mt-8 flex flex-col gap-4 rounded-[20px] border border-mint/40 bg-terminal-card p-5 sm:flex-row sm:items-start sm:gap-6" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-surface-on-dark text-paper-fixed">
              <HarnessLogo kind={leaf.kind} className="size-6" />
            </span>
            <div>
              <div className="text-[16px] font-semibold">{leaf.name}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-on-dark">{leaf.lane === "local" ? "runs locally" : "over HTTPS"} · {leaf.tag}</div>
            </div>
          </div>
          <p className="text-[15px] leading-[1.55] text-paper-fixed/85 sm:ml-auto sm:max-w-[52ch]">{leaf.tip}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-on-dark">
          <span className="flex items-center gap-2"><span className="inline-block h-2 w-3.5 rounded-sm bg-mint" /> your brief · outbound</span>
          <span className="flex items-center gap-2"><span className="inline-block h-2 w-3.5 rounded-sm bg-paper-fixed/85" /> result · returning</span>
          <span className="flex items-center gap-2"><span className="inline-block h-px w-3.5 border-t border-dashed border-paper-fixed/50" /> offline computer · queued</span>
        </div>
        <p className="mt-6 max-w-[80ch] text-[13px] leading-relaxed text-muted-on-dark">
          {TREE.caption1}{" "}
          <a href={DOC_URLS.iconNotices} target="_blank" rel="noopener" className="underline decoration-paper-fixed/30 underline-offset-2 hover:decoration-paper-fixed">{TREE.caption2}</a>
        </p>
      </div>
    </section>
  );
}
