# Verification record

Checked locally on 12 September 2026. This is a native pilot source implementation, not a deployed or TestFlight-verified release.

| Check | Result |
| --- | --- |
| Relay + companion automated suite on macOS | **28 passed**, zero failures |
| Prior baseline suite on Linux / Node 24 Alpine with Git installed in a disposable test container | **24 passed**, zero failures; the four new dashboard tests were run on macOS |
| Native iOS protocol tests | **4 passed**, zero failures on the iPhone 17 Pro simulator |
| Full native Mac application build | **Passed**, unsigned Debug build |
| Native Mac setup UI | Launched and visually inspected; no account pairing or real harness task submitted during this UI check |
| All iOS Swift source + pinned WebRTC framework | **Type checking passed**, with the iPhone Simulator SDK and arm64 iOS 17 target |
| Full iOS app build / simulator launch | **Passed** after the runtime installation finished |
| Dashboard design | Inspected on iPhone 17 Pro simulator using a labeled Debug-only fixture; all-time/seven-day switching verified. No sample metrics were written to an account. |
| Docker relay image | **Built successfully** |
| Docker relay health over a temporary loopback port | **HTTP 200**, then the test container was stopped |
| Physical iPhone, live BYOK voice, Action Button, real APNs, real Codex/Claude run | **Not yet verified** |

## What the tests exercise

Account isolation, independent device credentials, pairing expiry and single use, exact-device routing, atomic claims, idempotent submission, leases, uncertain outcomes after interruption, revocation, account recovery/deletion, request limits, durable companion results, safe stdin task delivery, nonzero/empty/timeout results, explicit session resumption, opt-in project metadata, per-device scan settings, callback scope and duplicate handling, callback-before-acceptance ordering, encrypted push registrations, account switching, notification retries, and authenticated lookup of older tasks. New dashboard tests cover unique shipments, completion-only estimates, personal calibration, rolling windows, retry timestamps, totals beyond the latest-100 feed, opt-in aliases, private fields, tied ranks, opt-out and account deletion.

The local end-to-end harness test executes a harmless Node fixture, not Codex or Claude. APNs sender tests use a fake provider; Apple has not delivered a notification for this app. The Swift tests now run in the actual iOS simulator and check contract decoding, stable operation IDs, service URL constraints, and Unicode-safe voice context bounds; they do not substitute for iOS UI/audio tests.

The first Linux test attempt lacked the Git executable required by the project-scanner test fixture. Installing Git in the disposable test container produced the passing full run. The deployed relay image does not need Git; project scanning occurs on companions.

## Native build environment

Xcode at `/Applications/Xcode.app`, Swift 6.3.1, iOS/macOS SDK 26.4. The project targets iOS 17+ and macOS 14+. WebRTC is pinned to version 153.0.0 and its package is resolved in the Xcode project lock file.

This Mac's Xcode compiler-probing subprocess stalled with verbose stderr. A temporary local `CC` wrapper removed only the `-v` argument when probing predefined macros with `-E -dM`, then invoked the exact original Apple clang. The successful Mac build used that wrapper. It is an environment workaround, not a source requirement and not bundled with the product.

The initial build was blocked while Xcode installed its simulator runtime. Installation has now completed: `iOS 26.4 (26.4.1 - 23E254a)` is available. Both the complete Debug app build and `xcodebuild test` succeeded against iPhone 17 Pro. The previous runtime blocker is resolved. No Apple signing-team choice or App Store configuration was changed.

The branded dashboard was inspected through a read-only Debug fixture labeled “Design preview · sample data.” The fixture uses the actual dashboard view and its period selector; production metrics use authenticated relay aggregates. The fixture is excluded from Release. The lower cards were present in the accessibility tree; a full physical-device layout and accessibility pass remains part of release acceptance.

## Required release acceptance

Use [RELEASE.md](RELEASE.md) for physical-device and cross-network checks. A public HTTPS relay, selected Apple team, signed application/provisioning profiles, and APNs credentials are still required. Homies/Grokbot's provider-side task endpoint and callback integration are a separate team implementation, described in [API.md](API.md).
