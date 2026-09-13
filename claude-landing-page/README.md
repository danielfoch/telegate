# Telegate landing page (Claude build)

The marketing site for [Telegate](https://github.com/danielfoch/telegate): a scroll-driven, single-page Next.js app.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · [`motion`](https://motion.dev) · `lucide-react` · `next/font/google` (Nunito, Inter, JetBrains Mono).
- **Sections:** hero demo loop (rotating prompts, waveform, returning-voice reply) → Install band → one-shot prompt card → Talk with your phone (sticky phone, three beats) → routed diagram of every delivery path → pricing (Free / Pay As You Talk, coming soon) → footer.
- **Copy** lives in `src/content/copy.ts`; links in `src/content/links.ts`; the one-shot prompt in `src/content/one-shot-prompt.ts`, which must stay byte-identical to the fenced block in [`docs/ONE-SHOT-INSTALL.md`](../docs/ONE-SHOT-INSTALL.md) — `npm run check:prompt` verifies that.
- Every product claim is taken from the repo docs. Nothing unshipped is rendered as live; the developer-preview disclosure appears in the Install band and the footer.

## Develop

```sh
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run check:prompt
npm run build
```

## Deploy

Deployed to Vercel from this directory (project `telegate-claude-landing-page`). The "Install now" pill links to `docs/ONE-SHOT-INSTALL.md` on `main`; set `NEXT_PUBLIC_INSTALL_DOC_URL` on a preview deployment to point at a branch path until the doc is merged.

## Accessibility and motion

- Honors `prefers-reduced-motion`: no scroll scrubs, springs, arcs, typing or packet animations; state changes still change colour and label.
- Light and dark colour schemes via tokens in `src/app/globals.css`; the phone mockup, terminal bands and diagram use fixed colours like the real app.
- The hero demo has a visible Pause control; loops pause off-screen and on hidden tabs.
- Harness logos: Claude (Simple Icons, CC0), Codex and Grok (LobeHub, MIT), OpenClaw (official favicon, MIT), Hermes (caduceus glyph), Homies (own mark). Icons identify integrations, not endorsement.
