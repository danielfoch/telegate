# Telegate landing page

A cinematic, responsive landing page for the open-source Telegate iPhone app. Includes animated example conversations, a copyable installation prompt, a scroll-driven phone story and an interactive agent routing map. No microphone capture, analytics, account system or API key is used by this page.

## Develop

Use Node 24 or newer, then run `npm ci` and `npm run dev`. The app uses React and vinext with a static export. `npm run lint` and `npx tsc --noEmit` check the source.

## Build and host

Run `npm run build`. Host **`dist/client`** as a static website. It contains the HTML, client JavaScript, local fonts and optimized images. The marketing page is separate from Telegate’s relay; hosting this page does not deploy the task server.

When this directory is inside the Telegate repo, select **website** as the hosting project's root directory. On Vercel, use the supplied static-output configuration. On other hosts, set the publish directory to `dist/client`.

Sites deployment ownership is kept in the separate site checkout. The copy in the public Telegate repo has no maintainer project ID or credentials. Register your own Site if you deploy a fork through Sites.

## Content

- The main install button links to `docs/INSTALL-WITH-AN-AGENT.md` on GitHub.
- Keep the prompt in `app/page.tsx` and `public/install-prompt.txt` identical to the repo’s `docs/INSTALL-PROMPT.txt` and its Markdown guide.
- Scenarios are illustrative. Local adapters need installed agents; Grok Bot needs its relay adapter, and HomiesAI needs a compatible provider endpoint. ChatGPT voice helps prepare the brief and is not shown as a separate task harness.
- The hero photograph and phone concept render were generated for this page; the phone is explicitly labeled an illustration. Asset sources and notices are in `public/asset-notices.txt` and `public/fonts/OFL.txt`.
- Motion respects reduced-motion preferences. The demo can be paused, and selecting an example stops automatic rotation. Background-tab and offscreen demo rotation is suspended.
