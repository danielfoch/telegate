# Install Telegate with one prompt

Copy this into **Codex or Claude Code on your Mac**. Your agent clones the repo, prepares the relay and apps, installs to your connected iPhone when Apple signing is ready, then walks you through connecting your agents.

```text
Install Telegate on my iPhone from https://github.com/danielfoch/telegate. Follow docs/INSTALL-WITH-AN-AGENT.md, handle the setup you can, and guide me through pairing my computer and connecting my agents. Ask me only for what you can’t discover or do yourself.
```

**No placeholders. No invitation code.** Have your iPhone and a cable nearby. A Mac with Xcode is required for the iOS build. Apple Account sign-in, device trust, Developer Mode and some signing approvals need your interaction; one prompt starts a guided installation, not a way around Apple’s requirements. Free Personal Team installs need renewing after seven days. The source is free; OpenAI usage and any hosting you choose are billed separately.

Already know your way around Xcode? Use the [manual iPhone guide](DIY-IPHONE.md).

---

## Instructions for the coding agent

Treat the starter above as a request to **do the installation**, not just write a plan. Work through these steps with the user’s current environment. Do not ask them to edit the prompt, fill placeholders, paste commands or repeat information you can inspect. Ask for one genuinely missing choice at a time and keep going on independent setup while waiting.

### 1. Find or clone the project

- Find an existing checkout whose remote is `https://github.com/danielfoch/telegate` before cloning. Preserve its uncommitted work and local configuration; do not reset, overwrite or create duplicate installations.
- Otherwise clone the public repo into an appropriate user-owned directory. Use the current default branch. Read the repository instructions, `README.md`, `docs/DIY-IPHONE.md`, `docs/CONNECT.md` and `docs/SELF-HOST.md` before installing.
- Discover the OS, Node version, selected Xcode, available iOS SDKs and physical devices. `npm run doctor -- --phone` checks the basic tools. The Node relay and companion have no third-party runtime dependencies; do not run the landing page’s dependency installation for the app.
- iOS installation requires macOS and Xcode. On another OS, prepare what is useful for the relay/companion and explain the exact next action to continue on the Mac. Never present a simulator build as a phone installation.
- Use official installers or an existing package manager for required Git/Node tools. Node 24+ is required. XcodeGen is optional because the Xcode project is committed. Do not silently accept Apple legal agreements, enroll in a paid service, or change system-wide security settings.

### 2. Establish one reachable relay address

- Reuse the user’s existing Telegate relay and configuration when available. Verify `/health` succeeds over HTTPS. Inspect only relevant configuration and keep credentials out of chat and logs.
- If no relay exists, default to a **local development relay with a temporary HTTPS tunnel** for the first trial. Tell the user it must remain running and that a stable deployment is needed for everyday use. Do not invent a shared public backend or send them to the project maintainer’s personal relay.
- Use the committed `relay/server.mjs`, a private persistent SQLite database, a random callback-signing secret, a loopback listener on an available port, and an official tunnel tool such as Cloudflare’s `cloudflared`. Inspect the installed CLI’s help, start it against the relay’s loopback port, and capture the actual HTTPS hostname it returns. Configure `PUBLIC_URL` to that hostname. Registration does not require a pilot invitation.
- Keep configuration and secrets in ignored files with restrictive permissions. Preserve the same database across restarts. Record how to start/stop the relay and tunnel; do not rely on a short-lived shell that exits with the installation task. Do not terminate an unrelated process to take its port. Temporary hostnames can change after a tunnel restart, so record which app settings must then be updated.
- If the user already has infrastructure or requests a permanent installation, use `docs/SELF-HOST.md`. Ask about the hosting destination only when not already known. Do not spend money or change unrelated DNS without the user’s authorization.
- Never use `127.0.0.1` or `localhost` as the phone’s service address. Never put an OpenAI key on the relay. Configure Grok Bot only when its own credentials and endpoint are available.

### 3. Prepare local app configuration

- Reuse `Config.local.xcconfig` if it exists. Preserve the bundle identifiers: changing them can create a second app and separate Keychain data.
- For a first install, use `writeConfiguration` exported from `scripts/configure.mjs` to create the ignored configuration with the verified HTTPS origin and a unique app identifier. This helper refuses to overwrite existing files. You may construct a small local invocation with discovered values; the user should not have to edit variables in a prompt.
- Infer an already configured Apple development team from the project/Xcode setup when unambiguous. When multiple teams are possible, ask which to use. Prefer a free Personal Team for a new DIY setup when that is the only available personal choice. Do not assume an unrelated organization’s team is authorized.
- Have the user sign into **Xcode → Settings → Apple Accounts** if needed. Let them enter their own credentials and approve their own account prompts. Do not request their Apple password in chat.

