# Delegate to Grok Bot / Clydesdale

Telegate keeps the voice conversation and brief planning. Grok Bot executes the work in its existing bot conversation. No xAI model endpoint, OpenAI key on the relay, SMS bridge, or periodic inbox scan is required for this integration.

```text
Phone voice → approved brief → relay task queue → paired Telegate Connect
  → POST /v1/adapters/grokbot/tasks on the same relay
  → saved dispatch queue → Grok Bot's dedicated webhook routine
  → POST /v1/hooks/tasks/<id> → saved result → optional APNs notification
```

The adapter is included in the relay and Docker image; it needs no second host or database. It is disabled until configured. It connects **one operator-controlled Grok Bot routine per relay**. Give the submission token only to computers/accounts allowed to delegate into that bot. It is not a per-user Grok OAuth integration; unrelated users should use separate relays/routines. The paired computer must still be online to submit work. Once submitted, Grok Bot can finish while that computer is offline.

## Setup

1. Deploy the relay with persistent storage and HTTPS using [SELF-HOST.md](../SELF-HOST.md). Keep its `CALLBACK_SIGNING_KEY` stable.
2. In Grok Bot, open your bot's details → **Create Routine**. Name it **Telegate voice delegation**, choose **Webhook**, and use [the routine instructions](GROKBOT-ROUTINE.txt). Use a dedicated routine, not a Twilio/SMS routine. Set the expected relay hostname in its instructions. Leave it paused while configuring.
3. In the routine's webhook trigger details, copy its POST URL and authorization key. On the relay host, add these private environment variables:

   | Variable | Value |
   | --- | --- |
   | `GROKBOT_WEBHOOK_URL` | The dedicated routine's HTTPS POST URL |
   | `GROKBOT_WEBHOOK_TOKEN` | Its bearer key, without the `Bearer ` prefix |
   | `GROKBOT_SUBMISSION_TOKEN` | A new independent random secret of at least 32 characters |
   | `GROKBOT_COMPLETION_TIMEOUT_MINUTES` | Optional; default 1440 (24 hours), range 1–10080 |

   Generate the submission token with `openssl rand -hex 32`. Keep it in the host's private `.env`; never commit it or use an OpenAI key. The URL may itself contain a secret. The Grok Bot desktop webhook trigger inspected during development displays `Authorization: Bearer <key>`, which this adapter supports. Check your trigger if the platform changes its format.

4. Restart/rebuild the relay (`docker compose up -d --build`). Existing accounts, pairing, briefs and callback tokens are preserved by the persistent volume.
5. In Telegate Connect, select **Add Grok Bot / Clydesdale**. It fills your relay's `/v1/adapters/grokbot/tasks` address. Paste `GROKBOT_SUBMISSION_TOKEN` into **Endpoint bearer token**, save and connect. For CLI setup, use `npm run connect` and select `grokbot`. The Grok webhook key belongs only on the relay, not the companion or phone.
6. Enable the dedicated routine and run the harmless acceptance test below. If using the native app, rebuild Telegate Connect to get the preset button; older versions can add the same URL/token as a **Cloud endpoint** manually.

No cron interval governs task delivery: Connect polls its task queue, then the adapter sends the saved webhook on its next worker tick (normally about one second). This does not guarantee Grok Bot starts immediately; its queue and availability are controlled by that platform.

## Submission and callbacks

Connect sends the [existing cloud contract](../API.md#cloud-harness-adapters): `id`, `title`, `prompt`, `parent_task_id`, `resume_run_id`, `callback_url`, `callback_token`; headers include `Idempotency-Key: <id>` and the adapter bearer. The adapter only accepts an already claimed, enabled cloud task from this same relay. It checks the stored brief, parent/resume fields, exact callback URL and task-scoped callback token. It cannot create a new task or redirect callback credentials to an arbitrary URL.

After a durable SQLite insert it returns HTTP 200 with `{"id":"<telegate-task-id>","status":"accepted"}`. This is a receipt, **not completion**. Retrying the same ID does not insert or execute a second job. The initial run ID is the Telegate task ID for correlation, not a fabricated Grok conversation ID.

The worker POSTs the task JSON directly to the configured routine, preserving the idempotency header. Grok's HTTP success means receipt only; the adapter does not assume a native run ID or thread URL from an undocumented response. The routine must explicitly POST the actual result to the task-scoped callback URL, using its callback bearer:

```json
{"status":"completed","result":"Actual outcome, artifact links and useful next steps"}
```

`failed` and `needs_attention` are also supported. A real `runId` and `thread_url` can be included when available. The callback updates the task and queues any configured push atomically. Early completion survives a delayed companion acknowledgment. Duplicate callbacks cannot rewrite a completed/failed result; a `needs_attention` outcome can later resolve to completion. A callback credential cannot submit work or read other tasks.

The routine instructions require receipt deduplication, approval preservation, and saved-result callback retries. Those are instructions to the Grok agent, not a verified platform-level exactly-once guarantee. A platform worker that persists receipts and callback retries would provide stronger guarantees. Telegate therefore makes only one automatic upstream submission attempt. A timeout, disconnect, unsuccessful HTTP response or relay restart during that attempt reports **needs attention**, without silently repeating work. Inspect Grok before explicitly resubmitting. A missing callback after the configured deadline also reports needs attention; a late valid callback still works.

Revoking a computer stops queued dispatches and disables its callbacks. It cannot retract work already received by Grok. Deleting a Telegate account cascades its adapter queue records; any prompt already sent to Grok is subject to Grok's own retention. Credentials are derived from the existing callback key or kept in environment configuration, not copied into a second outbox. No webhook URL, bearer, prompt or upstream error body is logged by this adapter.

## Harmless acceptance test

Send a small brief from the phone to **Grok Bot / Clydesdale**:

> Return “Telegate connected” and one sentence explaining what you received. Do not send any messages, modify records, or contact anyone.

Verify: one routine execution appears in Clydesdale; Telegate moves from submitted to completed; the summary matches; opening the task or using **Read it to me** does not submit new work. Repeat the same HTTP submission ID in a controlled test and verify it does not rerun. Then check an approval-needed brief reports needs attention rather than sending anything.

Grok Bot may require a separate approval for the first outbound result callback. During the live test, its automatic review held the POST to a temporary tunnel as an unverified destination, even though the webhook task was received. Review that callback in Grok; for unattended operation, configure a narrowly scoped approval for your permanent relay callback endpoint using the platform’s supported controls. Do not broadly allow unrelated outbound commands.

The free **TelegateDIY** build shows results in Tasks. Background push requires the full scheme, APNs credentials and phone notification permission. Callback delivery does not automatically start voice.

## Verification scope

Automated tests exercise the actual relay HTTP endpoints, persisted queue/restart handling, companion payload, callback authentication, account/device isolation, revocation, completion timing, deadlines, result immutability and notification outbox using a simulated Grok HTTP transport. They do **not** prove the provider's payload rendering, callback execution, real APNs delivery or phone voice on a live deployment. Run the live acceptance test after configuring your host and routine.
