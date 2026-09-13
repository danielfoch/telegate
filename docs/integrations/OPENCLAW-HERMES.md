# Connect OpenClaw or Hermes Agent

Telegate Connect has **OpenClaw** and **Hermes Agent** cards under **Add an agent**. Both use your installed CLI, existing credentials, models, tools and permissions. No additional Telegate-specific model key or public webhook is needed on the computer. The phone still uses its own OpenAI voice key.

## Setup

1. Update/restart your Telegate relay and rebuild Telegate Connect from this revision. The relay must recognize the new `openclaw` and `hermes` harness types; your existing accounts and paired computers are preserved.
2. Install and configure the harness on the computer that will do the work. First verify it works in its own interface. Use the [official OpenClaw guide](https://docs.openclaw.ai/start/getting-started) or [Hermes quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart).
3. In Telegate Connect, pause its connection if running, choose **OpenClaw** or **Hermes Agent** under **Add an agent**, and confirm the folder. Executable settings are under **Advanced settings**. For OpenClaw, choose your existing **agent ID** (default `main`). For Hermes, the chosen working directory is used to launch the agent.
4. Save and reconnect. Choose that computer and harness in Telegate on your phone. Send a harmless brief such as: “Reply with Telegate connected. Do not use tools or change anything.” Review the result before delegating larger work.

CLI users can run `npm run connect` and select `openclaw` or `hermes` in the setup questions. No argument-array editing is needed. On a VPS, run the Node companion there alongside the harness; pair that server as a separate computer. The Mac app is optional for this arrangement. The execution computer/server must stay awake and connected.

Connect checks the required CLI options without running a model. Missing/incompatible executables are marked unavailable and explained in the connector log. A successful help probe is not proof of provider authentication or gateway health. Restart Connect after updating a CLI so it repeats the probe.

## OpenClaw

This adapter uses the gateway-backed `openclaw agent` command, with `--agent`, `--session-key`, `--message-file`, `--json`, and `--timeout`. These options must be supported by your installed release.

- Each initial Telegate task gets a separate `telegate-<task-id>` session key scoped to the locally selected OpenClaw agent. It does not append to your default/main conversation. Follow-ups use that exact saved key; the gateway's per-run ID is not confused with a session ID.
- The CLI reads the brief from a private temporary file, which is removed after the process exits. Prompts are never assembled into shell commands. The adapter deliberately uses an actual file because gateway `agent --message-file` and embedded `agent exec --message-file -` have different stdin semantics.
- OpenClaw uses the selected agent's **configured gateway workspace**. Changing the Telegate launch folder does not reconfigure that workspace. Point optional project sharing at a folder relevant to the chosen agent.
- Your gateway configuration remains in OpenClaw. Telegate does not add `--local`, `--deliver`, messaging recipients, new gateway credentials or policy overrides. It does not change your model or fall back to a second execution path.
- Only a successful exit plus a confirmed JSON outcome and a nonempty result becomes completed. Receipts, in-flight runs, malformed output, aborts and ambiguous transport failures need attention. Text and returned media links are included in the result.
- Cancelling the local process requests termination of the CLI. Work already accepted by a gateway may have effects; inspect OpenClaw before retrying. Telegate never automatically repeats an interrupted task.

Command and result behavior were checked against [OpenClaw's CLI documentation](https://docs.openclaw.ai/cli/agent) and the [gateway command source](https://github.com/openclaw/openclaw/blob/main/src/commands/agent-via-gateway.ts).

## Hermes Agent

The adapter calls `hermes chat --quiet`, preserving the existing provider and agent configuration. It does not add `--yolo`, ignore your rules, or replace your API key.

Current Hermes releases support `--query-file -`; Telegate uses that to send the brief over stdin. Older versions that only support `--query` receive one literal subprocess argument with `shell: false`. This remains safe from shell interpolation, but the brief can be visible to local process inspection. Upgrade Hermes if you require stdin-only delivery; Telegate does not upgrade an existing installation automatically.

Hermes returns its final answer and a `session_id:` footer on stdout (older versions) or stderr (newer versions). Telegate removes the footer from the visible answer and saves the actual session ID for `--resume`. It never uses `--continue`, `latest`, or a guessed session. A missing result cannot become completed merely because a session was created. Nonzero exits are reported as failures; cancellations/timeouts need attention. If a failed run supplies a session ID, it remains available for an explicit follow-up.

The existing Hermes single-query approval policy applies. A blocked tool or required approval must be handled in Hermes; configuring Telegate does not grant new permissions. An agent's final answer should still be reviewed for blockers or incomplete work.

Command and footer compatibility were checked against [Hermes CLI documentation](https://hermes-agent.nousresearch.com/docs/reference/cli-commands/) and the [CLI source](https://github.com/NousResearch/hermes-agent/blob/main/cli.py), plus the locally installed older CLI's help and quiet-mode implementation.

## Results and project context

Both integrations use the companion's existing durable claim, heartbeat, timeout and result outbox. Results return through `/v1/device/result`; they do not require a provider webhook. A configured full iOS build can receive APNs notifications; the DIY build shows results in Tasks. Follow-ups stay on the same owned computer and harness.

Project awareness still consists of opted-in folder metadata scans. Adding a harness does not read every session, file, memory or private configuration into voice. OpenClaw/Hermes retain their own internal context when they execute the task.

## Verification

Automated coverage uses executable CLI fixtures and the actual relay/companion loop: pairing both kinds, passing literal prompts, private-file permissions and cleanup, stdin and legacy Hermes transport, result/session extraction, exact follow-up routing, incompatible installations, failures, cancellation and timeouts. This verifies Telegate's integration contract without claiming a real OpenClaw model run.

At implementation verification, all 46 local tests and the 44-test Node 24 relay/companion/setup subset passed; the Mac app built with the bundled adapter. The installed older Hermes was detected, but its live provider check did not produce a final answer within 90 seconds. OpenClaw was not installed locally. See [the verification record](../VERIFICATION.md) for these limits; neither should be marketed as a verified live deployment on this Mac yet.
