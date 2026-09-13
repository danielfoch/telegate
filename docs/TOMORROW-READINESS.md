# Tomorrow's Telegate test

Readiness audit started September 12, 2026. This document records evidence, not a guarantee that untested hardware or provider integrations work.

## First test

1. Use the latest **TelegateDIY** iPhone build and **Telegate Connect** Mac build from the combined readiness worktree. An older installed app will not show the new controls.
2. The phone and Mac must use the same reachable HTTPS relay address. Temporary Cloudflare addresses change after the tunnel restarts. Keep the relay, tunnel and Mac awake; a permanent relay is required for dependable everyday use.
3. Create or sign in to your Telegate account on the phone. Save the recovery key when registering. No invitation code is required. You can choose **Set up my computers first** before adding your voice key.
4. On the Mac, add an agent, choose its project folder, and give each destination a distinct name (for example, “Codex · Telegate” and “Claude · Website”). Install and sign in to each agent through its normal CLI first. Use **Check setup** to check the relay, executable and required CLI options. This read-only check does not verify billing or run a model.
5. Pair the Mac using a fresh code: **Pair my phone** on the Mac, then **Computers → Add computer** on the phone. Codes expire after ten minutes. Leave Connect running. The phone should show the computer online.
6. Use **Tasks → New task → Use a connection test → Send**. A completed result proves the selected route works without needing an OpenAI voice key. Repeat for every agent you intend to use. If “Send when I ask” is off, open the saved draft and send it explicitly.
7. Add your OpenAI project key under **Settings → Connect voice**. It needs access to `gpt-live-1` and `gpt-5.6-terra`, plus API billing. Verification checks model access without starting a paid call. A ChatGPT subscription is separate from API billing.
8. Start a voice call. Allow the microphone, speak a request, check that you hear a reply, delegate a harmless task in a disposable folder, and verify the resulting file in that folder. End the call and verify that the task continues.
9. Open its completed result and choose **Continue by voice**. Request a small follow-up and check the original harness session and artifact. Opening or hearing a result must not submit work by itself.
10. Configure the Action Button in iPhone Settings after the first call works. Test once unlocked, then from the locked phone. iPhone may require unlocking. Test once on cellular if you will delegate away from home.

## Verified during this audit

- 51 Node tests pass on macOS and Linux / Node 24 Alpine.
- Eight native iOS tests pass with simulator signing, including actual Keychain save/read/update, concurrent delivery retries, preservation after delivery errors and account-change safety.
- Signed simulator sign-in and a complete UI text-task → relay → companion → completed-result round trip pass against an isolated in-memory relay and harmless fixture agent.
- Mac app builds. CLI setup diagnostics report installed Codex and Claude correctly and give an actionable missing-agent reason.
- Real Codex and Claude initial requests and exact-session resumption pass.
- Real Codex file creation and follow-up edit pass; both artifacts were inspected in a disposable Git project.
- Original Claude noninteractive file creation was blocked by permissions. The concurrent agent's automatic-review implementation passed real file creation and exact-session follow-up editing.
- A development-signed physical iPhone build passed using the existing Apple team. This is distinct from installation and microphone acceptance.
- Landing-page static build, lint and TypeScript checks pass. Updated affected dependencies; `npm audit` reports zero known vulnerabilities for that lockfile.

## Remaining acceptance and prerequisites

- The physical iPhone must be unlocked and the final combined build installed. The Mac locked during final native visual review, so that review must resume after unlock.
- No live OpenAI voice session has been tested with Daniel's key in this audit. Model access, available API credit, audio routing, microphone permission and actual speech-to-delegation remain first-call acceptance.
- Full APNs delivery has not been verified. **DIY intentionally uses in-app results and has no background push notifications.** For push, use the full build with an Apple Developer team, matching app ID and APNs credentials on the relay.
- OpenClaw is not installed on this Mac. Its adapter is covered by automated tests; a real configured gateway must pass its own connection test.
- Hermes adapter transport is covered by tests, but the prior live provider check timed out. Verify the installed Hermes provider/model configuration and run a real test before relying on it.
- Grok Bot needs its configured submission endpoint, bearer key, routine and completion callback. The earlier temporary callback test was held by provider approval. Confirm the routine uses the current relay address and produces a completed task.
- HomiesAI requires a Telegate-compatible task endpoint. It is not a finished native connector merely because it appears in the marketing examples.
- Windows companion execution and full iPad/Dynamic Type/VoiceOver acceptance remain unverified.

## Fixes in this audit

- Setup readiness card and a path to pair/test computers before providing a voice key.
- Text-task composer with a harmless connection-test preset, exact destination and durable request identity.
- Per-agent CLI checks with visible reasons, and project-folder labels that distinguish similarly named agents.
- Delivery retries wait for the in-flight request instead of reporting early success; account changes cannot remove another account's pending brief.
- The send/draft preference persists immediately.
- Voice context appends use a conservative UTF-8 byte budget for the API's per-append limit.
- Stalled task leases expire on the relay timer and enqueue needs-attention notifications without requiring a phone refresh.
- Connector credentials are removed from local task process environments.
- Keychain errors explain signing requirements; signed simulator tests exercise real credential persistence.
- Fixed a teardown race in the integration test fixture that deleted its config before stopping the connector.
- Landing-page dependency security updates preserve the existing static-export architecture.

## Sources and limits

Runtime logs and disposable acceptance reports are in the readiness worktree's ignored `outputs/` directory and `/tmp/telegate-readiness-*.log`. No user API key or production account token is included in this document. All created harness artifacts were removed with their disposable project folders.

Voice protocol checked against [OpenAI GPT-Live](https://developers.openai.com/api/docs/guides/live), [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live) and [client delegation](https://developers.openai.com/api/docs/guides/live-delegation?delegation-mode=client). Dependency fixes include the [React advisory](https://github.com/advisories/GHSA-wx67-qw84-cm4g). A clean audit is a check for known advisories, not proof of complete security.

Source changes are prepared locally. Updating the marketing website's source copy does not update the separately owned published site.
