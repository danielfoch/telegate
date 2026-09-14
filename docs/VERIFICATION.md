# Verification record

Checked locally on 12 September 2026. This is a development installation, not a TestFlight-verified release. The entries below retain earlier audit evidence; the current combined readiness results are in [Tomorrow’s test](TOMORROW-READINESS.md).

| Check | Result |
| --- | --- |
| Relay + companion automated suite on macOS | **30 passed**, zero failures; repeated from a fresh GitHub clone |
| Prior baseline suite on Linux / Node 24 Alpine with Git installed in a disposable test container | **24 passed**, zero failures; the four new dashboard tests were run on macOS |
| Native iOS protocol tests | **5 passed per scheme**, zero failures for Debug and DIY on the iPhone 17 Pro simulator; DIY repeated from a fresh GitHub clone |
| Full native Mac application build | **Passed**, unsigned Debug build |
| Native Mac setup UI | Launched and visually inspected; no account pairing or real harness task submitted during this UI check |
| All iOS Swift source + pinned WebRTC framework | **Type checking passed**, with the iPhone Simulator SDK and arm64 iOS 17 target |
| Full iOS app build / simulator launch | **Passed** after the runtime installation finished |
| Dashboard design | Inspected on iPhone 17 Pro simulator using a labeled Debug-only fixture; all-time/seven-day switching verified. No sample metrics were written to an account. |
| Docker relay image | **Built successfully** |
| Fresh-clone Docker relay task round trip | **Passed**: health, account creation, pairing, exact-device dispatch, harmless Node execution, completion and dashboard counts through the container’s temporary loopback port. Test container and data removed. |
| Guided iPhone configuration | **Passed**: fresh-clone app’s compiled Info.plist contains the setup-generated HTTPS origin, unique app identifier and push flag `NO`. No local configuration copied from the working checkout. |
| Deployment Compose configuration | **Passed** with a fixture hostname; actual DNS/TLS deployment remains pending |
| Physical iPhone, live BYOK voice, Action Button, real APNs, real Codex/Claude run | **Not yet verified** |

## What the tests exercise

Account isolation, independent device credentials, pairing expiry and single use, exact-device routing, atomic claims, idempotent submission, leases, uncertain outcomes after interruption, revocation, account recovery/deletion, request limits, durable companion results, safe stdin task delivery, nonzero/empty/timeout results, explicit session resumption, opt-in project metadata, per-device scan settings, callback scope and duplicate handling, callback-before-acceptance ordering, encrypted push registrations, account switching, notification retries, and authenticated lookup of older tasks. New dashboard tests cover unique shipments, completion-only estimates, personal calibration, rolling windows, retry timestamps, totals beyond the latest-100 feed, opt-in aliases, private fields, tied ranks, opt-out and account deletion.

The local end-to-end harness test executes a harmless Node fixture, not Codex or Claude. APNs sender tests use a fake provider; Apple has not delivered a notification for this app. The Swift tests now run in the actual iOS simulator and check contract decoding, stable operation IDs, service URL constraints, Unicode-safe voice context bounds, and build-specific push availability; they do not substitute for iOS UI/audio tests.

The first Linux test attempt lacked the Git executable required by the project-scanner test fixture. Installing Git in the disposable test container produced the passing full run. The deployed relay image does not need Git; project scanning occurs on companions.

## Native build environment

Xcode at `/Applications/Xcode.app`, Swift 6.3.1, iOS/macOS SDK 26.4. The project targets iOS 17+ and macOS 14+. WebRTC is pinned to version 153.0.0 and its package is resolved in the Xcode project lock file.

This Mac's Xcode compiler-probing subprocess stalled with verbose stderr. A temporary local `CC` wrapper removed only the `-v` argument when probing predefined macros with `-E -dM`, then invoked the exact original Apple clang. The successful Mac and iOS builds used that wrapper. It is an environment workaround, not a source requirement and not bundled with the product.

