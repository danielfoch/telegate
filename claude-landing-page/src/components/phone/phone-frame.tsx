"use client";

import type { CSSProperties, ReactNode } from "react";
import { Laptop, ListChecks, Phone, SlidersHorizontal, Sun } from "lucide-react";

export type PhoneTab = "dashboard" | "call" | "computers" | "tasks" | "settings";

type Props = {
  scale?: number;
  screen: ReactNode;
  live?: boolean;
  tab?: PhoneTab;
  className?: string;
  style?: CSSProperties;
  /** hide the tab bar (e.g. tiny diagram nodes) */
  bare?: boolean;
  sheen?: boolean;
};

const W = 300;
const H = 650;

const TABS: { id: PhoneTab; label: string; Icon: typeof Sun }[] = [
  { id: "dashboard", label: "Dashboard", Icon: Sun },
  { id: "call", label: "Call", Icon: Phone },
  { id: "computers", label: "Computers", Icon: Laptop },
  { id: "tasks", label: "Tasks", Icon: ListChecks },
  { id: "settings", label: "Settings", Icon: SlidersHorizontal },
];

/**
 * A 300×650 iPhone drawn in DOM + CSS, scaled by `scale` without reflowing the
 * screen. The screen always renders in the app's own paper/ink/mint.
 */
export function PhoneFrame({ scale = 1, screen, live = false, tab = "call", className = "", style, bare = false, sheen = false }: Props) {
  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width: W * scale, height: H * scale, ...style }}
      aria-hidden
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: W, height: H, transform: `scale(${scale})` }}
      >
        {/* shell */}
        <div
          className="relative h-full w-full rounded-[54px] bg-bezel p-[5px]"
          style={{ boxShadow: "0 30px 80px -20px rgba(20,33,42,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          {/* hardware */}
          <span className="absolute -left-[3px] top-[118px] h-6 w-[3px] rounded-l bg-[#5e7d55]" title="Action Button" />
          <span className="absolute -left-[3px] top-[168px] h-[46px] w-[3px] rounded-l bg-[#0b1419]" />
          <span className="absolute -left-[3px] top-[224px] h-[46px] w-[3px] rounded-l bg-[#0b1419]" />
          <span className="absolute -right-[3px] top-[190px] h-[74px] w-[3px] rounded-r bg-[#0b1419]" />

          <div className="h-full w-full rounded-[49px] p-px" style={{ background: "#0b1419" }}>
            <div className="relative h-full w-full overflow-hidden rounded-[48px] bg-paper-fixed text-ink-fixed" style={{ contain: "layout paint" }}>
              {/* status bar */}
              <div className="absolute inset-x-0 top-0 z-20 flex h-[54px] items-end justify-between px-7 pb-2 text-[14px] font-semibold">
                <span className="tabular">9:41</span>
                <span className="flex items-center gap-1.5">
                  <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.8" /><rect x="4.5" y="5" width="3" height="6" rx="0.8" /><rect x="9" y="2.5" width="3" height="8.5" rx="0.8" /><rect x="13.5" y="0" width="3" height="11" rx="0.8" /></svg>
                  <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 9.2a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm0-3.4c1.6 0 3 .6 4.1 1.6l-1.4 1.4a3.9 3.9 0 00-5.4 0L3.4 7.4A5.8 5.8 0 017.5 5.8zm0-3.4c2.5 0 4.8 1 6.5 2.6L12.6 6.4a7.3 7.3 0 00-10.2 0L1 5A9.2 9.2 0 017.5 2.4z" /></svg>
                  <svg width="25" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="21" height="11" rx="3" strokeOpacity="0.4" /><rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor" stroke="none" /><path d="M23 4v4" strokeOpacity="0.4" strokeLinecap="round" /></svg>
                </span>
              </div>
              {/* dynamic island */}
              <div className="absolute left-1/2 top-3 z-20 flex h-[34px] w-[112px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-3">
                {live ? <span className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#34c759]" /> : null}
                <span className="h-1.5 w-1.5 rounded-full bg-[#2a2f36]" />
              </div>

              {/* screen content */}
              <div className={`absolute inset-x-0 top-[54px] ${bare ? "bottom-0" : "bottom-[74px]"} overflow-hidden`}>{screen}</div>

              {/* tab bar */}
              {bare ? null : (
                <div className="absolute inset-x-0 bottom-0 z-20 h-[74px] border-t border-[rgba(20,33,42,0.12)] bg-[rgba(255,255,255,0.92)] pt-2">
                  <div className="grid grid-cols-5">
                    {TABS.map(({ id, label, Icon }) => (
                      <div key={id} className={`flex flex-col items-center gap-0.5 ${tab === id ? "text-ink-fixed" : "text-[#5b6a72]"}`}>
                        <Icon className="size-[22px]" strokeWidth={tab === id ? 2.4 : 1.9} />
                        <span className="text-[10px] font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* home indicator */}
              <div className="absolute bottom-2 left-1/2 z-30 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-[rgba(20,33,42,0.35)]" />
              {sheen ? <div className="sheen pointer-events-none absolute inset-0 z-30" /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
