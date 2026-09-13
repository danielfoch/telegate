"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { Star } from "lucide-react";
import { GitHubMark } from "@/components/logos";
import { REPO_URL } from "@/content/links";

type Props = { stars: number | null; starsLabel: string | null };

export function Nav({ stars, starsLabel }: Props) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-16 transition-[background-color,box-shadow] duration-300"
      style={{
        color: "var(--nav-ink, var(--ink))",
        background: scrolled ? "var(--nav-ground)" : "transparent",
        boxShadow: scrolled ? "0 1px 0 var(--nav-line, var(--line))" : "none",
      }}
    >
      <nav className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-5 sm:px-8" aria-label="Primary">
        <a href="#hero" className="flex items-center gap-2.5" aria-label="Telegate home">
          <Image src="/brand/telegate-icon.png" alt="" width={28} height={28} className="rounded-[8px]" priority />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.04em]">telegate</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="hidden items-center gap-6 text-[14px] font-medium md:flex">
            <a href="#talk" className="opacity-80 transition-opacity hover:opacity-100">How it works</a>
            <a href="#install" className="opacity-80 transition-opacity hover:opacity-100">Install</a>
            <a href="#pricing" className="opacity-80 transition-opacity hover:opacity-100">Pricing</a>
            <a href={REPO_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 opacity-80 transition-opacity hover:opacity-100">
              <GitHubMark className="size-4" />
              GitHub
              {stars !== null && starsLabel ? (
                <span className="ml-0.5 flex items-center gap-1 rounded-full border border-current/20 px-2 py-0.5 font-mono text-[12px]">
                  <Star className="size-3" aria-hidden /> {starsLabel}
                </span>
              ) : null}
            </a>
          </div>
          <a
            href="#install"
            className="inline-flex h-9 items-center rounded-full bg-mint px-4 text-[14px] font-bold text-ink-fixed transition-transform hover:scale-[1.03] active:scale-[0.97]"
          >
            Install
          </a>
        </div>
      </nav>
    </header>
  );
}
