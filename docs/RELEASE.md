# Release and distribution

For the community clone-and-install route, start with [SELF-HOST.md](SELF-HOST.md) and [DIY-IPHONE.md](DIY-IPHONE.md). **TelegateDIY** omits APNs and supports in-app completion results; the Apple push and distribution steps below apply to the full build.

## Cloud relay

The relay is deployable to a persistent Linux/Docker host. It is a single service using SQLite WAL, with a persistent `/data` volume. Do not place the database in ephemeral serverless storage or run independent replicas against separate database files. Back up the database using SQLite’s backup API or stop the service before a filesystem backup; retain the WAL correctly.

On a host with Docker and a hostname you control:

```sh
node scripts/deploy-setup.mjs
docker compose up -d --build
```

The setup wizard writes a private `.env` with the hostname, callback signing secret, and push-token encryption key. Preserve these secrets with your database backups; do not commit the `.env` file. Caddy obtains HTTPS certificates and reverse-proxies the relay. Point DNS to the server first and permit inbound TCP 80/443. The relay port itself is not published. Users create their own accounts without an invitation code. No OpenAI API key is required on the server.

Before inviting users, verify `/health` over the actual HTTPS origin, register a test user, pair a test companion over a different network, and complete a harmless task. Configure backups, operational monitoring, and signup controls appropriate to the audience. The app’s account recovery is key-based, not email-based; if public launch requires email verification, add an identity provider or verified-email flow before removing the pilot gate.

## Apple Push notifications

Create an APNs signing key in the selected Apple Developer team, enable Push Notifications for the iOS app identifier, and use a provisioning profile with that capability. Keep the private `.p8` file outside this repository. Add these values to the private `.env` created by the deployment wizard:

- `APNS_KEY_ID`: Apple signing key ID.
- `APNS_TEAM_ID`: the team that owns the iOS application identifier.
- `APNS_BUNDLE_ID`: the exact signed iOS bundle identifier (default `app.telegate.ios`).
- `APNS_P8_PATH`: an absolute host path to the private `.p8` file.

Then deploy with the secret mount:

```sh
docker compose -f compose.yaml -f compose.push.yaml up -d --build
```

The APNs key must authorize the chosen app topic and environment. Debug builds use sandbox/development; TestFlight and release builds use production. The current sender has one configured signing key; if your team uses separate environment-specific keys, use separate relay environments or extend the sender configuration before mixing builds. Without configured APNs credentials and the encryption key, the app clearly reports that push is not configured; task results remain available in Tasks.

The outbox retries failed sends up to ten times, with exponential backoff capped at one hour. Monitor failed rows; retain the encryption key to read existing token registrations. Users must opt in through iOS notification permissions. This build has no paid notification service dependency beyond your Apple account and host.

## Apple signing

Open `Telegate.xcodeproj` and choose the correct Apple Developer team for **both** application targets. Register unique bundle identifiers for your team if `app.telegate.ios` / `app.telegate.connect` are already reserved. Run `npm run setup` to set your HTTPS origin, unique identifiers and optional team in ignored `Config.local.xcconfig`, shared across build configurations.

The iOS app is native SwiftUI with the pinned WebRTC XCFramework, not a WebView. The app has microphone usage text, audio background mode for an active user-started call, App Shortcuts metadata, a deep link (`telegate://call`), a privacy manifest, an app icon, account deletion, and a recovery flow.

Build an Archive for a physical iOS device, validate it with Xcode Organizer, then upload through App Store Connect for TestFlight. Distribution requires the account’s signing/provisioning setup and an App Store Connect app record. A simulator `.app` or unsigned compile is not a TestFlight installation.

For the Mac companion, archive with Developer ID signing and hardened runtime, notarize the exported app, and staple the notarization ticket before sharing outside development. It is intentionally outside the Mac App Store sandbox because it launches the user’s installed harness executables. Node 24+ must be installed; the pilot does not bundle a Node runtime. Configure each harness’s existing CLI login and working directory locally. The user can enable launch-at-login; the computer still needs to be awake.

## Action Button

Users assign **Settings → Action Button → Shortcut → Telegate → Start voice chat** on supported iPhones. Apps cannot programmatically remap the hardware button. The shortcut brings Telegate to the foreground, then starts voice after account/key/destination setup. It cannot bypass lock-screen authentication or microphone consent. First-time setup should be completed before using the shortcut hands-free.

This build uses a foreground App Intent. It does not claim a background `AudioRecordingIntent` entitlement/Live Activity workflow. Audio background mode allows an already-started WebRTC call to continue subject to iOS audio-session policies; interruptions end the app’s voice session and leave submitted tasks intact.

## Real-device acceptance

Test the following on an actual iPhone and actual remote computer before calling the product ready for users:

1. Fresh install; account creation and recovery key; invalid/valid OpenAI keys; project model access and billing errors.
2. Microphone deny, then allow from Settings; first spoken input; audible reply; headset/car Bluetooth routing; interruption by a phone call.
3. Action Button from an unlocked and locked phone; no duplicate calls on repeated actions; End stops microphone capture.
4. Phone on cellular with the companion on another network. Pair two computers and verify a task reaches only its selected destination.
5. Actual Codex and Claude CLI authentication, installed-version compatibility, working folder selection, and native session visibility. Other command/cloud adapters need provider-specific acceptance.
6. Disconnect a device during a task; lose Wi-Fi after submission; restart the companion with a pending result; ensure no duplicate execution.
7. Enable one project folder and leave another private; change the scan interval; request an offline scan; resume after sleep; verify context timestamps in voice.
8. For DIY, verify completed results after reopening/refreshing Tasks and no request for remote notifications. For the full build: real APNs completion while the app is backgrounded and terminated; notification tap opens the correct owned task; lock screen does not reveal work contents; denied notifications still leave results in Tasks. Test callback retries and failure alerts.
9. Read a result aloud, discuss it, and explicitly request follow-up work. Verify the exact Codex/Claude session resumes; merely opening or reading a result must create zero new tasks.
10. Dynamic Type, VoiceOver, small phone, landscape, and iPad layouts; account deletion and sign-out; secure key persistence and removal.

11. Compare account dashboard totals across phones; verify draft/send/cancel/completion counts, adjustable estimates, and rolling seven-day totals. Join the community board under a separate alias, confirm private details are absent, then opt out. Test large text and scrolling through every dashboard card.

## Sources checked during implementation

- [GPT-Live getting started](https://developers.openai.com/api/docs/guides/live)
- [GPT-Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
- [Client delegation and reference context](https://developers.openai.com/api/docs/guides/live-delegation)
- [Session history, context appends, and storage](https://developers.openai.com/api/docs/guides/live-conversations)
- [Apple push registration](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns)
- [APNs token authentication](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)
- [Apple AppShortcutsProvider](https://developer.apple.com/documentation/appintents/appshortcutsprovider)
- [Apple foreground App Intent behavior](https://developer.apple.com/documentation/appintents/appintent/openappwhenrun)
- [Pinned community WebRTC binary distribution](https://github.com/stasel/WebRTC/tree/153.0.0)

The working name is **Telegate**, explicitly chosen by Daniel. No domain was purchased or connected.
