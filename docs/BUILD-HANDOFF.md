# Telegate pilot handoff

## Community launch path

Ship the free MIT self-hosted developer preview first; a managed App Store edition is planned later. `npm run doctor`, `npm run deploy:setup` and `npm run setup` guide environment, relay and iPhone configuration. The committed **TelegateDIY** scheme removes APNs signing requirements and shows in-app completion updates. Personal Team installs require seven-day renewal. The full **Telegate** scheme keeps optional open-source APNs support. Start with [DIY-IPHONE.md](DIY-IPHONE.md); distribution positioning is in [ROADMAP.md](ROADMAP.md).

## Brand and account progress

Telegate now centers on **More life. Less screen.** The default account dashboard shows real lifetime and last-7-days shipments/completions, personal completion milestones, and clearly labeled estimated hours using a user-adjustable baseline. An optional, initially private community leaderboard uses chosen aliases and shipped counts. See [BRAND-AND-METRICS.md](BRAND-AND-METRICS.md) for copy, calculation rules and privacy boundaries.

## Product flow

1. User creates a Telegate account, saves their recovery key, and verifies their own OpenAI project key on their iPhone.
2. They install Telegate Connect on each computer, choose locally authenticated harnesses and work folders, and pair each computer to that account. No router port forwarding is required: companions use outbound HTTPS.
3. They optionally enable metadata sharing for chosen work folders and set a scan interval from the phone. A companion performs the scan; OpenAI interprets the resulting context during voice and brief preparation.
4. They start a call from the large button or their assigned Action Button shortcut. They workshop the request and explicitly ask Telegate to delegate it.
5. The app prepares a self-contained brief and submits it with a stable operation ID to the selected computer/harness. Review-first mode creates a draft instead.
6. The computer claims and executes work. The user can end the call or leave the app. The task persists independently of that call.
7. A local result or authenticated cloud completion callback updates the task. In a configured full build, the relay queues a normal Apple push alert for the owner’s registered phones.
8. A notification tap opens the task result. Only a subsequent **Read it to me** or **Continue by voice** action opens the microphone. Explicit further work becomes a linked follow-up, resuming the saved Codex/Claude session where supported.

## Boundaries

- OpenAI receives audio, conversational context, and brief-planning requests directly from the iPhone using the user’s own key. Telegate’s relay never stores that key.
- The relay stores account credentials in derived form, computer identities, task briefs/results, project metadata, and encrypted APNs registrations. Protect the host and its backups accordingly.
- A project snapshot is dated metadata, not a live inspection of source code. Only the companion can opt in folders. Scanning has no model-call cost; voice and planner requests use the user’s OpenAI billing.
- The Mac app is a companion, not a remote desktop. Harnesses execute with their installed permissions and authentication. Sleep, local prompts requiring interaction, and missing CLI credentials can prevent progress.
- Cloud submission currently passes through a configured computer adapter. The cloud job can continue and call back after that computer goes offline. Direct account-level cloud connections without any companion are a future adapter extension.
- The HTTP submission request starts work; the webhook reports completion. Homies/Grokbot’s provider-side task endpoint and completion integration still need to be built by their team, using [API.md](API.md).
- The pilot does not persist an entire voice-chat archive. Follow-up conversations receive the previous task’s brief/result and current project snapshots; Codex/Claude retain execution history in their own resumed sessions.

## Release work requiring operator configuration

DIY needs an HTTPS relay, Personal Team signing, and physical-device acceptance; APNs is optional. For the full distribution build: select the Apple Developer team and final bundle identifiers; provision Push Notifications and provide its private APNs signing key; deploy the relay on a persistent HTTPS host; set the release service URL; archive/sign for TestFlight; sign and notarize the Mac companion. No domain purchase or deployment has been performed.

Then run the physical-device acceptance cases in [RELEASE.md](RELEASE.md). Do not advertise tested iPhone voice, Action Button, car Bluetooth, actual APNs delivery, or installed harness session visibility until those checks pass. [VERIFICATION.md](VERIFICATION.md) records what has actually been checked locally.

## Source map

| Area | Entry points |
| --- | --- |
| Dashboard, estimates and community leaderboard | `ios/Telegate/DashboardView.swift`, `relay/metrics.mjs` |
| iPhone UI/onboarding | `ios/Telegate/TelegateApp.swift` |
| Conversation and delegation coordination | `ios/Telegate/AppModel.swift` |
| Native GPT-Live WebRTC | `ios/Telegate/VoiceSession.swift` |
| Structured task planning | `ios/Telegate/BriefPlanner.swift` |
| App Shortcut and push handling | `ios/Telegate/Shortcuts.swift`, `Notifications.swift` |
| Native Mac setup/Keychain/start at login | `mac/TelegateConnect/ConnectApp.swift` |
| Pairing, polling, durable local state | `companion/client.mjs` |
| Harness command/cloud adapters | `companion/runner.mjs` |
| Project scan scheduler and collector | `companion/projects.mjs` |
| Auth, routing, callbacks, notification outbox | `relay/server.mjs` |
| APNs authentication and encrypted tokens | `relay/push.mjs` |
| Repeatable Xcode project configuration | `project.yml` |
| HTTPS deployment and push secret mount | `compose.yaml`, `compose.push.yaml` |
