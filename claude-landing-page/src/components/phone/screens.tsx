"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCircle2, ChevronsUpDown, Clock, MessageSquareMore, Phone, PhoneOff, Sun, Trophy, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { HarnessLogo } from "@/components/harness-logo";
import { Waveform } from "@/components/phone/waveform";
import { CountUp } from "@/components/motion/count-up";
import { BRAND, type Rotation } from "@/content/copy";
import type { HarnessKind } from "@/lib/harnesses";
import type { WaveMode } from "@/components/hero/use-hero-loop";

const CARD = "rounded-[22px] bg-white p-4 text-left";

function Wordmark() {
  return <div className="font-display text-[22px] font-extrabold tracking-[-0.04em]">telegate</div>;
}

/* ---------------------------------------------------------------- CallIdle */

export function CallIdle({ picker, kind, pressed = false, menuOpen = false }: { picker: string; kind: HarnessKind; pressed?: boolean; menuOpen?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-5 pt-2">
        <Wordmark />
        <div className="caption flex items-center gap-2 text-[#5b6a72]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#9aa7ad]" /> Voice delegation
        </div>
        <h2 className="font-display text-[27px] font-extrabold leading-[1.0] tracking-[-0.03em]">
          Talk it through.
          <br />
          Get your day back.
        </h2>
        <p className="text-[12px] leading-snug text-[#5b6a72]">Your connected computer does the work. Come back to Tasks for the result.</p>
        <div className={`relative ${CARD}`}>
          <div className="caption text-[#5b6a72]">Send work to</div>
          <div className="mt-2 flex items-center gap-2 text-[14px] font-semibold">
            <HarnessLogo kind={kind} className="size-4" />
            <span className="truncate">{picker}</span>
            <ChevronsUpDown className="ml-auto size-4 text-[#5b6a72]" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#2e7a1f]">
            <CheckCircle2 className="size-3.5" /> Online · ready for work
          </div>
          {menuOpen ? <DestinationMenu /> : null}
        </div>
        {menuOpen ? null : (
          <p className="text-[13px] italic leading-snug text-[#5b6a72]">“Ask Codex on my Mac mini to improve the mobile layout.”</p>
        )}
      </div>
      <div className="shrink-0 px-4 pb-2 pt-1">
        <p className="mb-1.5 text-center text-[11px] text-[#5b6a72]">Ending a call keeps submitted work running.</p>
        <div
          className="flex h-[64px] items-center justify-center gap-3 rounded-[24px] bg-mint font-display text-[21px] font-extrabold text-ink-fixed transition-transform duration-200"
          style={{ transform: pressed ? "scale(0.96)" : "scale(1)" }}
        >
          <Phone className="size-6" strokeWidth={2.6} /> Start talking
          {pressed ? <span className="pointer-events-none absolute inset-x-4 bottom-3 h-[76px] rounded-[28px] ring-2 ring-mint/70" /> : null}
        </div>
      </div>
    </div>
  );
}

const DESTINATIONS: { kind: HarnessKind; label: string; online: boolean; active?: boolean }[] = [
  { kind: "claude", label: "Claude Code · Mac mini", online: true, active: true },
  { kind: "codex", label: "Codex · Mac mini", online: true },
  { kind: "openclaw", label: "OpenClaw · studio-vps", online: true },
  { kind: "hermes", label: "Hermes Agent · studio-vps", online: false },
  { kind: "grokbot", label: "Grok Bot · Mac mini", online: true },
  { kind: "homies", label: "Homies · endpoint", online: true },
];

