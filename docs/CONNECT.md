# Telegate Connect for Mac

Keep Connect running on the Mac that will do the work, then send ideas from Telegate on your phone.

## The window

One screen. The toolbar shows the connector status (Running, Paused, Pairing, Not paired, Needs setup, Needs re-pair), a **Pause / Resume** button (⌘R), an **Add Agent** menu (⇧⌘N) and **Settings** (⌘,).

- **Computer block.** Your Mac’s name, what the connector is doing, and the relay address with a copy button and an **Edit** link. A temporary tunnel address (`*.trycloudflare.com`) is flagged in orange: it changes when the tunnel restarts, so update it here and in the phone’s Settings.
- **Agents.** Each agent is a row with a switch, its folder (or endpoint host) and, for Codex and Claude Code, the approval mode. Double-click or press **Edit** to configure; right-click for Turn On/Off, Reveal Folder, Remove. **Check Setup** (⇧⌘K) asks each agent’s CLI whether it is installed and reports the relay’s health; the badges clear on the next change.
- **Footer.** Open at Login, the Activity window (⇧⌘L) and Help.

Agent changes (adding, editing, switching, reordering) only save; the connector re-reads its configuration on every check-in, so a task in flight is never interrupted. Changing the relay address or the Node path restarts the connector if it is running. Renaming the Mac is sent on the next check-in. Saving while paused stays paused; a change made while the connector is still stopping takes effect on the next Resume.

## Pairing

1. In **Settings › Connection**, enter your relay’s HTTPS address and press Apply. The relay must already be running; Connect does not host it.
2. Press **Pair Phone…** in the computer block. On your phone open **Computers → Add Computer**, enter the code, and confirm this Mac’s name. Codes expire after ten minutes; **Copy Code** and **Copy Relay Address** are next to the code.
3. Connect starts the connector as soon as the phone approves. Leave it open and your Mac awake; the phone’s Computers list shows when this computer is online.

The pairing token lives in Connect’s private config file (`~/Library/Application Support/Telegate/computer.json`, mode 0600), not the macOS keychain. Revoking the computer from the phone invalidates it. If a build ever cannot read its token, the window says so and offers **Re-pair This Mac**; **Unpair** is in Settings › Connection.

## Agents

**Add Agent** lists Codex, Claude Code, OpenClaw, Hermes Agent, Grok Bot and Other. Local agents use their existing installation and login: choose the executable (found automatically), a project folder, whether to share that folder’s name, branch, change count and latest commit subject with voice, and for Codex and Claude Code an approval mode. Advanced holds the executable path, the OpenClaw agent ID, custom arguments for a command adapter, and the time limit. Grok Bot and other HTTPS endpoints need a URL and key.

Selecting an agent does not install it or prove its credentials work; send a small test task from the phone.

## Menu bar

The menu bar item mirrors the status: pause or resume the connector, toggle agents, copy the service address, run Check Setup, open the window, Activity or Settings, and quit. Quitting stops the connector first.

## If pairing cannot reach the server

- Verify your relay is running and its `/health` endpoint responds over HTTPS.
- `127.0.0.1` and `localhost` mean the device you are using. An iPhone cannot reach your Mac through its own localhost address.
- Use one reachable HTTPS service address on both devices.
- A temporary tunnel is fine for a development check. Keep its relay and tunnel processes running; the hostname may change after a restart. See [self-hosting](SELF-HOST.md).

Icons identify the available integrations. See [icon sources and licenses](HARNESS-ICON-NOTICES.md).

## Design previews

Debug builds accept `--render-preview <screen> <file.png> [--dark]` to capture a screen with in-memory fixtures (nothing is saved and the connector does not start): `main`, `main-setup`, `main-unpaired`, `main-pairing`, `main-paused`, `main-noagents`, `main-repair`, `main-error`, `main-restarting`, `main-checked`, `main-empty`, `editor`, `editor-openclaw`, `editor-webhook`, `editor-custom`, `add`, `main-reopen` and `main-reopen-scene` (close the window, then bring it back the way the menu bar item does: re-showing the retained window, or File > New Window once AppKit has released it), `settings-general`, `settings-connection`, `settings-advanced`, `activity`, `activity-host`, `menubar`. Set `TELEGATE_TEST_CONFIG` to a config file to render against fixture data.
