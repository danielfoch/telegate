"use client";

import { motion } from "motion/react";
import { Globe, Laptop, Lock } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { HarnessLogo } from "@/components/harness-logo";
import { LEAVES } from "@/components/tree/leaves";

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  viewBox: string;
  phone: Box;
  relay: Box;
  computer: Box;
  twin?: Box;
  leaves: Box[];
  e1: string;
  e2: string;
  e2b?: string;
  stem: string;
  trunk: string;
  branches: string[];
  routes: string[];
  groupLabels: { text: string; x: number; y: number }[];
  e1Label: { x: number; y: number };
  stemLabel: { x: number; y: number };
};

function desktopLayout(): Layout {
  const leaves = Array.from({ length: 7 }, (_, i) => ({ x: 860, y: 90 + i * 80 - 32, w: 200, h: 64 }));
  return {
    viewBox: "0 0 1200 660",
    phone: { x: 38, y: 239, w: 84, h: 182 },
    relay: { x: 260, y: 282, w: 200, h: 96 },
    computer: { x: 540, y: 252, w: 200, h: 96 },
    twin: { x: 540, y: 372, w: 200, h: 96 },
    leaves,
    e1: "M122 330 H260",
    e2: "M460 330 H500 V300 H540",
    e2b: "M460 330 H500 V420 H540",
    stem: "M740 300 H820",
    trunk: "M820 90 V570",
    branches: leaves.map((l) => `M820 ${l.y + 32} H860`),
    routes: leaves.map((l) => `M122 330 H260 H460 H500 V300 H540 H740 H820 V${l.y + 32} H860`),
    groupLabels: [
      { text: "RUNS LOCALLY", x: 860, y: 44 },
      { text: "OVER HTTPS", x: 860, y: 374 },
    ],
    e1Label: { x: 191, y: 320 },
    stemLabel: { x: 640, y: 238 },
  };
}

function mobileLayout(): Layout {
  const leaves = Array.from({ length: 7 }, (_, i) => ({ x: 70, y: 464 + i * 66 - 26, w: 285, h: 52 }));
  return {
    viewBox: "0 0 375 900",
    phone: { x: 157, y: 15, w: 60, h: 130 },
    relay: { x: 60, y: 190, w: 255, h: 72 },
    computer: { x: 60, y: 300, w: 255, h: 72 },
    leaves,
    e1: "M187 145 V190",
    e2: "M187 262 V300",
    stem: "M187 372 V400 H40",
    trunk: "M40 400 V860",
    branches: leaves.map((l) => `M40 ${l.y + 26} H70`),
    routes: leaves.map((l) => `M187 145 V190 V262 V300 V372 V400 H40 V${l.y + 26} H70`),
    groupLabels: [
      { text: "RUNS LOCALLY", x: 70, y: 428 },
      { text: "OVER HTTPS", x: 70, y: 699 },
    ],
    e1Label: { x: 196, y: 172 },
    stemLabel: { x: 60, y: 394 },
  };
}

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  vertical?: boolean;
  active: number;
  cycle: number;
  arrived: boolean;
  returned: boolean;
  onSelect: (i: number) => void;
  reduced: boolean;
  running: boolean;
  id: string;
};

