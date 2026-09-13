"use client";

import { useReducedMotionSafe } from "@/lib/use-media";

import { motion, useInView } from "motion/react";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { CopyButton } from "@/components/copy-button";
import { PROMPT } from "@/content/copy";

type Props = { text: string };

export function TerminalCard({ text }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = useReducedMotionSafe();
  const [flash, setFlash] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");

  const onCopied = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1200);
  };

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[920px]">
    <motion.div
      className="relative w-full overflow-hidden rounded-[16px] border border-line-on-dark bg-terminal-card text-paper-fixed"
      style={{ boxShadow: flash ? "0 0 0 2px var(--mint), 0 30px 80px -30px rgba(0,0,0,0.7)" : "inset 0 1px 0 rgba(245,247,240,0.06), 0 30px 80px -30px rgba(0,0,0,0.7)", transition: "box-shadow 1.2s var(--ease-out)" }}
      initial={false}
      animate={reduced ? { opacity: inView ? 1 : 0 } : { clipPath: inView ? "inset(0% 0% 0% 0% round 16px)" : "inset(100% 0% 0% 0% round 16px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigator.clipboard?.writeText(text).then(onCopied).catch(() => {});
        }
      }}
      aria-label="One-shot install prompt. Press Enter to copy."
    >
      <div className="flex h-11 items-center justify-between gap-3 border-b border-line-on-dark px-4">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line-on-dark" />
            <span className="size-2.5 rounded-full bg-line-on-dark" />
            <span className="size-2.5 rounded-full bg-line-on-dark" />
          </span>
          <span className="hidden items-center gap-2 font-mono text-[12px] text-muted-on-dark sm:flex">
            <Terminal className="size-3.5" aria-hidden /> one-shot-install.prompt · Claude Code or Codex
          </span>
        </div>
        <CopyButton
          text={text}
          label={PROMPT.copy}
          copiedLabel={PROMPT.copied}
          className="bg-surface-on-dark text-paper-fixed hover:bg-paper-fixed/15 data-[copied=true]:bg-mint data-[copied=true]:text-ink-fixed"
          onCopied={onCopied}
        />
      </div>
      <div className="relative">
        <pre
          className="prompt-body overflow-x-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-[1.65] text-paper-fixed/[0.92] transition-[max-height] duration-500 sm:p-6 sm:text-[14px]"
          style={{ userSelect: "all", WebkitUserSelect: "all", maxHeight: expanded ? "none" : 520, overflowY: "hidden" } as CSSProperties}
          data-shown={inView ? "true" : "false"}
        >
          {lines.map((line, i) => (
            <span key={i} className="prompt-line" style={{ "--i": Math.min(i, 40) } as CSSProperties}>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
        {expanded ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32" style={{ background: "linear-gradient(to bottom, rgba(15,26,33,0), var(--terminal-card) 85%)" }} aria-hidden />
        )}
        <div className={`${expanded ? "relative border-t border-line-on-dark" : "absolute inset-x-0 bottom-0"} flex justify-center py-3`}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-on-dark bg-terminal-card px-4 py-1.5 font-mono text-[12px] text-paper-fixed/90 transition-colors hover:bg-surface-on-dark"
          >
            {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            {expanded ? "Collapse" : `Show the whole prompt · ${lines.length} lines`}
          </button>
        </div>
      </div>
      <div className="border-t border-line-on-dark px-4 py-2.5 font-mono text-[12px] text-muted-on-dark">{PROMPT.footer}</div>
    </motion.div>
    </div>
  );
}