function DestinationMenu() {
  return (
    <div className="absolute inset-x-2 top-[52px] z-10 rounded-[16px] bg-white p-1.5 text-[13px] shadow-[0_18px_40px_-12px_rgba(20,33,42,0.35)] ring-1 ring-[rgba(20,33,42,0.08)]">
      {DESTINATIONS.map((d) => (
        <div key={d.label} className={`flex items-center gap-2 rounded-[10px] px-2.5 py-2 ${d.active ? "bg-[rgba(173,242,143,0.35)]" : ""}`}>
          <HarnessLogo kind={d.kind} className="size-4 shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{d.label}</div>
            <div className={`text-[10.5px] ${d.online ? "text-[#2e7a1f]" : "text-[#5b6a72]"}`}>{d.online ? "Online · ready for work" : "Offline · work waits in its queue"}</div>
          </div>
          {d.active ? <Check className="ml-auto size-4 shrink-0" /> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- CallLive */

export type CallLiveProps = {
  rotation: Rotation;
  elapsed: number;
  amp: number;
  mode: WaveMode;
  typed: number;
  showBrief: boolean;
  showReply: boolean;
  showSent: boolean;
  clearing: boolean;
  bars?: number;
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CallLive({ rotation, elapsed, amp, mode, typed, showBrief, showReply, showSent, clearing, bars = 28 }: CallLiveProps) {
  const reduced = useReducedMotionSafe();
  const words = rotation.you.split(" ");
  const visible = !clearing;
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden px-5 pt-2">
        <div className="flex items-center justify-between">
          <div className="caption flex items-center gap-2 text-[#2e7a1f]">
            <span className="breathe inline-block h-2 w-2 rounded-full bg-[#2e7a1f]" /> Voice connected
          </div>
          <span className="tabular text-[13px] font-semibold text-[#5b6a72]">{fmt(elapsed)}</span>
        </div>
        <h2 className="font-display text-[27px] font-extrabold leading-[1.0] tracking-[-0.03em]">I’m listening.</h2>
        <Waveform amp={amp} mode={mode} bars={bars} className="!h-9" />
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold">
          <span className="caption text-[#5b6a72]">To</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={rotation.picker}
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <HarnessLogo kind={rotation.kind} className="size-3.5" /> {rotation.picker}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="space-y-2.5">
          <AnimatePresence>
            {typed > 0 && visible ? (
              <motion.div
                key={`you-${rotation.kind}`}
                className="rounded-[16px] bg-white p-3.5"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.45 } }}
                transition={{ duration: 0.3 }}
              >
                <div className="caption mb-1 text-[10px] text-[#5b6a72]">You</div>
                <p className="text-[14px] leading-snug">
                  {words.slice(0, typed).map((w, i) => (
                    <motion.span key={i} className="inline" initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                      {w}{i < words.length - 1 ? " " : ""}
                    </motion.span>
                  ))}
                </p>
              </motion.div>
            ) : null}
            {showBrief && visible ? (
              <motion.div key="brief" className="flex items-center gap-2 px-1 text-[12px] text-[#5b6a72]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <MessageSquareMore className="size-3.5" /> Preparing your brief…
              </motion.div>
            ) : null}
            {showReply && visible ? (
              <motion.div
                key={`reply-${rotation.kind}`}
                className="rounded-[16px] bg-[rgba(173,242,143,0.3)] p-3.5"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, transition: { duration: 0.45 } }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <div className="caption mb-1 text-[10px] text-[#5b6a72]">Telegate</div>
                <p className="flex items-center gap-2 text-[14px] font-semibold">
                  <motion.span initial={reduced ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }} className="inline-flex">
                    <HarnessLogo kind={rotation.kind} className="size-4" />
                  </motion.span>
                  {rotation.reply}
                </p>
              </motion.div>
            ) : null}
            {showSent && visible ? (
              <motion.div key="sent" className="flex items-center gap-1.5 px-1 text-[12px] font-medium text-[#2e7a1f]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <CheckCircle2 className="size-3.5" /> {rotation.sent}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <div className="shrink-0 px-4 pb-2 pt-1">
        <p className="mb-1.5 text-center text-[11px] text-[#5b6a72]">Ending a call keeps submitted work running.</p>
        <div className="flex h-[64px] items-center justify-center gap-3 rounded-[24px] bg-end-call font-display text-[21px] font-extrabold text-white">
          <PhoneOff className="size-6" strokeWidth={2.6} /> End call
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tasks */

export function TasksScreen({ state }: { state: "working" | "completed" }) {
  return (
    <div className="space-y-4 px-5 pt-3">
      <h2 className="font-display text-[30px] font-extrabold tracking-[-0.03em]">Tasks</h2>
      <div className="rounded-[20px] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-semibold">Improve the mobile layout</div>
          {state === "working" ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[rgba(173,242,143,0.35)] px-2.5 py-1 text-[11px] font-semibold">
              <span className="breathe inline-block h-1.5 w-1.5 rounded-full bg-[#2e7a1f]" /> Working
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-ink-fixed">
              <Check className="size-3" strokeWidth={3} /> Completed
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[#5b6a72]">
          <HarnessLogo kind="codex" className="size-3.5" /> Codex · Mac mini
          <span className="ml-auto flex items-center gap-1 tabular"><Clock className="size-3" /> {state === "working" ? "00:04:12" : "2h 14m"}</span>
        </div>
        {state === "working" ? (
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[rgba(20,33,42,0.08)]">
            <motion.div className="h-full bg-mint" initial={{ width: "12%" }} animate={{ width: "64%" }} transition={{ duration: 1.4, ease: "easeOut" }} />
          </div>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-snug text-[#5b6a72]">Rebuilt the call screen for narrow widths, fixed the overflowing picker and added a test. Branch: mobile-layout.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <span className="rounded-full border border-[rgba(20,33,42,0.2)] py-2 text-center text-[12px] font-semibold">Read it to me</span>
              <span className="rounded-full border border-[rgba(20,33,42,0.2)] py-2 text-center text-[12px] font-semibold">Continue by voice</span>
            </div>
            <p className="mt-2 text-[11px] text-[#5b6a72]">Opening a result never submits a job by itself.</p>
          </>
        )}
      </div>
      <div className="rounded-[20px] bg-white p-4 opacity-70">
        <div className="text-[15px] font-semibold">Draft the release notes</div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[#5b6a72]">
          <HarnessLogo kind="openclaw" className="size-3.5" /> OpenClaw · studio-vps
          <span className="ml-auto rounded-full bg-[rgba(20,33,42,0.06)] px-2 py-0.5 text-[11px]">Queued</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Dashboard */

export function DashboardScreen({ animateNumber = true }: { animateNumber?: boolean }) {
  return (
    <div className="space-y-3 px-5 pt-3">
      <div className="caption text-[10px] tracking-[0.12em]">More life. Less screen.</div>
      <h2 className="font-display text-[28px] font-extrabold leading-[1.0] tracking-[-0.03em]">
        Get work done.
        <br />
        Get your day back.
      </h2>
      <p className="text-[13px] text-[#5b6a72]">{BRAND.supporting}</p>
      <div className="flex h-[52px] items-center justify-center gap-2 rounded-[20px] bg-ink-fixed text-[15px] font-bold text-white">
        <Phone className="size-4" /> Start a voice chat
      </div>
      <div className="grid grid-cols-2 rounded-[10px] bg-[rgba(20,33,42,0.08)] p-[3px] text-[12px] font-semibold">
        <span className="rounded-[8px] bg-white py-1 text-center">All time</span>
        <span className="py-1 text-center text-[#5b6a72]">Last 7 days</span>
      </div>
      <div className="rounded-[22px] bg-mint p-4">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Sun className="size-4" /> Estimated screen time saved</div>
        <div className="font-display text-[52px] font-extrabold leading-none tracking-[-0.03em]">
          {animateNumber ? <CountUp to={12.5} decimals={1} duration={1.4} /> : <span className="tabular">12.5</span>}
        </div>
        <div className="text-[15px]">hours for the rest of your life</div>
        <p className="mt-2 text-[11px] leading-snug text-[rgba(20,33,42,0.8)]">
          <strong>Sample data</strong> · 25 completed tasks × your 30-minute estimate. This is an estimate of hands-on work avoided, not measured time away.
        </p>
      </div>
      <div className="rounded-[20px] bg-white p-4">
        <div className="caption text-[10px]">Lifetime milestones</div>
        <div className="mt-1 text-[14px] font-bold">Next milestone: 50 tasks handled.</div>
        <div className="mt-2 h-[4px] rounded-full bg-[rgba(20,33,42,0.08)]"><div className="h-full w-1/2 rounded-full bg-ink-fixed" /></div>
      </div>
      <div className="flex items-center gap-3 rounded-[20px] bg-white p-4">
        <Trophy className="size-5" />
        <div className="min-w-0">
          <div className="text-[13px] font-bold">The away-from-desk leaderboard</div>
          <div className="text-[11px] text-[#5b6a72]">An optional community. Your work stays private.</div>
        </div>
        <ChevronRight className="ml-auto size-4 text-[#5b6a72]" />
      </div>
    </div>
  );
}

export const screenStyle: CSSProperties = {};