The initial build was blocked while Xcode installed its simulator runtime. Installation has now completed: `iOS 26.4 (26.4.1 - 23E254a)` is available. Both the complete Debug app build and `xcodebuild test` succeeded against iPhone 17 Pro. The previous runtime blocker is resolved. No Apple signing-team choice or App Store configuration was changed.

The branded dashboard was inspected through a read-only Debug fixture labeled “Design preview · sample data.” The fixture uses the actual dashboard view and its period selector; production metrics use authenticated relay aggregates. The fixture is excluded from Release. The lower cards were present in the accessibility tree; a full physical-device layout and accessibility pass remains part of release acceptance.

## Fresh-clone Community check

Cloned public GitHub commit `eff948a` into a new temporary checkout. Ran the 30 Node tests, environment doctor, generated a private config with a fixture HTTPS hostname and unique identifier, and built/tested TelegateDIY with clean derived data. The build reused the pinned WebRTC package cache but no application build products or user configuration. All five iOS tests passed. The full Debug scheme also passed its five tests.

Built the Docker image from this clone and exercised a synthetic task through an actual container on loopback. This invoked a harmless local Node fixture only; it did not invoke OpenAI, Codex, Claude, or a cloud harness. It verifies the relay/companion boundary, not public HTTPS or cellular access.

App Intents metadata was generated during the build. The unsigned simulator test host logged a shortcut metadata refresh error (`No app shortcuts provider mangled type name in bundle`); shortcut discovery and Action Button behavior remain unverified and require a signed physical-device check.

## Required release acceptance

Use [RELEASE.md](RELEASE.md) for physical-device and cross-network checks. A public HTTPS relay, selected Apple team, signed application/provisioning profiles, are still required. APNs credentials are additionally required for the full push-enabled build; TelegateDIY intentionally omits APNs. The optional [Grok Bot adapter](integrations/GROKBOT.md) has automated relay/transport tests; its live routine execution and callback still need acceptance against a public host. Homies requires its own provider integration.


## Grok Bot adapter (2026-09-12)

- All 39 Node tests passed locally, including 8 new adapter integration tests and the companion cloud-envelope test. The relay/runner/connector/setup subset also passed on Node 24 Alpine (37 tests); the Git project-scan tests run on the Mac because the minimal relay image does not include Git.
- Telegate Connect builds successfully with the new Grok Bot preset; Docker image builds with the adapter included.
- An isolated relay and temporary HTTPS tunnel submitted one harmless task through the real companion cloud runner to a dedicated Clydesdale webhook routine. Grok received the task and prepared its completion callback. Its automatic approval review held the outbound callback for user approval because of the temporary tunnel hostname. Receipt is verified; a live completed result, real phone voice and APNs delivery are not claimed.
- Permanent hosting, a stable callback hostname, companion configuration and provider approval remain deployment prerequisites. No OpenAI key or business task was used for this integration test.

## OpenClaw and Hermes adapters (2026-09-12)

- All 46 Node tests passed locally. The 44-test relay/companion/setup subset passed in Node 24 Alpine; Git project scans remain covered on the Mac.
- Real subprocess fixtures exercise OpenClaw private-file input, isolated sessions, exact follow-ups, Hermes stdin and older literal-argument input, session footers on both streams, incompatible CLIs, incomplete/error output, cancellation, and task-file cleanup. Both new kinds were paired and executed through the actual relay/connector loop.
- Telegate Connect builds successfully with both preset buttons, picker entries, OpenClaw agent selection and the bundled adapter module.
- The locally installed older Hermes CLI passed capability detection. A harmless live check found an existing provider URL made entirely of terminal arrow-key escape sequences. The malformed overrides were backed up and removed, preserving the existing provider/model/credentials; a second check timed out after 90 seconds with no final answer and correctly returned needs_attention. A successful real Hermes model run is not claimed.
- OpenClaw is not installed on the development Mac; its command contract was checked against official docs/source and subprocess fixtures. A real gateway/model acceptance run remains required. Telegate does not silently install or upgrade either harness.

## Connect interface and pairing recovery (2026-09-12)

