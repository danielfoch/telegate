import type { HarnessKind } from "@/lib/harnesses";

export type Leaf = {
  kind: HarnessKind;
  name: string;
  tag: string;
  lane: "local" | "https";
  tip: string;
  /** what the leaf's tag flashes when the brief lands */
  arrival: string;
};

export const LEAVES: Leaf[] = [
  { kind: "codex", name: "Codex", tag: "local CLI", lane: "local", tip: "Runs the Codex CLI you already have, in the folder you chose. Follow-ups resume the same saved session.", arrival: "done" },
  { kind: "claude", name: "Claude Code", tag: "local CLI", lane: "local", tip: "Runs Claude Code locally with your login. Follow-ups resume the exact session.", arrival: "done" },
  { kind: "openclaw", name: "OpenClaw", tag: "openclaw agent · gateway", lane: "local", tip: "Uses your gateway-backed openclaw agent with its own session key per task.", arrival: "done" },
  { kind: "hermes", name: "Hermes Agent", tag: "hermes chat --quiet", lane: "local", tip: "Calls hermes chat --quiet with your provider config; resumes by session ID.", arrival: "done" },
  { kind: "grokbot", name: "Grok Bot", tag: "webhook routine · operator-configured", lane: "https", tip: "Submits to the Grok Bot webhook routine you configured on your relay. Can finish after your computer goes offline.", arrival: "accepted · running in Grok" },
  { kind: "homies", name: "Homies", tag: "cloud endpoint · needs a provider endpoint", lane: "https", tip: "Your Homies task endpoint and key, over HTTPS. Needs a compatible provider endpoint.", arrival: "accepted" },
  { kind: "command", name: "Any command or HTTPS endpoint", tag: "custom adapter", lane: "https", tip: "Any local command adapter, launched without shell interpolation, or any endpoint that accepts the cloud task contract and calls back when done.", arrival: "done" },
];
