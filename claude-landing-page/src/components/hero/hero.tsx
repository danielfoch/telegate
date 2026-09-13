"use client";

import { AnimatePresence, motion, useInView, useMotionTemplate, useScroll, useSpring, useTransform } from "motion/react";
import { Pause, Phone, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssembleHeadline } from "@/components/motion/assemble-headline";
import { PhoneFrame } from "@/components/phone/phone-frame";
import { CallIdle, CallLive } from "@/components/phone/screens";
import { WaveArcs } from "@/components/hero/wave-arcs";
import { useHeroLoop } from "@/components/hero/use-hero-loop";
import { HERO, ROTATION } from "@/content/copy";
import { useIsDesktop, usePointerFine, useReducedMotionSafe } from "@/lib/use-media";
import { usePointerTilt } from "@/lib/use-pointer-tilt";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const wrapperRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneColRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSafe();
  const desktop = useIsDesktop();
  const pointerFine = usePointerFine();
  const inView = useInView(wrapperRef, { amount: 0.25 });
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);

  const loop = useHeroLoop({ paused: userPaused || !inView, reduced });
  const rotation = ROTATION[loop.index];

  /* ---------- scroll scrub (desktop only) ---------- */
  const { scrollYProgress: p } = useScroll({ target: wrapperRef, offset: ["start start", "end end"] });
  const shiftRef = useRef(0);
  const vwRef = useRef(1200);
  const vhRef = useRef(800);
  useEffect(() => {
    const measure = () => {
      vwRef.current = window.innerWidth;
      vhRef.current = window.innerHeight;
      const col = phoneColRef.current;
      if (col) {
        const r = col.getBoundingClientRect();
        shiftRef.current = window.innerWidth / 2 - (r.left + r.width / 2);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [desktop]);

  const lerp = (v: number, a: number, b: number, c: number, d: number) => (v <= a ? c : v >= b ? d : c + ((v - a) / (b - a)) * (d - c));

  const copyY = useTransform(p, (v) => lerp(v, 0, 0.3, 0, -56));
  const copyOpacity = useTransform(p, (v) => lerp(v, 0.05, 0.35, 1, 0));
  const phoneX = useTransform(p, (v) => (v < 0.6 ? lerp(v, 0.1, 0.45, 0, shiftRef.current) : lerp(v, 0.6, 1, shiftRef.current, shiftRef.current + vwRef.current * 0.34)));
  const phoneY = useTransform(p, (v) => lerp(v, 0.6, 1, 0, vhRef.current * 0.38));
  const phoneScale = useTransform(p, (v) => (v < 0.6 ? lerp(v, 0.1, 0.45, 1, 1.12) : lerp(v, 0.6, 1, 1.12, 0.42)));
  const scrollRotY = useTransform(p, (v) => lerp(v, 0.1, 0.45, 14, 0));
  const phoneRotZ = useTransform(p, (v) => lerp(v, 0.6, 1, 0, -6));
  const phoneOpacity = useTransform(p, (v) => lerp(v, 0.85, 1, 1, 0));
  const glowScale = useTransform(p, (v) => lerp(v, 0.1, 0.45, 1, 0.55));
  const dotOpacity = useTransform(p, (v) => lerp(v, 0.1, 0.4, 1, 0));
  const captionOpacity = useTransform(p, (v) => (v < 0.85 ? lerp(v, 0.45, 0.6, 0, 1) : lerp(v, 0.85, 0.97, 1, 0)));

  /* ---------- pointer tilt ---------- */
  const tilt = usePointerTilt(pointerFine && desktop && !reduced);
  const rotateY = useTransform([scrollRotY, tilt.rotateY], ([a, b]) => (a as number) + (b as number));
  const sheenX = useTransform(tilt.shiftX, (v) => v * 40);
  const glowX = useTransform(tilt.shiftX, (v) => v * -4);
  const glowY = useTransform(tilt.shiftY, (v) => v * -4);
  const glowTransform = useMotionTemplate`translate(${glowX}%, ${glowY}%)`;
  const dotX = useSpring(useTransform(tilt.shiftX, (v) => v * 18), { stiffness: 80, damping: 16 });

  const scrub = desktop && !reduced;
  const amp = hover && loop.mode === "idle" ? Math.max(loop.amp, 0.35) : loop.amp;

  return (
    <section
      id="hero"
      ref={wrapperRef}
      className="relative lg:h-[200svh]"
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <div ref={stageRef} className="relative min-h-[100svh] overflow-hidden lg:sticky lg:top-0 lg:h-[100svh]">
        {/* soft radial ground glow */}
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60% 50% at 70% 45%, var(--glow) 0%, transparent 70%)", opacity: 0.6 }} />

        <div className="mx-auto grid h-full max-w-[1240px] grid-cols-1 items-center gap-10 px-5 pb-0 pt-28 sm:px-8 lg:grid-cols-12 lg:gap-6 lg:pt-16">
          {/* copy */}
          <motion.div className="relative z-10 lg:col-span-6" style={scrub ? { y: copyY, opacity: copyOpacity } : undefined}>
            <motion.p className="eyebrow text-mint-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
              {HERO.eyebrow}
            </motion.p>
            <AssembleHeadline as="h1" lines={[...HERO.h1]} onMount className="display mt-5 text-[clamp(2.9rem,8vw,6.5rem)]" />
            <AssembleHeadline as="p" lines={[HERO.sub]} onMount delay={0.45} className="display-sm mt-5 text-[clamp(1.25rem,2vw,1.75rem)] text-mint-text" />
            <motion.p className="mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-muted" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6, ease: EASE }}>
              {HERO.body}
            </motion.p>
            <motion.div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.6, ease: EASE }}>
              <a href="#install" className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-mint px-7 font-display text-[18px] font-extrabold text-ink-fixed transition-transform hover:scale-[1.03] active:scale-[0.97]">
                <Phone className="size-5" strokeWidth={2.6} /> {HERO.primary}
              </a>
              <a href="#talk" className="inline-flex h-14 items-center justify-center rounded-full border border-line px-6 text-[16px] font-semibold text-ink transition-colors hover:bg-surface-2">
                {HERO.secondary}
              </a>
            </motion.div>
            <motion.p className="mt-5 font-mono text-[12px] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.5 }}>
              {HERO.caption}
            </motion.p>
          </motion.div>

          {/* phone column */}
          <div ref={phoneColRef} className="relative flex justify-center lg:col-span-6 lg:h-[100svh] lg:items-center" style={{ perspective: 1200 }}>
            <div className="relative h-[520px] w-[240px] lg:h-[650px] lg:w-[300px]">
              {/* arcs + dot live in a 600-wide box centred on the phone */}
              <motion.div className="pointer-events-none absolute left-1/2 top-0 h-[650px] w-[600px] -translate-x-1/2 origin-top scale-[0.8] lg:scale-100" style={scrub ? { opacity: dotOpacity } : undefined}>
                <WaveArcs arcs={loop.arcs} />
                <motion.span
                  className="absolute left-[70px] top-[300px] block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint shadow-[0_0_0_6px_var(--mint-soft)]"
                  style={{ x: dotX, scale: loop.arcs === "back" ? 1.35 : 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  aria-hidden
                />
              </motion.div>

              {/* glow */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(circle, var(--glow) 0%, transparent 62%)", scale: scrub ? glowScale : 1, transform: glowTransform }}
                animate={loop.mode === "speak" ? { scale: [1, 1.06, 1] } : {}}
                transition={loop.mode === "speak" ? { duration: 0.9, repeat: Infinity } : {}}
              />

              {/* phone */}
              <motion.div
                className={`relative ${desktop ? "" : "float-idle"}`}
                style={scrub ? { x: phoneX, y: phoneY, scale: phoneScale, rotateY, rotateX: tilt.rotateX, rotateZ: phoneRotZ, opacity: phoneOpacity, transformStyle: "preserve-3d" } : undefined}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 48, rotateY: 18 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotateY: 14 }}
                transition={{ type: "spring", stiffness: 160, damping: 24, delay: 0.3 }}
                onPointerEnter={() => setHover(true)}
                onPointerLeave={() => setHover(false)}
              >
                <div className="scale-[0.8] origin-top lg:scale-100">
                  <PhoneFrame
                    live={loop.screen === "live"}
                    tab="call"
                    sheen
                    screen={
                      <AnimatePresence mode="wait" initial={false}>
                        {loop.screen === "idle" ? (
                          <motion.div key="idle" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <CallIdle picker={ROTATION[0].picker} kind={ROTATION[0].kind} pressed={loop.pressed} />
                          </motion.div>
                        ) : (
                          <motion.div key="live" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <CallLive
                              rotation={rotation}
                              elapsed={loop.elapsed}
                              amp={amp}
                              mode={loop.mode}
                              typed={loop.typed}
                              showBrief={loop.showBrief}
                              showReply={loop.showReply}
                              showSent={loop.showSent}
                              clearing={loop.clearing}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    }
                  />
                </div>
                {pointerFine ? (
                  <motion.div className="sheen pointer-events-none absolute inset-0 rounded-[54px] opacity-60" style={{ x: sheenX }} />
                ) : null}
              </motion.div>

              <button
                type="button"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? "Play demo" : "Pause demo"}
                aria-pressed={userPaused}
                className="absolute -right-2 bottom-2 z-20 inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface/80 text-ink transition-colors hover:bg-surface lg:-right-14 lg:bottom-6"
              >
                {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {scrub ? (
          <motion.p className="eyebrow pointer-events-none absolute inset-x-0 top-[18vh] text-center text-muted" style={{ opacity: captionOpacity }}>
            {HERO.scrubCaption}
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}
