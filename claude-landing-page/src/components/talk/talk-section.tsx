"use client";

import { AnimatePresence, motion, useInView, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AssembleHeadline } from "@/components/motion/assemble-headline";
import { Reveal } from "@/components/motion/reveal";
import { PhoneFrame } from "@/components/phone/phone-frame";
import { CallIdle, CallLive, DashboardScreen, TasksScreen } from "@/components/phone/screens";
import { ROTATION, TALK } from "@/content/copy";
import { useIsDesktop, useReducedMotionSafe } from "@/lib/use-media";

type ScreenKey = "live" | "menu" | "tasks-working" | "tasks-done" | "dashboard";

const CODEX = ROTATION[3];

function Screen({ k }: { k: ScreenKey }) {
  switch (k) {
    case "live":
      return <CallLive rotation={CODEX} elapsed={7} amp={0.35} mode="idle" typed={CODEX.you.split(" ").length} showBrief={false} showReply showSent clearing={false} />;
    case "menu":
      return <CallIdle picker="Claude Code · Mac mini" kind="claude" menuOpen />;
    case "tasks-working":
      return <TasksScreen state="working" />;
    case "tasks-done":
      return <TasksScreen state="completed" />;
    case "dashboard":
      return <DashboardScreen />;
  }
}

const TAB: Record<ScreenKey, "call" | "tasks" | "dashboard"> = { live: "call", menu: "call", "tasks-working": "tasks", "tasks-done": "tasks", dashboard: "dashboard" };

function Beat({ index, active, dim, onEnter, children }: { index: number; active: boolean; dim: boolean; onEnter: (i: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-40% 0px -40% 0px" });
  useEffect(() => { if (inView) onEnter(index); }, [inView, index, onEnter]);
  return (
    <div ref={ref} className="relative flex items-center py-8 lg:min-h-[70vh] lg:py-0">
      <motion.div className="relative pl-6" animate={{ opacity: active || !dim ? 1 : 0.35 }} transition={{ duration: 0.4 }}>
        <motion.span className="absolute left-0 top-1 h-[calc(100%-8px)] w-[3px] origin-top rounded-full bg-mint" initial={{ scaleY: 0 }} animate={{ scaleY: active ? 1 : 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        {children}
      </motion.div>
    </div>
  );
}

export function TalkSection() {
  const desktop = useIsDesktop();
  const reduced = useReducedMotionSafe();
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState<"tasks-working" | "tasks-done" | "dashboard">("tasks-working");
  const screen: ScreenKey = active === 0 ? "live" : active === 1 ? "menu" : stage;
  const beatsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: beatsRef, offset: ["start center", "end center"] });
  const rule = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    if (active !== 2) return;
    const raf = requestAnimationFrame(() => setStage("tasks-working"));
    const a = window.setTimeout(() => setStage("tasks-done"), 1600);
    const b = window.setTimeout(() => setStage("dashboard"), 4200);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(a); window.clearTimeout(b); };
  }, [active]);

  const phone = (k: ScreenKey, scale: number) => (
    <PhoneFrame
      scale={scale}
      tab={TAB[k]}
      live={k === "live"}
      screen={
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={k} className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <Screen k={k} />
          </motion.div>
        </AnimatePresence>
      }
    />
  );

  return (
    <section id="talk" className="relative px-5 pb-24 pt-24 sm:px-8 lg:pb-32 lg:pt-36" style={{ background: "linear-gradient(180deg, transparent 0%, var(--mint-tint) 45%, transparent 100%)" }}>
      <div className="mx-auto max-w-[1240px]">
        <p className="eyebrow text-mint-text">{TALK.eyebrow}</p>
        <AssembleHeadline lines={[TALK.h2]} className="display mt-4 text-[clamp(2.25rem,5vw,4rem)]" />

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-8">
          {/* phone rail */}
          <div className="flex justify-center lg:col-span-5 lg:block">
            <div className="lg:sticky lg:top-[12vh]">
              <div className="flex justify-center" style={{ perspective: 1200 }}>
                <motion.div style={desktop && !reduced ? { rotateY: -8 } : undefined}>
                  {phone(screen, desktop ? 0.92 : 0.8)}
                </motion.div>
              </div>
            </div>
          </div>

          {/* beats */}
          <div ref={beatsRef} className="relative lg:col-span-7">
            <motion.span className="absolute left-0 top-0 hidden h-full w-px origin-top bg-mint-text/40 lg:block" style={{ scaleY: rule }} aria-hidden />
            <div className="lg:pb-[24vh] lg:pl-10">
              {TALK.beats.map((b, i) => (
                <Beat key={b.h3} index={i} active={active === i} dim={desktop} onEnter={setActive}>
                  <div className="flex items-start gap-6">
                    <div className="min-w-0 flex-1">
                      <h3 className="display-sm text-[26px] sm:text-[28px]">{b.h3}</h3>
                      <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-muted">{b.body}</p>
                    </div>
                    {/* mobile thumbnail */}
                    <div className="shrink-0 lg:hidden">
                      <PhoneFrame scale={0.36} tab={i === 2 ? "tasks" : "call"} bare screen={<Screen k={i === 0 ? "live" : i === 1 ? "menu" : "tasks-done"} />} />
                    </div>
                  </div>
                </Beat>
              ))}
            </div>
          </div>
        </div>

        <Reveal className="mt-16 grid grid-cols-2 gap-8 border-t border-line pt-12 sm:grid-cols-4 lg:mt-24">
          {TALK.facts.map((f) => (
            <div key={f.label}>
              <div className="display text-[44px] sm:text-[56px]">{f.value}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{f.label}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