export function RoutedDiagram({ vertical = false, active, cycle, arrived, returned, onSelect, reduced, running, id }: Props) {
  const L = vertical ? mobileLayout() : desktopLayout();
  const svgRef = useRef<SVGSVGElement>(null);
  const brief1 = useRef<SVGAnimateMotionElement>(null);
  const brief2 = useRef<SVGAnimateMotionElement>(null);
  const result = useRef<SVGAnimateMotionElement>(null);
  const routeId = `${id}-route`;

  // pause the SMIL clock off-screen / hidden tab
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (running) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [running]);

  // launch packets on each cycle
  useEffect(() => {
    if (reduced || !running) return;
    const t: number[] = [];
    t.push(window.setTimeout(() => brief1.current?.beginElement(), 30));
    t.push(window.setTimeout(() => brief2.current?.beginElement(), 530));
    t.push(window.setTimeout(() => result.current?.beginElement(), 2200));
    return () => t.forEach((x) => window.clearTimeout(x));
  }, [cycle, active, reduced, running]);

  const cy = (b: Box) => b.y + b.h / 2;
  const leaf = LEAVES[active];
  const ink = "#f5f7f0";
  const mutedOnDark = "#9fb0b8";
  const nodeFill = "#14212a";
  const leafFill = "#0f1a21";
  const stroke = "rgba(245,247,240,0.22)";

  return (
    <svg
      ref={svgRef}
      viewBox={L.viewBox}
      className="h-auto w-full font-body"
      role="img"
      aria-label={`A brief travels from your iPhone to the relay you host, then to your computer, then to ${leaf.name}; the result returns the same way.`}
    >
      <defs>
        <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(245,247,240,0.07)" />
        </pattern>
        <path id={routeId} d={L.routes[active]} fill="none" />
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />

      {/* ---------- base edges ---------- */}
      <g fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ vectorEffect: "non-scaling-stroke" }}>
        <motion.path d={L.e1} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 }} />
        <motion.path d={L.e2} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.7, ease: EASE, delay: 0.3 }} />
        {L.e2b ? <motion.path d={L.e2b} strokeDasharray="4 4" initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.7, ease: EASE, delay: 0.35 }} /> : null}
        <motion.path d={L.stem} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6, ease: EASE, delay: 0.45 }} />
        <motion.path d={L.trunk} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.8, ease: EASE, delay: 0.55 }} />
        {L.branches.map((d, i) => (
          <motion.path key={i} d={d} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.5, ease: EASE, delay: 0.7 + i * 0.05 }} />
        ))}
      </g>

      {/* ---------- hot route layer ---------- */}
      <g fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {L.routes.map((d, i) => (
          <path key={i} d={d} style={{ opacity: i === active ? 1 : 0, transition: "opacity 300ms" }} />
        ))}
      </g>

      {/* edge labels */}
      {vertical ? (
        <text x={L.e1Label.x} y={L.e1Label.y} textAnchor="start" fill={mutedOnDark} fontSize="10" className="font-mono" letterSpacing="0.08em">BRIEF · ACCOUNT TOKEN</text>
      ) : (
        <>
          <text x={L.e1Label.x} y={L.e1Label.y} textAnchor="middle" fill={mutedOnDark} fontSize="10" className="font-mono" letterSpacing="0.08em">BRIEF</text>
          <text x={L.e1Label.x} y={L.e1Label.y + 30} textAnchor="middle" fill={mutedOnDark} fontSize="10" className="font-mono" letterSpacing="0.08em">ACCOUNT TOKEN</text>
        </>
      )}
      <text x={L.stemLabel.x} y={L.stemLabel.y} textAnchor={vertical ? "start" : "middle"} fill={mutedOnDark} fontSize="10" className="font-mono" letterSpacing="0.08em">PULLS WORK · OUTBOUND HTTPS</text>
      {L.groupLabels.map((g) => (
        <text key={g.text} x={g.x} y={g.y} fill={mutedOnDark} fontSize="10" className="font-mono" letterSpacing="0.12em">{g.text}</text>
      ))}

      {/* ---------- packets (under nodes) ---------- */}
      {reduced ? (
        <circle cx={vertical ? 55 : 840} cy={cy(L.leaves[active])} r="5" fill="var(--mint)" />
      ) : (
        <g style={{ pointerEvents: "none", opacity: running ? 1 : 0, transition: "opacity 200ms" }}>
          <g opacity="0">
            <set attributeName="opacity" to="1" begin={`${id}-m1.begin`} end={`${id}-m1.end`} />
            <circle r="9" fill="var(--mint)" opacity="0.15" />
            <rect x="-7" y="-3" width="14" height="6" rx="3" fill="var(--mint)" />
            <animateMotion id={`${id}-m1`} ref={brief1} dur="1.6s" begin="indefinite" fill="remove" rotate="auto" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" keyPoints="0;1"><mpath href={`#${routeId}`} /></animateMotion>
          </g>
          <g opacity="0">
            <set attributeName="opacity" to="0.6" begin={`${id}-m2.begin`} end={`${id}-m2.end`} />
            <rect x="-7" y="-3" width="14" height="6" rx="3" fill="var(--mint)" />
            <animateMotion id={`${id}-m2`} ref={brief2} dur="1.6s" begin="indefinite" fill="remove" rotate="auto" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" keyPoints="0;1"><mpath href={`#${routeId}`} /></animateMotion>
          </g>
          <g opacity="0">
            <set attributeName="opacity" to="0.85" begin={`${id}-m3.begin`} end={`${id}-m3.end`} />
            <rect x="-7" y="-3" width="14" height="6" rx="3" fill="#f5f7f0" />
            <animateMotion id={`${id}-m3`} ref={result} dur="1.6s" begin="indefinite" fill="remove" rotate="auto" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href={`#${routeId}`} /></animateMotion>
          </g>
        </g>
      )}

      {/* ---------- phone node ---------- */}
      <motion.g initial={reduced ? false : { opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6, ease: EASE }} style={{ transformOrigin: `${L.phone.x + L.phone.w / 2}px ${cy(L.phone)}px` }}>
        <rect x={L.phone.x} y={L.phone.y} width={L.phone.w} height={L.phone.h} rx={vertical ? 10 : 14} fill="#2a363d" />
        <rect x={L.phone.x + 3} y={L.phone.y + 3} width={L.phone.w - 6} height={L.phone.h - 6} rx={vertical ? 8 : 12} fill="#f5f7f0" />
        <rect x={L.phone.x + L.phone.w / 2 - (vertical ? 9 : 14)} y={L.phone.y + 8} width={vertical ? 18 : 28} height={vertical ? 4 : 6} rx="3" fill="#0b1419" />
        <text x={L.phone.x + L.phone.w / 2} y={L.phone.y + (vertical ? 38 : 60)} textAnchor="middle" fill="#14212a" fontSize={vertical ? 7 : 10} fontWeight="800" className="font-display">I’m listening.</text>
        <g transform={`translate(${L.phone.x + L.phone.w / 2 - (vertical ? 16 : 24)} ${L.phone.y + (vertical ? 52 : 80)})`}>
          {Array.from({ length: vertical ? 7 : 9 }, (_, i) => (
            <rect key={i} className="svg-bar" x={i * (vertical ? 5 : 6)} y="0" width={vertical ? 3 : 3.5} height={vertical ? 18 : 26} rx="1.5" fill="#adf28f" style={{ "--i": i } as CSSProperties} />
          ))}
        </g>
        <rect x={L.phone.x + 8} y={L.phone.y + L.phone.h - (vertical ? 24 : 34)} width={L.phone.w - 16} height={vertical ? 14 : 22} rx={vertical ? 7 : 10} fill="#e0402a" />
        <text x={L.phone.x + L.phone.w / 2} y={L.phone.y + L.phone.h - (vertical ? 14 : 19)} textAnchor="middle" fill="#fff" fontSize={vertical ? 6 : 9} fontWeight="800" className="font-display">End call</text>
        {/* labels */}
        <text x={vertical ? L.phone.x + L.phone.w + 10 : L.phone.x + L.phone.w / 2} y={vertical ? L.phone.y + 40 : L.phone.y + L.phone.h + 24} textAnchor={vertical ? "start" : "middle"} fill={ink} fontSize={vertical ? 12 : 14} fontWeight="600">Your iPhone</text>
        <text x={vertical ? L.phone.x + L.phone.w + 10 : L.phone.x + L.phone.w / 2} y={vertical ? L.phone.y + 56 : L.phone.y + L.phone.h + 42} textAnchor={vertical ? "start" : "middle"} fill={mutedOnDark} fontSize={vertical ? 9 : 11} className="font-mono">
          {vertical ? "brief, not audio" : "brief, not audio · your key stays here"}
        </text>
        <text x={vertical ? L.phone.x + L.phone.w + 10 : L.phone.x + L.phone.w / 2} y={vertical ? L.phone.y + 74 : L.phone.y + L.phone.h + 62} textAnchor={vertical ? "start" : "middle"} fill="var(--mint)" fontSize={vertical ? 9 : 11} className="font-mono" style={{ opacity: returned ? 1 : 0, transition: "opacity 250ms" }}>
          ✓ Result in Tasks
        </text>
      </motion.g>

      {/* ---------- relay node ---------- */}
      <motion.g initial={reduced ? false : { opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 }} style={{ transformOrigin: `${L.relay.x + L.relay.w / 2}px ${cy(L.relay)}px` }}>
        <rect x={L.relay.x} y={L.relay.y} width={L.relay.w} height={L.relay.h} rx="20" fill={nodeFill} stroke="rgba(245,247,240,0.2)" />
        <Lock x={L.relay.x + 18} y={L.relay.y + (vertical ? 20 : 22)} width={vertical ? 22 : 26} height={vertical ? 22 : 26} color="#adf28f" strokeWidth={2.2} />
        <text x={L.relay.x + (vertical ? 52 : 58)} y={L.relay.y + (vertical ? 32 : 38)} fill={ink} fontSize={vertical ? 13 : 15} fontWeight="600">Your relay</text>
        <text x={L.relay.x + (vertical ? 52 : 58)} y={L.relay.y + (vertical ? 50 : 58)} fill={mutedOnDark} fontSize={vertical ? 9.5 : 11} className="font-mono">self-hosted · HTTPS · SQLite</text>
        <g transform={`translate(${L.relay.x + L.relay.w - (vertical ? 96 : 104)} ${L.relay.y + (vertical ? 8 : 68)})`}>
          <rect width={vertical ? 86 : 92} height="18" rx="9" fill="rgba(173,242,143,0.14)" stroke="rgba(173,242,143,0.4)" />
          <text x={vertical ? 43 : 46} y="12.5" textAnchor="middle" fill="#adf28f" fontSize="9.5" className="font-mono">→ {leaf.name.length > 12 ? leaf.name.slice(0, 11) + "…" : leaf.name}</text>
        </g>
        <path d={`M${L.relay.x + 14} ${L.relay.y + L.relay.h - 11} h28 l5 -6 l5 12 l5 -6 h${L.relay.w - 71}`} fill="none" stroke="#adf28f" strokeWidth="1.5" opacity="0.7" className={reduced ? "" : "heartbeat"} />
      </motion.g>

      {/* ---------- computer node ---------- */}
      <motion.g initial={reduced ? false : { opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6, ease: EASE, delay: 0.3 }} style={{ transformOrigin: `${L.computer.x + L.computer.w / 2}px ${cy(L.computer)}px` }}>
        <rect x={L.computer.x} y={L.computer.y} width={L.computer.w} height={L.computer.h} rx="20" fill={nodeFill} stroke="rgba(245,247,240,0.2)" />
        <Laptop x={L.computer.x + 18} y={L.computer.y + (vertical ? 20 : 22)} width={vertical ? 22 : 26} height={vertical ? 22 : 26} color="#f5f7f0" strokeWidth={2} />
        <text x={L.computer.x + (vertical ? 52 : 58)} y={L.computer.y + (vertical ? 32 : 38)} fill={ink} fontSize={vertical ? 13 : 15} fontWeight="600">Telegate Connect</text>
        <text x={L.computer.x + (vertical ? 52 : 58)} y={L.computer.y + (vertical ? 50 : 58)} fill={mutedOnDark} fontSize={vertical ? 9.5 : 11} className="font-mono">Mac mini · awake · outbound only</text>
        <circle cx={L.computer.x + L.computer.w - 18} cy={L.computer.y + 18} r="4" fill="#34c759" />
      </motion.g>

      {L.twin ? (
        <motion.g opacity="0.45" initial={reduced ? false : { opacity: 0 }} whileInView={{ opacity: 0.45 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}>
          <rect x={L.twin.x} y={L.twin.y} width={L.twin.w} height={L.twin.h} rx="20" fill={nodeFill} stroke="rgba(245,247,240,0.2)" />
          <Laptop x={L.twin.x + 18} y={L.twin.y + 22} width={26} height={26} color="#f5f7f0" strokeWidth={2} />
          <text x={L.twin.x + 58} y={L.twin.y + 38} fill={ink} fontSize="15" fontWeight="600">Laptop · office</text>
          <text x={L.twin.x + 58} y={L.twin.y + 58} fill={mutedOnDark} fontSize="11" className="font-mono">Offline · work waits in its queue</text>
          <circle cx={L.twin.x + L.twin.w - 18} cy={L.twin.y + 18} r="4" fill="#9fb0b8" />
        </motion.g>
      ) : null}

      {/* ---------- leaves ---------- */}
      {L.leaves.map((b, i) => {
        const lf = LEAVES[i];
        const isActive = i === active;
        const c = cy(b);
        return (
          <motion.g
            key={lf.kind}
            role="button"
            tabIndex={0}
            aria-label={`${lf.name}: ${lf.tip}`}
            aria-pressed={isActive}
            className="cursor-pointer outline-none"
            initial={reduced ? false : { opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.45 + i * 0.05 }}
            style={{ transformOrigin: `${b.x + b.w / 2}px ${c}px` }}
            onMouseEnter={() => onSelect(i)}
            onFocus={() => onSelect(i)}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); } }}
          >
            <circle cx={b.x + 34} cy={c} r={vertical ? 34 : 44} fill="var(--mint)" style={{ opacity: isActive ? 0.12 : 0, transition: "opacity 300ms" }} />
            <g style={{ transform: isActive ? "translateY(-4px)" : "translateY(0)", transition: "transform 300ms var(--ease-out)" }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="16" fill={leafFill} stroke={isActive ? "var(--mint)" : "rgba(245,247,240,0.14)"} strokeWidth={isActive ? 1.5 : 1} style={{ transition: "stroke 300ms" }} />
              <g color="#f5f7f0">
                {lf.kind === "command" ? (
                  <>
                    <HarnessLogo kind="command" className="" x={b.x + 14} y={c - 14} width={18} height={18} />
                    <Globe x={b.x + 30} y={c - 2} width={16} height={16} aria-hidden />
                  </>
                ) : (
                  <HarnessLogo kind={lf.kind} className="" animated={isActive && !reduced && running} x={b.x + 18} y={c - 14} width={28} height={28} />
                )}
              </g>
              <text x={b.x + (vertical ? 52 : 60)} y={c - (vertical ? 3 : 4)} fill={ink} fontSize={vertical ? (lf.name.length > 20 ? 11 : 13) : (lf.name.length > 20 ? 12 : 14)} fontWeight="600">{lf.name}</text>
              <text x={b.x + (vertical ? 52 : 60)} y={c + (vertical ? 12 : 14)} fill={mutedOnDark} fontSize={vertical ? 9 : 10.5} className="font-mono">{lf.tag.length > (vertical ? 30 : 36) ? lf.tag.slice(0, vertical ? 29 : 35) + "…" : lf.tag}</text>
              {/* arrival tag */}
              <g transform={`translate(${b.x + b.w - (lf.arrival.length > 8 ? 148 : 58)} ${b.y - 10})`} style={{ opacity: isActive && arrived ? 1 : 0, transition: "opacity 200ms" }}>
                <rect width={lf.arrival.length > 8 ? 140 : 50} height="18" rx="9" fill="var(--mint)" />
                <text x={lf.arrival.length > 8 ? 70 : 25} y="12.5" textAnchor="middle" fill="#14212a" fontSize="9.5" fontWeight="700" className="font-mono">{lf.arrival} ✓</text>
              </g>
            </g>
          </motion.g>
        );
      })}
    </svg>
  );
}
