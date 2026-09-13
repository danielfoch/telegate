# Install Telegate with one prompt

Copy the prompt below and paste it into Claude Code or Codex on the Mac that has your iPhone plugged in. The agent clones the repo, checks your Mac and phone, sets up a relay, builds and installs the TelegateDIY app, pairs a companion with the coding harness you already use, and ends with a first-call walkthrough.

**What the agent will ask you first.** It looks around your Mac silently, then sends one message with a few questions, each with a default: which relay route you want (A = one you already run, B = deploy on your own Linux/Docker host, C = a quick local relay behind a temporary HTTPS tunnel), which harnesses to expose (codex, claude, openclaw, hermes; you must already be logged in), the computer name to show on the phone, and, only if needed, which Apple team ID to sign with and whether to reuse an existing pairing. It also reminds you to have the iPhone plugged in, unlocked, trusted, with Developer Mode on, and Xcode signed into an Apple Account. After that it runs on its own and only stops for things a person has to do on the phone or in Xcode. It never asks for your OpenAI key or Apple password.

```text
# Install Telegate on my iPhone and pair it with this Mac (one shot)

You are a careful, literal build engineer setting up Telegate (https://github.com/danielfoch/telegate) for me: the TelegateDIY app on my physically connected iPhone, a reachable HTTPS relay, and a companion on this Mac that runs my AI coding harness. Work through the phases in order and verify each one with the check given. When a check fails, stop, print what you saw and the diagnosis, and wait for me. Never guess and never silently "try something else".

HARD RULES. Never ask for, print, log, or store my OpenAI key, Apple password, device tokens, or any secret (the OpenAI key is typed into the phone app only; never `cat` `.env` or `~/.config/telegate/computer.json`). Never run `sudo`. Never delete files or run `rm`. The only files you may modify are `Config.local.xcconfig` (the URL line, as written in Phase 3) and your own logs under `~/telegate/build/logs/`; anything else you must move aside gets a timestamp rename (`mv X X.bak-$(date +%s)`). Never commit. Never run a harness model yourself; only check the CLI exists. Things only I can do: sign into Xcode -> Settings -> Apple Accounts; plug in, unlock, and Trust the iPhone; enable Developer Mode on the phone; create the Telegate account and paste the OpenAI key in the app; assign the Action Button. When you reach one, tell me in one sentence and wait.

## Phase 0 - discover silently, then ask ONE question
Run read-only, in one batch: `node -v` (need 24+), `xcodebuild -version`, `xcrun devicectl list devices | grep -i iphone` (want State `connected` and a 36-char Identifier), `security find-identity -v -p codesigning | grep "Apple Development"` (team ID = the 10 characters in parentheses; do not print the names), `command -v codex claude openclaw hermes cloudflared ngrok brew`, `ls -d ~/telegate`, `lsof -iTCP:8790 -sTCP:LISTEN`, `test -f ~/.config/telegate/computer.json && grep -c deviceToken ~/.config/telegate/computer.json`.
Then ask me one message containing only what you could not settle, each with a default so "go with the defaults" is a valid answer:
1. Relay route: A = I already run one (give the `https://` hostname); B = deploy on a Linux/Docker host + domain I control; C (default) = quick test: local relay + temporary HTTPS tunnel (hostname changes when the tunnel restarts; anyone with the URL can sign up on it, so stop it when done). If C and neither cloudflared nor ngrok is installed, ask permission to `brew install cloudflared`.
2. Which harness(es) to expose: codex, claude, openclaw, hermes. Default = the ones found on PATH. I must already be logged into each.
3. Computer name shown on the phone (default: this Mac's hostname).
4. Only if more than one Apple Development team ID exists: which one. If none exists, say you will try automatic signing and fall back to Xcode.
5. Only if `~/.config/telegate/computer.json` already has a deviceToken: reuse that pairing (skip the wizard, just start the connector) or pair fresh (rename it aside)?
6. Companion: CLI (default; you configure it) or the Telegate Connect Mac app (I configure it in a window).
Also remind me: iPhone plugged in via USB, unlocked, Trust This Computer accepted, Developer Mode on (Settings -> Privacy & Security -> Developer Mode), and Xcode signed into an Apple Account. After my reply, do not ask again except at the explicit "wait for me" points.

## Phase 1 - clone and prerequisites
    cd ~ && { [ -d telegate/.git ] || git clone https://github.com/danielfoch/telegate.git; } && cd ~/telegate && git pull --ff-only
    mkdir -p build/logs && npm run doctor -- --phone && npm test
Every required doctor line must be a check mark (XcodeGen marked optional is fine); `npm test` must print `fail 0`. No `npm install` is needed. Stop with the fix I must do myself if Node < 24 (`brew install node`), Xcode/iPhone SDK is missing, or the license is unaccepted (`sudo xcodebuild -license accept`, run by me). Set `UDID=$(xcrun devicectl list devices | grep -i iphone | grep -w connected | grep -Eo '[0-9A-F-]{36}' | head -1)`; if empty, I need to plug in/unlock/trust or enable Developer Mode (phone restarts). Wait, then re-check.

## Phase 2 - a reachable HTTPS relay (result: RELAY=https://<hostname>, no path, no trailing slash)
- Route A: RELAY is my hostname.
- Route B: print these for me to run on the host (do not run them here) and wait for my hostname: `git clone https://github.com/danielfoch/telegate.git && cd telegate && npm run doctor -- --server && npm run deploy:setup && docker compose up -d --build` (DNS pointed at the host, TCP 80/443 open; deploy:setup creates `.env` and never overwrites it).
- Route C: unless Phase 0 showed :8790 already listening,
    cd ~/telegate && nohup npm start > build/logs/relay.log 2>&1 & echo $! > build/logs/relay.pid
    sleep 2 && curl -fsS http://127.0.0.1:8790/health
    nohup cloudflared tunnel --url http://127.0.0.1:8790 > build/logs/tunnel.log 2>&1 & echo $! > build/logs/tunnel.pid
    for i in $(seq 1 15); do RELAY=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' build/logs/tunnel.log | head -1); [ -n "$RELAY" ] && break; sleep 2; done; echo "$RELAY"
  (ngrok: `nohup ngrok http 8790 > build/logs/tunnel.log 2>&1 &` and read the `https://` URL from `curl -s localhost:4040/api/tunnels`.) Confirm both processes are alive with `kill -0 $(cat build/logs/relay.pid) $(cat build/logs/tunnel.pid)`. If your environment cannot keep background processes alive, say so and hand me the two commands to run in two Terminal tabs, then continue once /health answers.
- Verify for every route (the tunnel takes a few seconds to go live, so retry): `for i in $(seq 1 12); do curl -fsS "$RELAY/health" && break; sleep 5; done` must print exactly `{"status":"ok","version":1}`. If it never does: route C, read `build/logs/relay.log` and `build/logs/tunnel.log` (local /health ok but tunnel failing = tunnel problem); routes A/B, report "relay unreachable at $RELAY/health - check DNS, certificate, ports 80/443, and `docker compose ps`" and wait.

## Phase 3 - bake the relay into the app config
TEAM = the single Apple Development team ID, or my answer, or empty. `npm run setup` refuses `http://`, localhost/*.localhost, credentials, paths and query strings, and refuses to overwrite an existing file (it does not reject IP literals, so only pass a hostname). It reads answers with readline, which drops lines that arrive in one chunk, so feed them one at a time:
    cd ~/telegate && [ -f Config.local.xcconfig ] || (for a in "$RELAY" "$TEAM"; do printf '%s\n' "$a"; sleep 1; done) | npm run setup
    test -s Config.local.xcconfig && grep -E '^(TELEGATE_SERVICE_URL|TELEGATE_APP_ID|DEVELOPMENT_TEAM)' Config.local.xcconfig
Exit 0 is not proof: the output must say "Saved a private configuration" and the file must exist. If the file already existed (rerun, or a new tunnel hostname), keep its `TELEGATE_APP_ID` (the app's identity) and change only the URL line: `sed -i '' "s#^TELEGATE_SERVICE_URL = .*#TELEGATE_SERVICE_URL = https:/\$()/${RELAY#https://}#" Config.local.xcconfig` (the `$()` keeps Xcode from reading `//` as a comment). Then `BUNDLE_ID=$(awk -F' = ' '/^TELEGATE_APP_ID/{print $2}' Config.local.xcconfig)`.

## Phase 4 - build and install on the iPhone (one CLI attempt, then Xcode)
Tell me in one line: keep the iPhone plugged in and unlocked; tap Trust/Allow if it asks. Then:
    cd ~/telegate && xcodebuild -project Telegate.xcodeproj -scheme TelegateDIY -configuration DIY -destination "id=$UDID" \
      -allowProvisioningUpdates -allowProvisioningDeviceRegistration -derivedDataPath build \
      ${TEAM:+DEVELOPMENT_TEAM=$TEAM} build 2>&1 | tee build/logs/ios-build.log | tail -30
The first run resolves the pinned WebRTC package; allow up to 10 minutes. Success = `** BUILD SUCCEEDED **` and `build/Build/Products/DIY-iphoneos/Telegate.app` exists. Then:
    xcrun devicectl device install app --device "$UDID" build/Build/Products/DIY-iphoneos/Telegate.app
    xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID"
Read the log tail before deciding anything:
- "requires a development team" / "No signing certificate" / "No profiles" / "Unable to log in" / "session has expired": I must sign into Xcode -> Settings -> Apple Accounts. After that, rerun `security find-identity`; if it now shows an Apple Development identity and TEAM was empty, retry once with it. Otherwise go straight to the Xcode fallback: `open Telegate.xcodeproj`, and I choose scheme TelegateDIY + my iPhone, target Telegate -> Signing & Capabilities -> Automatically manage signing -> Team = my Personal Team (configuration DIY; do not add Push Notifications), press Run, accept device prompts, and reply "installed". Do not loop on xcodebuild.
- Device not found / locked / "Developer Mode disabled": I unlock, Trust, enable Developer Mode, replug; retry the failed command.
- Launch fails or the phone shows "Untrusted Developer": I tap Settings -> General -> VPN & Device Management -> Developer App -> Trust, then rerun the launch command.
- Push/entitlement complaints: you are not on `-configuration DIY`; fix the command.
Verify either route: `xcrun devicectl device info apps --device "$UDID" | grep -F "$BUNDLE_ID"` prints a line.

## Phase 5 - companion on this Mac
    FOLDER="$HOME/telegate-test"; mkdir -p "$FOLDER" && { git -C "$FOLDER" rev-parse --git-dir >/dev/null 2>&1 || git -C "$FOLDER" init -q; }
For each chosen harness, `command -v <name>` must succeed; if one is missing, stop: I install and log into it myself. Mac-app choice: `cd ~/telegate && xcodebuild -project Telegate.xcodeproj -scheme TelegateConnect -configuration Debug -derivedDataPath build CODE_SIGNING_ALLOWED=NO build && open build/Build/Products/Debug/TelegateConnect.app`; I enter the relay address, computer name and agent in its Settings and click Pair my phone, and you skip the wizard below (it uses its own config, so it can coexist with the CLI).
Now tell me to do this on the phone, then wait for "ready": open Telegate -> Create account on RELAY (no invite code) -> save the recovery key somewhere safe -> add my OpenAI key in the app (my OpenAI project must have gpt-live-1 and gpt-5.6-terra; the key stays in the phone Keychain and goes only to OpenAI; never send it to you).
When I say "ready" (CLI companion): SERVICE is `$RELAY` for routes A/B, or `http://127.0.0.1:8790` for route C (same Mac; it keeps working when the tunnel hostname changes). If I chose "pair fresh", first `mv ~/.config/telegate/computer.json ~/.config/telegate/computer.json.bak-$(date +%s)`; a config that already has a deviceToken makes the wizard skip pairing and print no code. KIND is the harness kind (codex|claude|openclaw|hermes) and must match the executable. Answers, in order: service, computer name, then per harness: kind, display name (Return), executable (Return = kind), working folder, [openclaw only: agent ID, default main], share y/n, add another y/n. The wizard has the same readline issue (and openclaw/hermes run a quick `--help` probe before the share question), so feed one line at a time; one harness:
    cd ~/telegate && (for a in "$SERVICE" "$NAME" "$KIND" "" "" "$FOLDER" n n; do printf '%s\n' "$a"; sleep 2; done; sleep 2) | nohup npm run connect > build/logs/pair.log 2>&1 &
    for i in $(seq 1 20); do grep -o 'Pairing code: .*' build/logs/pair.log && break; sleep 2; done
(Two harnesses: answer `y` instead of the final `n`, then the next harness block, ending with `n`.) Print the code prominently; it expires in 10 minutes. If no code appears within 40 s, print `tail -20 build/logs/pair.log` and stop (failures are bare messages such as "Use an HTTPS service address", "fetch failed", "Unknown harness type.", or "unsettled top-level await"). Tell me: on the phone, Computers -> + -> enter the code -> confirm the name "$NAME" and the harness list. Poll `grep -c 'Computer paired.' build/logs/pair.log` every 15 s for up to 10 minutes; on "Pairing expired. Run setup again." rename the config aside and rerun the wizard once. Then start the connector:
    cd ~/telegate && nohup npm run connect -- run > build/logs/connector.log 2>&1 & echo $! > build/logs/connector.pid
    sleep 5; if pgrep -f 'companion/cli.mjs run' >/dev/null; then echo "Companion is listening"; else tail -20 build/logs/connector.log; fi
A healthy start prints nothing; the pgrep is the real check. "A connector is already running for this configuration." means my old connector is up: report it and stop. Leave everything running.

## Phase 6 - print "You're paired - first call" and stop
Print this to me, filled in with real values (relay, bundle ID, computer name, harness(es), test folder, log paths), then stop:
1. On the phone, open Call, choose "$NAME" -> your harness.
2. Tap Start talking, allow the microphone. Say: "In the telegate-test folder, create hello.txt containing the word hello, then tell me it's done." Wait for the app to confirm the task was queued (Send when I ask is on by default).
3. End the call. The harness runs in ~/telegate-test: the agent checks `cat ~/telegate-test/hello.txt`, and the result appears in Tasks on the phone (DIY has no push alerts; reopen Tasks). A small follow-up resumes the same session.
4. Optional: iPhone Settings -> Action Button -> Shortcut -> Telegate -> Start voice chat.
5. Keep running (each in its own Terminal tab after a reboot, Mac kept awake): `cd ~/telegate && npm run connect -- run`; route C also `cd ~/telegate && npm start` and `cloudflared tunnel --url http://127.0.0.1:8790`. Route C caveat: a restarted tunnel gets a new hostname, so ask the agent to rerun Phase 2-4 (sed the new host into Config.local.xcconfig, rebuild, reinstall; the companion on 127.0.0.1 is unaffected). Stop cloudflared when done testing; use route A/B for ongoing use.
6. Free Personal Team installs expire after 7 days: say "renew" and the agent reruns Phase 4 with the same checkout and Config.local.xcconfig (same app ID, data kept); if the Xcode fallback was used, press Run in Xcode again instead. Do not delete the app.
Finish with one line stating what was verified (health, build, install, pairing, connector) and anything not verified.
```

## What happens next

1. The agent clones `~/telegate`, runs `npm run doctor -- --phone` and `npm test`, and finds your connected iPhone.
2. It gets a reachable HTTPS relay (your own, your Linux host, or a local relay behind a cloudflared quick tunnel) and confirms `/health` answers.
3. It writes `Config.local.xcconfig` with the relay address and a unique app ID, builds TelegateDIY, and installs it on the phone (falling back to a one-click Run in Xcode if command-line signing needs your Personal Team).
4. You create your Telegate account on the phone, save the recovery key, and add your OpenAI key in the app (it never leaves the phone).
5. The agent prints a pairing code; you enter it under **Computers -> +**, and it starts the companion that runs your harness.
6. You open **Call**, tap **Start talking**, ask for a tiny task in `~/telegate-test`, and read the result in **Tasks**.

## Renew after 7 days

A free Personal Team install expires seven days after it is built. Tell the agent "renew" (or press Run in Xcode again if that is how it was installed) to rebuild and reinstall with the same `Config.local.xcconfig`; the app ID and your data stay the same, so do not delete the app. On route C the tunnel hostname also changes whenever cloudflared restarts, which means updating the URL line in `Config.local.xcconfig`, rebuilding, and reinstalling.
