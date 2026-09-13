"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { motion } from "motion/react";
import { Circle } from "lucide-react";
import { GitHubMark } from "@/components/logos";
import { AssembleHeadline } from "@/components/motion/assemble-headline";
import { Reveal } from "@/components/motion/reveal";
import { PRICING } from "@/content/copy";
import { DOC_URLS, RELEASES_URL, REPO_URL } from "@/content/links";

function DrawnCheck({ delay }: { delay: number }) {
  const reduced = useReducedMotionSafe();
  return (
    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-fixed text-mint">
      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path d="M3 8.5l3.2 3L13 4.5" initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.35, delay }} />
      </svg>
    </span>
  );
}

export function PricingSection() {
  const reduced = useReducedMotionSafe();
  const c = PRICING.community;
  const m = PRICING.managed;
  return (
    <section id="pricing" className="relative z-[1] rounded-t-[40px] bg-pricing-ground px-5 pb-24 pt-24 text-ink-fixed sm:px-8 lg:pb-32 lg:pt-36">
      <div className="mx-auto max-w-[1000px] text-center">
        <AssembleHeadline lines={[PRICING.h2]} className="display text-[clamp(2.25rem,5vw,4rem)]" />
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-[60ch] text-[17px] leading-[1.55] text-[#2f4a3a]">{PRICING.sub}</p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 text-left md:grid-cols-2">
          <motion.article
            className="relative overflow-hidden rounded-[28px] border-2 border-ink-fixed bg-white p-7 sm:p-9"
            style={{ boxShadow: "0 24px 60px rgba(20,33,42,0.18)" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, rotateZ: 1 }}
            whileInView={{ opacity: 1, y: 0, rotateZ: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="absolute inset-x-0 top-0 h-1.5 bg-mint" aria-hidden />
            <p className="eyebrow text-[#2f4a3a]">{c.eyebrow}</p>
            <div className="display mt-4 text-[56px]">{c.price}</div>
            <p className="mt-1 text-[15px] text-[#2f4a3a]">{c.priceSub}</p>
            <ul className="mt-7 space-y-3 text-[15px] leading-snug">
              {c.features.map((f, i) => (
                <li key={f} className="flex items-start gap-3">
                  <DrawnCheck delay={0.3 + i * 0.04} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 rounded-[16px] bg-[#f5f7f0] p-4 font-mono text-[12.5px] leading-relaxed">
              <div className="caption mb-1.5 text-[10px] text-[#2f4a3a]">You bring</div>
              <ul className="space-y-0.5">{c.youBring.map((b) => <li key={b}>· {b}</li>)}</ul>
              <div className="caption mb-1 mt-3 text-[10px] text-[#2f4a3a]">What you pay for elsewhere</div>
              <div className="text-[#5b6a72]">{c.elsewhere}</div>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={REPO_URL} target="_blank" rel="noopener" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink-fixed px-5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
                <GitHubMark className="size-4" /> {c.cta}
              </a>
              <a href={DOC_URLS.diyIphone} target="_blank" rel="noopener" className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[rgba(20,33,42,0.3)] px-5 text-[15px] font-semibold transition-colors hover:bg-[#f5f7f0]">
                {c.cta2}
              </a>
            </div>
          </motion.article>

          <motion.article
            className="relative rounded-[28px] border-[1.5px] border-dashed border-ink-fixed/50 p-7 sm:p-9"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <motion.span
              className="absolute right-6 top-6 rounded-full bg-ink-fixed px-3 py-1 font-mono text-[12px] font-semibold text-mint"
              initial={reduced ? false : { scale: 1 }}
              whileInView={reduced ? undefined : { scale: [1, 1.04, 1] }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.9 }}
            >
              {m.badge}
            </motion.span>
            <div className="opacity-85">
              <p className="eyebrow text-[#2f4a3a]">{m.eyebrow}</p>
              <div className="display mt-4 text-[34px]">{m.title}</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="display text-[56px] opacity-30">—</span>
                <span className="font-mono text-[12px] text-[#2f4a3a]">{m.priceSub}</span>
              </div>
              <p className="mt-4 text-[15px] leading-[1.55] text-[#2f4a3a]">{m.body}</p>
              <ul className="mt-6 space-y-3 text-[15px]">
                {m.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <Circle className="size-4 shrink-0 opacity-60" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <a href={RELEASES_URL} target="_blank" rel="noopener" className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(20,33,42,0.4)] px-5 text-[15px] font-semibold transition-colors hover:bg-white/60">
                  {m.cta}
                </a>
              </div>
              <p className="mt-5 text-[13px] text-[#2f4a3a]">{m.small}</p>
            </div>
          </motion.article>
        </div>

        <p className="mt-10 font-mono text-[13px] text-[#2f4a3a]">{PRICING.under}</p>
      </div>
    </section>
  );
}
