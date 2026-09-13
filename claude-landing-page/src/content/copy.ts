import type { HarnessKind } from "@/lib/harnesses";

export const BRAND = {
  theme: "More life. Less screen.",
  voice: "Talk it through. Get your day back.",
  supporting: "Talk it through. Send it off. Get back to your day.",
  dashboard: "Get work done. Get your day back.",
} as const;

export const HERO = {
  eyebrow: "Open source · self-hosted · developer preview",
  h1: ["More life.", "Less screen."],
  sub: BRAND.voice,
  body:
    "Say what you need. Telegate turns it into a brief and sends it to the agents already on your computer at home: Codex, Claude Code, OpenClaw, Hermes Agent, Grok Bot, Homies. Your key, your relay, your machines.",
  primary: "Install now",
  secondary: "See how it works",
  caption: "MIT · your own OpenAI key · DIY iPhone build via Xcode",
  scrubCaption: "Your key. Your relay. Your computers.",
} as const;

export type Rotation = {
  kind: HarnessKind;
  you: string;
  reply: string;
  picker: string;
  sent: string;
};

/** Hero rotation. #4 is the verbatim in-app example line. */
export const ROTATION: Rotation[] = [
  {
    kind: "openclaw",
    you: "Get OpenClaw to draft the release notes from this week's commits.",
    reply: "Delegating to OpenClaw…",
    picker: "OpenClaw · Mac mini",
    sent: "Sent to Mac mini · OpenClaw",
  },
  {
    kind: "hermes",
    you: "Have Hermes summarise the open issues and pick the top three.",
    reply: "Delegating to Hermes Agent…",
    picker: "Hermes Agent · Mac mini",
    sent: "Sent to Mac mini · Hermes Agent",
  },
  {
    kind: "claude",
    you: "Get Claude Code to fix the failing tests on the checkout branch.",
    reply: "Delegating to Claude Code…",
    picker: "Claude Code · Mac mini",
    sent: "Sent to Mac mini · Claude Code",
  },
  {
    kind: "codex",
    you: "Ask Codex on my Mac mini to improve the mobile layout.",
    reply: "Delegating to Codex…",
    picker: "Codex · Mac mini",
    sent: "Sent to Mac mini · Codex",
  },
  {
    kind: "grokbot",
    you: "Send Grok Bot the meeting notes and get a follow-up list.",
    reply: "Delegating to Grok Bot…",
    picker: "Grok Bot · Mac mini",
    sent: "Sent through your relay · Grok Bot",
  },
  {
    kind: "homies",
    you: "Ask Homies to pull the comps for 14 Elm Street.",
    reply: "Delegating to Homies…",
    picker: "Homies · endpoint",
    sent: "Sent through your relay · Homies endpoint",
  },
];

export const INSTALL = {
  h2: "Open source. Install now.",
  sub: "Clone it, host your own relay, build it onto your iPhone with Xcode. No Telegate account. No subscription.",
  pill: "Open source — Install now",
  chips: ["MIT licence", "Xcode + free Personal Team", "Node 24+"],
  clone: "git clone https://github.com/danielfoch/telegate.git",
  disclosure: "Developer preview — physical-iPhone acceptance pending.",
  disclosureSub: "DIY builds show results in Tasks; Apple's free provisioning needs a rebuild every seven days.",
  stats: [
    { value: 0, prefix: "$", label: "Telegate software fee", countDown: true },
    { value: 0, label: "inbound ports on your computer" },
    { value: 1, label: "relay you own" },
    { value: 7, label: "destinations for a brief" },
  ],
} as const;

export const PROMPT = {
  h2: "or just copy + paste this prompt into your harness",
  sub: "Give it to Claude Code or Codex on the Mac that has your iPhone plugged in. It clones the repo, runs the doctor, sorts out the relay, builds the app onto your phone, sets up the companion and hands you the pairing code.",
  under: "Sends nothing anywhere. It asks you for your relay address and Apple account when it gets there, and never for your OpenAI key.",
  footer: "Click the prompt to select it all · Copy sends nothing anywhere.",
  copy: "Copy prompt",
  copied: "Copied",
} as const;