- Mac build passed; all 46 Node tests passed. The native window was visually checked with agent icons, pairing controls and the settings/editor sheets. Agent save, cancelled addition, invalid service validation and configuration rollback were exercised in the running app.
- A legacy configuration without timeout/agent-ID fields was decoded and round-tripped through the current Swift model, preserving three agent IDs, project sharing and the service URL. The rebuilt app displayed all three entries and saved them successfully.
- The failed pairing setup pointed at a loopback port with no relay listening. Starting a relay and exposing a temporary HTTPS tunnel restored `/health` and native pairing-code creation. This is a development recovery, not evidence of permanent hosting or a completed physical-phone pairing.

## Landing page and guided install prompt (2026-09-12)

- Added an animated, responsive marketing page with local optimized artwork/fonts, selectable voice examples, copyable installation prompt, phone illustration, and agent routing map. Motion can be paused and honors reduced-motion preferences.
- Site static build, TypeScript check and lint passed. Prompt text is byte-matched between the site, plain-text prompt and GitHub guide; local integration/installation links resolve to files in the repo. Browser interaction/visual acceptance was not run in this pass.
- The one-shot prompt starts a guided agent installation. Its procedure requires actual signed device installation and launch evidence before claiming success and calls out Apple sign-in/trust/Developer Mode, relay availability, BYOK and free-profile renewal. A clean-machine physical-iPhone run of this new guide has not been verified.
- Cloud provider requirements are explicit: Grok Bot needs the relay adapter/routine/callback, and HomiesAI needs a compatible provider endpoint. ChatGPT voice helps plan; it is not represented as a standalone task-submission harness.

## Combined tomorrow-readiness audit (late September 12, 2026)

- 52 relay/connector/setup tests pass on macOS and Node 24 Alpine with Git installed. Eight signed simulator tests pass, including actual Keychain operations and delivery concurrency/account-change protection.
- Signed simulator account setup and a complete text-task round trip were exercised against an isolated fixture relay. Real Codex and Claude initial requests, exact-session resumption, file creation and follow-up editing were verified in disposable folders. Claude needed the concurrent automatic-approval implementation for its editing test to pass.
- The combined Mac app builds, passes signature validation and is copied to Daniel’s Applications folder. The combined development-signed iPhone app is installed on the connected physical phone. Apple blocked first launch because the phone is locked. No microphone, live BYOK, Action Button or APNs acceptance is claimed.
- The active launchd relay and public tunnel are healthy. The revised helper was exercised with isolated process/network fixtures: it only publishes a healthy address, returns failure for an unhealthy relay and clears the address on shutdown.
- Landing-page dependency updates pass static build/lint/types and report zero known npm advisories. Browser navigation failed in the headless daemon, so final website visual acceptance remains pending.
- Changes were combined in an isolated worktree while Claude continued editing the primary checkout. See the current checklist for installation paths, limitations and required first-call tests.

## Concurrent Claude test-day record (2026-09-12, evening)

