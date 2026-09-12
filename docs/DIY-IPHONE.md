# Put Telegate Community on your iPhone

**Free to self-host. Your infrastructure. Your API key.** This is a developer preview for people comfortable with Xcode and Docker. The App Store convenience edition is planned, not available yet.

## What you need

- A Mac with Xcode and its iOS platform installed, Git, and Node 24+.
- Your iPhone (iOS 17+) and a USB cable for the first install.
- An Apple Account signed into Xcode. A free Personal Team can be used for the DIY build.
- Your own reachable HTTPS relay, following [SELF-HOST.md](SELF-HOST.md).
- Your own OpenAI project key with access to the voice and planner models. API usage is billed by OpenAI; it is not included with the free source.

The **TelegateDIY** scheme omits the APNs entitlement and disables remote push registration. Work still runs after you end a call, and results appear in **Tasks** when you reopen/refresh the app. The full **Telegate** scheme retains push support for users with the required Apple developer signing and APNs setup. Neither scheme includes a paid Telegate feature gate.

## 1. Clone and check your Mac

```sh
git clone https://github.com/danielfoch/telegate.git
cd telegate
npm run doctor -- --phone
npm run setup
open Telegate.xcodeproj
```

The setup asks for your relay’s HTTPS origin and an optional Apple team ID. It creates an ignored `Config.local.xcconfig` with a unique app identifier, shared by both native apps. It never asks for an OpenAI key. If you don’t know your team ID, press Return and choose your team in Xcode. Rerunning setup will not overwrite your existing configuration or app identity.

The generated Xcode project is committed: XcodeGen is needed only when changing `project.yml`. Resolve the pinned WebRTC package when Xcode prompts. `npm install` is not needed; the Node service has no third-party runtime dependencies.

## 2. Install with Xcode

1. Sign into **Xcode → Settings → Apple Accounts** with your Apple Account.
2. Connect and unlock the iPhone; accept **Trust This Computer** if prompted.
3. Choose scheme **TelegateDIY** and your physical iPhone as the run destination.
4. Select the **Telegate** target → **Signing & Capabilities**. Keep automatic signing enabled and select your Personal Team if setup did not set one. Build configuration must be **DIY**. Do not add Push Notifications to this scheme.
5. If Xcode asks for Developer Mode, follow its instructions on the iPhone, including the restart and on-device confirmation. The setting is under **Settings → Privacy & Security → Developer Mode** when available.
6. Press **Run**. Complete any device trust/developer confirmation that Xcode requests.

Apple’s free Personal Team provisioning expires after **seven days**. Rebuild/reinstall from Xcode when it expires, using the same app identifier. This is a development installation, not a permanent App Store install. Keep the same checkout and local configuration; avoid deleting the app as a way to renew signing because that can remove local data.

Apple references: [run on a physical device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).

## 3. Pair a computer and delegate

1. On the phone, create an account on your own relay using the invitation code generated on the server. Save its recovery key. Add your OpenAI key in the native app.
2. In Xcode, choose **TelegateConnect → My Mac → Run**, or use `npm run connect` on a supported computer. Both apps use the HTTPS origin you configured. Set up your installed, authenticated Codex/Claude/custom harness and its work folder.
3. Get a pairing code on that computer. In the iPhone app, open **Computers → +**, enter the code, verify the device identity and approve it. Pair additional computers separately; do not copy connector tokens.
4. Choose a destination and start a voice call. Grant microphone access, discuss a small test request, and explicitly ask to delegate it. Wait for the app to confirm it was queued.
5. End the call. Open **Tasks** later to read the result or start a follow-up conversation. The DIY build does not alert you in the background.
6. If desired, assign **iPhone Settings → Action Button → Shortcut → Telegate → Start voice chat**. The app cannot assign the hardware button itself. Complete setup and microphone permission before using the shortcut.

Leave the executing computer awake with its companion running. The phone can then operate on another network, including cellular, as long as both devices can reach the relay. Voice also needs a working internet connection to OpenAI. Computers do not need inbound ports; the companion makes outbound HTTPS requests.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Signing complains about push capabilities | Confirm **TelegateDIY / DIY**, not Debug or Release. DIY uses `ios/TelegateDIY.entitlements`, which has no APNs entitlement. |
| Bundle identifier is unavailable | Use `npm run setup` to generate an identifier, or edit `TELEGATE_APP_ID` in the ignored config to a unique reverse-DNS identifier. |
| Phone cannot reach the service | `127.0.0.1` on a phone means the phone. Use your relay’s valid HTTPS hostname; verify DNS, certificate and firewall from another network. |
| No notification arrives | Expected in DIY. Results are in Tasks. See [RELEASE.md](RELEASE.md) for the full APNs build. |
| App stops opening after a week | Renew your free Personal Team installation by running it from Xcode again. |
| Device is not listed | Unlock, trust, reconnect, and inspect Xcode’s Devices/Device Hub. An unavailable paired device cannot be installed to. |
| Project regenerating removed a setting | Put local host, app ID and team values in `Config.local.xcconfig`, which the committed configs include optionally. |

For actual acceptance status, see [VERIFICATION.md](VERIFICATION.md). Simulator builds and synthetic relay checks do not prove physical-phone voice or remote-network operation.