### 4. Build and install the iPhone app

- Use the **TelegateDIY** scheme and **DIY** configuration. It omits APNs and supports the community installation path. The full push-enabled scheme has additional signing requirements and is not the default here.
- Discover a real available iPhone using `xcrun devicectl list devices` and Xcode’s destinations. Use the installed tools’ `--help`/JSON output to obtain exact device identifiers. Do not guess a device or reuse an identifier from this repository’s development history.
- If the device is unavailable, guide the user through the shortest next action: connect and unlock it, Trust This Computer, or enable Developer Mode and complete its on-device restart/confirmation. A USB connection is the simplest first pairing. A wireless device must already be paired and reachable.
- Resolve the pinned WebRTC package. Build with `xcodebuild`, the project’s DIY scheme/configuration, the selected physical device destination and automatic signing under the selected team. Use `-allowProvisioningUpdates` only within the user’s chosen team and normal signing authorization. Keep any machine-specific build fixes local.
- After a successful signed build, install the actual `.app` using `xcrun devicectl device install app`, then launch the discovered bundle identifier using `xcrun devicectl device process launch`. Inspect current help for exact syntax. Verify both commands succeed; do not stop at “build succeeded.”
- If a signing key or trust prompt blocks installation, preserve the successful work and tell the user the exact action and error. Never export private signing keys, reset a keychain, delete certificates, broaden private-key access, or disable security features as an installation shortcut. Do not claim installation succeeded while waiting on the user.

### 5. Set up Telegate Connect on the executing Mac

- Build the **TelegateConnect** scheme and launch the resulting Mac app. Use the same relay origin as the phone. Preserve an existing computer name, pairing and configured agents.
- Discover installed Codex, Claude Code, OpenClaw and Hermes executables without reading unrelated private histories. Use the user’s existing authenticated harnesses; do not silently install every agent, change their model, or grant broader tool permissions.
- Help select the relevant project folder. Ask one simple question if several projects are equally likely. Leave project metadata sharing off unless the user chooses it; explain what is shared when enabling it.
- Grok Bot uses the relay’s cloud adapter and a dedicated webhook routine; follow `docs/integrations/GROKBOT.md`. HomiesAI needs a Telegate-compatible provider endpoint; do not pretend that naming a custom entry supplies an integration. For OpenClaw/Hermes, follow their integration guide and check their installed CLI compatibility.
- In Connect, use **Pair my phone**. On the iPhone, create/sign into an account on the same relay, then open **Computers → Add computer**, enter the current pairing code and confirm the computer’s identity. Let the user approve the device association. Do not copy one computer’s credential to another.
- Have the user enter their OpenAI key directly in the phone app, where it is stored in Keychain. Verify current model availability rather than assuming a key works. Do not collect or paste that key into chat, a relay environment file or a public issue.

### 6. Prove one small delegation

- Check that the phone shows the computer online and the selected harness available. Merely launching the Mac process does not prove a live heartbeat.
- Ask the user to make a harmless, observable test request in an appropriate project, explicitly send the brief and end the call. Confirm the task appears in both Telegate and the intended agent, then that a result returns to **Tasks**. Do not perform a destructive or externally communicative test without explicit permission.
- Show how to continue the task from its result. The DIY build shows results on reopening/refreshing Tasks; it does **not** promise background push notifications.
- Offer the optional **iPhone Settings → Action Button → Shortcut → Telegate → Start voice chat** setup. The app cannot change the hardware button itself. Complete microphone/setup permissions first; the phone may require unlocking.

### 7. Return a short, personal handoff

Use the real values and observed state. Include:

- What actually installed, on which phone and computer, and what remains blocked.
- The local checkout/app locations and the relay address; say whether it is temporary or permanent.
- Which agent and project are connected, whether project awareness is enabled, and how to select others.
- The next exact pairing/onboarding action if the user still needs to do one. Generate a fresh code when appropriate; never present an expired code as usable.
- The first delegation’s verified outcome, or explicitly say it has not been tested yet.
- How to reopen Connect and restart the relay/tunnel. Keep the executing computer awake. With free Personal Team signing, reinstall from the same checkout/app identity when the seven-day profile expires.

Leave secrets out of the handoff. Write any longer operator notes to a private ignored local file and link it. Do not open a PR or publish private setup files as part of installing the app.

## Apple reference material

- [Run on a physical device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
- [Enable Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
- [Personal Team provisioning limits](https://developer.apple.com/help/account/basics/about-your-developer-account)
