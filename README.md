# Telegate

**Pilot source — not yet deployed or verified on a physical iPhone.** See [verification](docs/VERIFICATION.md) and the [developer handoff](docs/BUILD-HANDOFF.md).

Native iPhone voice delegation, a Mac companion, and a per-account task relay. A user talks through a request, chooses a computer and harness, and sends a real task brief to that computer. Each user brings their own OpenAI project API key.

This is a separate product from Homies Voice. It does not change the existing Homies Voice deployment, its connector credentials, or its sharing settings.

## What is implemented

- SwiftUI iPhone/iPad app with account creation, login, recovery, deletion, and OpenAI key verification. The key is saved in the device’s Keychain and sent only to OpenAI.
- Native WebRTC microphone and speaker connection to GPT-Live, transcript events, client delegation, and GPT-5.6 Terra task brief preparation.
- A large Start/End call control, microphone-permission recovery, interruption handling, and graceful session close.
- A `Start voice chat` App Shortcut for Siri, Shortcuts, and an iPhone Action Button. The user assigns it in Settings; the app cannot change the hardware-button setting itself.
- Native **Telegate Connect** for Mac: name the computer, configure harnesses and work folders, show a pairing code, run/stop the connector, and optionally launch at login.
- Portable Node companion for macOS, Linux, and Windows-compatible command harnesses. It requires Node 24+ and installed, authenticated harness executables.
- Multiple users and computers; a one-time pairing code; independent, revocable device tokens; exact-device task routing; local execution without shell interpolation.
- Codex, Claude Code, locally configured command adapters, and HTTPS task-submission adapters. Cloud adapters require the provider to implement a compatible endpoint; adding a name alone does not create a Homies/Grokbot integration.
- Durable task IDs and outboxes, atomic claiming, heartbeat leases, explicit uncertain outcomes, and no automatic re-execution after a crash.
- Completion reporting from local harnesses and task-scoped callbacks from cloud harnesses. An encrypted APNs registration and durable push outbox notify the task owner without speaking or including work details on the lock screen.
- Tap a notification to review the result, choose **Read it to me**, or **Continue by voice**. Explicit follow-up work can resume the exact saved Codex/Claude session. Opening a result never submits a job by itself.
- Per-computer project scans: manual, every 5/15/30 minutes, every 1/3/6/12 hours, or daily. Folder sharing is enabled locally, per harness. A phone can change the interval but cannot add scan roots.
- Project snapshots fed into voice and brief preparation with timestamps. Scans collect folder name, Git branch, change count, latest commit subject and time. No file contents, diffs, filenames, repository remotes, or credentials are uploaded by the scanner.

## Open the apps

Requirements: Xcode with iOS 17+ SDK and a working simulator runtime, XcodeGen, Node 24+. Git is needed on companion computers for Git project metadata. Resolve the pinned WebRTC Swift package during the first build.

```sh
npm test
xcodegen generate
open Telegate.xcodeproj
```

Choose **Telegate** for iPhone/iPad or **TelegateConnect** for Mac. Debug builds default to `http://127.0.0.1:8790` for same-Mac development. On a real phone, use the HTTPS address of the deployed relay. Both apps expose a pilot service-address setting during setup. For a distributed release, set the `TELEGATE_SERVICE_URL` Xcode build setting to your deployed HTTPS origin.

Start the local service in a separate terminal:

```sh
npm start
```

It binds to loopback by default and stores data under `data/telegate.sqlite`. No OpenAI key belongs in the relay’s environment.

### First real-device trial

1. Deploy the relay over HTTPS (see [Release guide](docs/RELEASE.md)). Install a signed iPhone build and Telegate Connect on the computer.
2. On the phone, create an account and save its recovery key. Enter your own OpenAI key. Your OpenAI project must support `gpt-live-1` and `gpt-5.6-terra`.
3. On the computer, use the same relay address. Add Codex/Claude/custom harnesses; choose their existing executables and working folders. Authenticate each harness in its normal app/CLI first.
4. Enable **Share project context** only for the folders you want shared. Get a pairing code.
5. On the phone: **Computers → +**, enter the code, verify the computer’s name and harnesses, and connect it. Leave Telegate Connect running and the computer awake.
6. Choose the destination on the Call tab. Tap **Start talking** and grant microphone access. Ask for a small, observable task in a test project. Check the task in both Telegate and the actual harness.
7. In **Computers → Project awareness**, choose the scan frequency or request a scan. Confirm its timestamp, then ask about that project during a call.
8. Enable **Settings → Completion notifications** after the operator configures APNs. Finish a test task with the app backgrounded, tap the notification, and verify the result. Ask for a small follow-up and verify the original harness session resumes.
9. Configure **iPhone Settings → Action Button → Shortcut → Telegate → Start voice chat**. The shortcut foregrounds the app, checks setup, and starts voice. iPhone may require unlocking.

`Send when I ask` is enabled by default. Disable it in Settings to prepare drafts for review instead. Ending a call does not cancel tasks already submitted. Queued/draft tasks can be cancelled from Tasks; active work must be inspected in its harness.

### Terminal companion

```sh
npm run connect
npm run connect -- run
```

The setup wizard asks for the relay, computer name, harnesses, folders, and sharing preferences, then displays a phone pairing code. Its config and durable state live in `~/.config/telegate/` with restrictive file permissions. The native Mac companion keeps its device token in Keychain; the CLI uses its private config file. Do not copy one computer’s token to another: pair each separately.

For a Windows command provided as a `.cmd` wrapper, configure its underlying executable (for example `node.exe` with the CLI script argument) rather than enabling a shell. The Windows companion is source-compatible but still needs Windows platform verification.

## How it works

```mermaid
flowchart LR
  I[iPhone · key in Keychain] <-->|WebRTC audio and events| O[OpenAI GPT-Live]
  I -->|Same key · conversation and project context| P[OpenAI brief planner]
  I <-->|Account token · briefs and status| R[Telegate relay]
  M[Mac / laptop companion] -->|Device token · outbound HTTPS| R
  R -->|Only this device's queued work| M
  M --> H[Codex / Claude / configured harness]
  H -->|Result through companion or authenticated callback| R
  R -->|Completion alert · Apple Push| I
  I -->|Tap result · optional voice follow-up| O
  F[Locally enabled project folders] -->|Scheduled metadata scan| M
  M -->|Timestamped project snapshots| R
```

A task-submission endpoint starts work; the completion webhook reports its outcome later. The voice call can end while the harness continues. No voice session needs to stay open for completion: the relay stores the result and sends a normal push alert. The user chooses whether to read it, hear it, or discuss the next step. Local harness runs default to a four-hour limit, configurable up to 24 hours; cloud execution limits belong to the provider.

The timer runs in Telegate Connect, not in an OpenAI API key and not in iOS background scheduling. Local metadata scans make no OpenAI calls. The same user key powers voice and the planner’s interpretation of project context. A sleeping/offline computer cannot scan or execute tasks; its last-known snapshot remains marked with its scan time.

See [API contract](docs/API.md), [release and deployment](docs/RELEASE.md), and [verification record](docs/VERIFICATION.md).
