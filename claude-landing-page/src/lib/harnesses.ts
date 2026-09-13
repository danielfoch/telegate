/**
 * Every place a Telegate brief can be delivered. Kinds mirror companion/cli.mjs:
 * codex | claude | openclaw | hermes | grokbot (webhook preset) | command | webhook.
 */
export type HarnessKind =
  | "claude"
  | "codex"
  | "openclaw"
  | "hermes"
  | "grokbot"
  | "homies"
  | "command"
  | "webhook";

export type Harness = {
  kind: HarnessKind;
  name: string;
  /** Where it runs from Telegate's point of view. */
  lane: "local" | "cloud";
  /** One-line description that stays true to the docs. */
  blurb: string;
  /** How the companion talks to it. */
  transport: string;
  /** Brand accent used for the node ring + bubble tint. */
  accent: string;
  /** Verb phrase used in the hero rotation. */
  ask: string;
};

export const HARNESSES: Harness[] = [
  {
    kind: "claude",
    name: "Claude Code",
    lane: "local",
    blurb: "Runs your installed, logged-in Claude Code in the folder you choose. Follow-ups resume the same session.",
    transport: "local CLI · stdin brief · session resume",
    accent: "#D97757",
    ask: "Get Claude Code to fix the failing tests on the checkout branch.",
  },
  {
    kind: "codex",
    name: "Codex",
    lane: "local",
    blurb: "Uses your existing Codex CLI and login. No extra keys on the computer.",
    transport: "local CLI · stdin brief · session resume",
    accent: "#111111",
    ask: "Get Codex to improve the mobile layout on my Mac mini.",
  },
  {
    kind: "openclaw",
    name: "OpenClaw",
    lane: "local",
    blurb: "Talks to your OpenClaw gateway agent with an isolated per-task session key.",
    transport: "openclaw agent · private message file · JSON result",
    accent: "#ff4d4d",
    ask: "Get OpenClaw to draft replies to every unanswered support email.",
  },
  {
    kind: "hermes",
    name: "Hermes Agent",
    lane: "local",
    blurb: "Sends the brief over stdin to hermes chat and keeps the session ID for follow-ups.",
    transport: "hermes chat --quiet · stdin · session footer",
    accent: "#7c5cff",
    ask: "Get Hermes to research three competitors and write me a memo.",
  },
  {
    kind: "grokbot",
    name: "Grok Bot",
    lane: "cloud",
    blurb: "Submits to a dedicated Grok Bot webhook routine through your relay and accepts its completion callback.",
    transport: "relay adapter · webhook routine · signed callback",
    accent: "#000000",
    ask: "Get Grok Bot to summarise today's mentions and flag anything urgent.",
  },
  {
    kind: "homies",
    name: "Homies",
    lane: "cloud",
    blurb: "Any HTTPS task endpoint that accepts a brief and calls back when it is done.",
    transport: "cloud endpoint · bearer token · callback",
    accent: "#EA5536",
    ask: "Get Homies to build a CMA for 44 Elm Street and email it to the seller.",
  },
  {
    kind: "command",
    name: "Any CLI",
    lane: "local",
    blurb: "Point it at an executable and arguments. The brief arrives on stdin, never through a shell.",
    transport: "local command · stdin · no shell interpolation",
    accent: "#3b6b57",
    ask: "Run my nightly build script and tell me if it passed.",
  },
  {
    kind: "webhook",
    name: "HTTPS endpoint",
    lane: "cloud",
    blurb: "Your own task-submission URL. Telegate signs a task-scoped callback so it can report back.",
    transport: "HTTPS POST · Idempotency-Key · task-scoped callback",
    accent: "#2f6fed",
    ask: "Kick off the deploy pipeline and let me know when it lands.",
  },
];

/** The six shown in the hero rotation, in order. */
export const HERO_ROTATION: HarnessKind[] = ["claude", "openclaw", "hermes", "codex", "grokbot", "homies"];

export function harness(kind: HarnessKind): Harness {
  const h = HARNESSES.find((x) => x.kind === kind);
  if (!h) throw new Error(`Unknown harness ${kind}`);
  return h;
}
