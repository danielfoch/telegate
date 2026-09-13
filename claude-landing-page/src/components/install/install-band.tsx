"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { motion } from "motion/react";
import { ArrowUpRight, Info } from "lucide-react";
import { AssembleHeadline } from "@/components/motion/assemble-headline";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { CopyButton } from "@/components/copy-button";
import { INSTALL } from "@/content/copy";
import { INSTALL_URL } from "@/content/links";

const EASE = [0.16, 1, 0.3, 1] as const;

function MegaPill() {
  const reduced = useReducedMotionSafe();
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[720px]">
      {/* one-time glow pulse behind the pill */}
      {reduced ? null : (
        <motion.div
          className="pointer-events-none absolute -inset-10 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(173,242,143,0.45), transparent)" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: [0, 0.6, 0.25] }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: 0.8, duration: 1.4, times: [0, 0.4, 1] }}
        />
      )}
      <motion.a
        href={INSTALL_URL}
        target="_blank"
        rel="noopener"
        className="group relative flex h-16 w-full items-center justify-center gap-3 rounded-full font-display text-[20px] font-extrabold sm:h-[84px] sm:text-[24px]"
        initial={reduced ? { backgroundColor: "rgba(173,242,143,1)", color: "#14212a" } : { backgroundColor: "rgba(173,242,143,0)", color: "#f5f7f0" }}
        whileInView={{ backgroundColor: "rgba(173,242,143,1)", color: "#14212a" }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ delay: reduced ? 0 : 0.8, duration: 0.25 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {reduced ? null : (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" fill="none" aria-hidden>
            <motion.rect
              x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="999"
              stroke="var(--mint)" strokeWidth="2" pathLength={1}
              initial={{ pathLength: 0, opacity: 1 }}
              whileInView={{ pathLength: 1, opacity: [1, 1, 0] }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ pathLength: { duration: 0.8, ease: EASE }, opacity: { delay: 0.8, duration: 0.6, times: [0, 0.5, 1] } }}
            />
          </svg>
        )}
        <span>{INSTALL.pill}</span>
        <ArrowUpRight className="size-6 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.6} />
      </motion.a>
    </div>
  );
}

export function InstallBand() {
  return (
    <section
      id="install"
      className="relative z-[1] -mt-16 rounded-t-[40px] bg-terminal px-5 pb-20 pt-24 text-paper-fixed sm:px-8 sm:pt-32 lg:-mt-[24svh] lg:pb-24 lg:pt-40"
      style={{ boxShadow: "0 -30px 80px -40px rgba(0,0,0,0.6)" }}
    >
      <div className="mx-auto max-w-[880px] text-center">
        <AssembleHeadline lines={[INSTALL.h2]} className="display text-[clamp(2.25rem,5vw,4rem)]" />
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-[1.55] text-muted-on-dark">{INSTALL.sub}</p>
        </Reveal>

        <Reveal delay={0.25} className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {INSTALL.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="display text-[48px] sm:text-[56px]">
                <CountUp to={s.value} prefix={"prefix" in s ? s.prefix : ""} countDown={"countDown" in s ? s.countDown : false} />
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-on-dark">{s.label}</div>
            </div>
          ))}
        </Reveal>

        <MegaPill />

        <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {INSTALL.chips.map((c) => (
            <span key={c} className="rounded-full border border-line-on-dark bg-surface-on-dark px-3 py-1.5 font-mono text-[13px] text-paper-fixed/90">{c}</span>
          ))}
        </Reveal>

        <Reveal delay={0.18} className="mx-auto mt-6 flex w-full max-w-[560px] items-center justify-between gap-3 rounded-full border border-line-on-dark bg-terminal-card py-2 pl-5 pr-2">
          <code className="truncate font-mono text-[13px] text-paper-fixed/90 sm:text-[14px]">{INSTALL.clone}</code>
          <CopyButton text={INSTALL.clone} label="Copy" className="shrink-0 bg-surface-on-dark text-paper-fixed hover:bg-paper-fixed/15 data-[copied=true]:bg-mint data-[copied=true]:text-ink-fixed" />
        </Reveal>

        <Reveal delay={0.24} className="mx-auto mt-8 flex max-w-[640px] items-start justify-center gap-2 text-left text-[14px] leading-snug text-muted-on-dark">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold text-paper-fixed/90">{INSTALL.disclosure}</strong> {INSTALL.disclosureSub}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