export const TALK = {
  eyebrow: "How it works",
  h2: "Talk with your phone",
  beats: [
    {
      h3: "Say it.",
      body: "Tap Start talking, or press the Action Button you assigned to the Start voice chat shortcut. GPT-Live listens on your own OpenAI key, kept in your Keychain. Telegate turns the conversation into a task brief and sends it when you say so.",
    },
    {
      h3: "Send it.",
      body: "Pick a computer and a harness under SEND WORK TO. Your self-hosted relay hands the brief to that exact machine. Offline computers keep the work queued. Send when I ask is on by default; turn it off to review drafts first.",
    },
    {
      h3: "Hang up. Get your day back.",
      body: "Ending a call keeps submitted work running, for hours if it needs to. Local runs default to a four-hour limit, up to 24. The result lands in Tasks, or as a push alert in the full build with your own APNs. Read it, have it read to you, or continue by voice and pick up the exact same Codex, Claude, OpenClaw or Hermes session.",
    },
  ],
  facts: [
    { value: "0", label: "inbound ports · companions call out over HTTPS" },
    { value: "1", label: "pairing code per computer · expires in ten minutes" },
    { value: "7", label: "destinations for a brief" },
    { value: "24 h", label: "max local run · default 4" },
  ],
} as const;

export const TREE = {
  eyebrow: "Talk with your phone ↑",
  h2: "while your agents work at home",
  sub: "One brief, one route. Your phone talks to the relay you host; your computer pulls its own work over outbound HTTPS and hands it to the harness you chose. Results come back the same way. Nothing passes through a Telegate server. The relay is yours.",
  caption1: "Computers make outbound HTTPS calls only. No inbound ports. Prompts are never assembled into shell commands.",
  caption2: "Icons identify integrations, not endorsement. Product names and marks belong to their owners.",
} as const;

export const PRICING = {
  h2: "Free to run. Paid to skip the setup — later.",
  sub: "Telegate Community is the whole product. A done-for-you App Store edition is planned for people who would rather not host a relay or open Xcode. It isn't available yet.",
  community: {
    eyebrow: "Telegate Community",
    price: "Free",
    priceSub: "Open source · self-hosted · everything",
    features: [
      "MIT-licensed source, nothing feature-gated",
      "Native iPhone/iPad voice app: DIY build with Xcode and a free Personal Team",
      "Telegate Connect for Mac plus a Node companion for macOS, Linux and Windows-compatible commands",
      "All 7 destinations: Codex, Claude Code, OpenClaw, Hermes Agent, Grok Bot (webhook), Homies (cloud endpoint), any command or HTTPS endpoint",
      "Your own relay (Docker Compose + Caddy HTTPS) and your own OpenAI key",
      "Tasks, follow-ups that resume the same harness session, opt-in project awareness scans",
      "Full push build included if you bring Apple/APNs credentials",
      "Dashboard, milestones, optional per-relay leaderboard",
    ],
    youBring: ["a relay on HTTPS", "an OpenAI project key", "a Mac with Xcode", "a rebuild every 7 days (Personal Team)"],
    elsewhere: "Hosting · OpenAI API usage · Apple developer account (optional)",
    cta: "Get the source",
    cta2: "Read the DIY guide",
  },
  managed: {
    badge: "Coming soon",
    eyebrow: "Done-for-you iOS app",
    title: "Pay As You Talk",
    priceSub: "Pricing not decided yet",
    body: "App Store install, guided pairing, managed relay and notifications, updates and support. Requires product maturity and Apple review. No launch date is promised.",
    features: ["Install from the App Store", "Guided pairing", "Managed relay and push notifications", "Updates and support"],
    cta: "Watch releases on GitHub",
    small: "Planned, not available. The community edition stays free either way.",
  },
  under: "The community edition stays free. Nothing in this code is feature-gated.",
} as const;

export const FOOTER = {
  line: "Developer preview — physical-iPhone acceptance pending. Telegate is MIT-licensed; harness names and marks belong to their owners. A separate product from Homies Voice.",
} as const;