- Node suite: **47 passed** (one new companion test for the approval-policy arguments). iOS protocol tests: **5 passed** on the DIY scheme in the iPhone 17 Pro simulator. Debug iOS simulator build, TelegateConnect Debug build and the signed TelegateDIY device build all succeeded.
- OpenAI contract re-checked against the current developer docs: `gpt-live-1` and `gpt-5.6-terra` exist; `POST /v1/live/sessions` with `transport.type = webrtc`, the `oai-events` data channel, `session.delegation.created` with `delegation.target = client`, and the `session.commentary.append` / `session.thinking.append` client events (500 tokens per append) match the app. Startup `input` items now carry the documented `"type": "message"`. Voice `marin` is the documented default. No OpenAI key was used; the live voice path on a physical phone is still unverified.
- Harness CLIs on this Mac: the Codex npm package had lost its platform binary (`codex --version` failed with ENOENT); reinstalled `@openai/codex` 0.154.0 and a harmless read-only `codex exec --json` returned the expected text. Claude Code 2.1.261 answered a harmless `--print --output-format stream-json --permission-mode auto` prompt with `permission_denials: []`. The companion now passes `--permission-mode auto` (or the Connect **Approvals** choice) to Claude Code and `--skip-git-repo-check` to Codex so a non-Git work folder no longer fails. Hermes v0.8.0 (no `--query-file`) passed the capability probe only; OpenClaw is not installed.
- Same-Mac test relay: `scripts/local-relay.sh` runs the relay behind a Cloudflare quick tunnel under launchd; `/health` verified locally and through the tunnel, and the stack survived a restart. The address is temporary and changes on restart; both apps can now take a new address without re-pairing.
- Simulator UI pass with a throwaway account and a harmless echo "computer": onboarding (address prefilled from the build), create account through the tunnel, sign in, dashboard, call screen with destination status, computers, tasks with status badges, task detail, settings, and the service-address sheet were exercised and screenshotted; the throwaway account, device and tasks were deleted afterwards (relay tables empty). Voice and brief planning were not exercised (no key).
- Found and fixed: unsigned simulator builds fail every Keychain call with -34018, which made account creation look broken in the simulator; `SecureStore` now has a simulator-only fallback and a clearer device error. Sign-out could dead-end when the relay was unreachable; it is now best-effort and always clears local credentials.
- Physical iPhone: the signed DIY build with the current relay address was installed over USB (launch requires the phone to be unlocked). Voice, Action Button, and a real Codex/Claude run from the phone remain to be checked by hand.

The subsequent combined build keeps actual Keychain storage in the simulator and uses ad-hoc signing; the plaintext simulator fallback above was superseded after all eight Keychain/delivery/protocol tests passed without it. The updated combined test counts and acceptance record take precedence over earlier baseline counts.

## One-hour integration follow-up (September 12, 2026, after 23:23 Eastern)

- Preserved Claude’s `d497e63` commit, merged both histories as `171cbae`, fast-forwarded the clean primary checkout, and restarted its launchd relay with the combined server fixes. Local and public health checks pass.
- Through the real public HTTPS relay: disposable account creation and pairing, Codex and Claude task delivery, file creation in non-Git folders, exact-session follow-up edits, completed results and account cleanup all pass. Artifacts were read and verified. The disposable account, tasks, device and folders were removed.
- Linux Chromium visually inspected the landing page and tested widths 320/390/768/1440/1920, every example selector and routing card, real clipboard copy, pause/play and image decoding. No overflow, broken images or script errors remain. Replaced a redirect-text Homies image with the actual PNG and replaced the platform-dependent Hermes text glyph with a licensed local vector outline. This supersedes the earlier browser-daemon failure; the published website has not been redeployed.
- Repeated the eight native tests after merging the UI polish; they pass. Updated native bundles build and the final iPhone bundle’s HTTPS service address is verified. The Mac and phone are still locked, so live native interaction, audio and BYOK acceptance remain blocked pending the user.

## Spoken hang-up phrase and Connect redesign (September 13–14, 2026)

- **Telegate Connect redesign** (commit dc23bdc): unsigned Debug Mac build passes; every `--render-preview` screen renders in light and dark, including `main-reopen` and `main-reopen-scene`, which prove the main window comes back after being closed. 52 relay/companion Node tests pass. The redesigned app is installed in `~/Applications` and running; pairing from the phone has not been repeated since the keychain removal.
- **Spoken hang-up phrase** (iOS): `HangUpPhrase` matching and the settle-then-judge path in `VoiceSession` (the user's utterance is judged 0.8 s after its last transcript fragment, so a sentence that merely contains the phrase does not hang up) are covered by 8 new XCTest cases (17 iOS tests pass on the DIY scheme, iPhone 17 Pro simulator). The Settings section was inspected in the simulator with the Debug-only `--ui-preview-signed-in` launch argument (a placeholder login the relay rejects; no account or key involved). **Not yet verified:** a live GPT-Live call ending on the phrase on a physical iPhone, and the model staying silent as instructed. Check by starting a call, saying “end call”, and confirming the call ends within a second and the Call tab shows “Call ended by your hang-up phrase.”
