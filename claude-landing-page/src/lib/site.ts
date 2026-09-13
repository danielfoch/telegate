export const site = {
  name: "Telegate",
  tagline: "More life. Less screen.",
  description:
    "Telegate is a free, open-source iPhone voice app. Talk through a task, send it to the AI agents running on your computer at home, and get back to your day.",
  repo: "https://github.com/danielfoch/telegate",
  /** The one-shot install prompt page in the repo. Resolves once the branch is merged to main. */
  promptDoc: "https://github.com/danielfoch/telegate/blob/main/docs/ONE-SHOT-INSTALL.md",
  docs: {
    selfHost: "https://github.com/danielfoch/telegate/blob/main/docs/SELF-HOST.md",
    diyIphone: "https://github.com/danielfoch/telegate/blob/main/docs/DIY-IPHONE.md",
    connect: "https://github.com/danielfoch/telegate/blob/main/docs/CONNECT.md",
    roadmap: "https://github.com/danielfoch/telegate/blob/main/docs/ROADMAP.md",
    license: "https://github.com/danielfoch/telegate/blob/main/LICENSE",
    openclawHermes: "https://github.com/danielfoch/telegate/blob/main/docs/integrations/OPENCLAW-HERMES.md",
    grokbot: "https://github.com/danielfoch/telegate/blob/main/docs/integrations/GROKBOT.md",
  },
  url: "https://telegate-claude-landing-page.vercel.app",
} as const;
