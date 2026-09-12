# Relay API v1

All mutations require `Content-Type: application/json`. Responses are JSON and `Cache-Control: no-store`. Use HTTPS outside localhost. Native clients use bearer tokens; there are no session cookies and no permissive CORS. Redirects are rejected by the clients.

## Accounts

| Route | Authentication | Body / result |
| --- | --- | --- |
| `POST /v1/auth/register` | none; optional operator invitation | `username`, `password`, optional `signupCode` → account token, user ID, recovery key |
| `POST /v1/auth/login` | none | `username`, `password` → account token |
| `POST /v1/auth/recover` | recovery secret | `username`, `recoveryKey`, new `password` → rotated token and recovery key |
| `POST /v1/auth/logout` | account token | Revokes that session |
| `POST /v1/account/delete` | account token + password | Cascades account, sessions, computers, tasks, and snapshots |
| `GET /v1/tasks/:id` | account token | One owned task, including older tasks opened from notifications |
| `GET /v1/state` | account token | Own computers, projects, and latest 100 tasks |

Passwords use salted scrypt. Session, recovery, and computer credentials are stored as SHA-256 hashes; raw computer tokens are created on the computer. Account sessions expire after 30 days. Account names are identifiers, not verified email addresses; password recovery uses the saved recovery key. There is no email delivery dependency in this pilot.

## Computer pairing

1. Computer generates a random 256-bit secret and retains it locally.
2. `POST /v1/pair/start` with `tokenHash`, `name`, `platform`, and harness summaries `{id,name,kind,enabled}` returns `id`, a ten-character code, and `expiresAt`. Pending pairing is valid for ten minutes.
3. Phone uses account authentication on `GET /v1/pair/preview?code=…`, displays the computer identity, then calls `POST /v1/pair/approve` with `code` after the user confirms.
4. Computer polls `GET /v1/pair/status` with its locally generated secret. `status: paired` supplies its new `deviceId`. No secret is transmitted in the pairing code or URL.
5. Computer uses that same secret for device routes. Account tokens cannot use device routes and vice versa.

`POST /v1/devices/revoke` takes `deviceId`, checks account ownership, revokes the token, cancels queued/draft work, and marks running work uncertain. The companion checks authentication during polling and active-run heartbeats. Revocation is not a rollback of effects already performed.

## Task submission and execution

`POST /v1/tasks`, with an account token:

```json
{
  "requestKey": "stable-operation-id",
  "deviceId": "paired-device-id",
  "harnessId": "locally-configured-harness-id",
  "title": "Improve the mobile layout",
  "prompt": "Self-contained task brief with scope and constraints.",
  "send": true
}
```

For follow-ups, optionally supply `parentTaskId`. The relay validates ownership, destination, and the prior outcome, then derives `resumeRunId` from that task’s stored harness session. The client cannot select another user’s session. Codex/Claude adapters resume that exact ID; generic command adapters start a new invocation with the follow-up brief. Never use an implicit “last session.”

Only an enabled harness on one of that account’s computers is accepted. The request key is unique per account. Reusing it with the same brief returns the original task; different content returns 409. A phone persists exact briefs and keys before sending. `send: false` creates a draft.

`POST /v1/tasks/action` takes `taskId` and `send` or `cancel`. Only drafts can be sent; only drafts/queued tasks can be cancelled here. The service does not claim to cancel already-running harness effects.

The computer posts `/v1/device/poll` with its available harness summaries. A single atomic SQLite statement claims one queued task for **that computer** and returns its `leaseId`. One running task is allowed per device. The computer persists the claim before spawning a harness. Commands and arguments are chosen locally; task text goes on stdin with `shell: false`.

During execution, `/v1/device/heartbeat` receives `taskId`, `leaseId`, and current harness summaries every ten seconds. The lease lasts 120 seconds. Expired work becomes `needs_attention`, never automatically requeued. An exact-lease late result may resolve that uncertainty.

`POST /v1/device/result` takes `taskId`, `leaseId`, `status`, `result`, optional `runId`, and optional `threadURL`. Status is `completed`, `failed`, `needs_attention`, or `submitted` (a cloud provider accepted work). Results are saved locally until acknowledged. Duplicate terminal acknowledgments cannot rewrite an already-confirmed terminal outcome.

## Project scans

The phone posts `/v1/devices/scan` with `deviceId`, optional `intervalMinutes`, and optional `scanNow: true`. Supported intervals are 0 (manual), 5, 15, 30, 60, 180, 360, 720, and 1440 minutes. Device polling and heartbeats return `scan: {intervalMinutes,requestId}`.

The companion reads only work folders whose local harness config has `shareProjectContext: true`. It does not discover or traverse the user’s whole disk, inspect parent Git repositories, or follow a symlink selected as a work folder. Git commands disable fsmonitor hooks, have time/output bounds, and do not read diff/source contents.

`POST /v1/device/projects` publishes `projects` and the fulfilled `requestId`. Each project includes an opaque path-derived ID, display name, locally registered harness IDs, branch, changed-file count, latest commit subject/time, and readiness status. The relay checks the device credential, validates the shape and harness IDs, stamps reception time, and replaces the previous snapshot. The phone cannot post snapshots on another device’s behalf.

Snapshots are included in the next voice session’s reference context. During a call, changed context for the selected computer is supplied via `session.thinking.append`; application instructions remain separate from untrusted project metadata. The full bounded snapshot also goes to the brief planner.

## Cloud harness adapters

A locally configured HTTPS endpoint receives:

```json
{
  "id": "telegate-task-id",
  "title": "Improve mobile layout",
  "prompt": "The agreed, self-contained brief",
  "parent_task_id": "optional-previous-telegate-task-id",
  "resume_run_id": "optional-previous-native-session-id",
  "callback_url": "https://relay.example/v1/hooks/tasks/telegate-task-id",
  "callback_token": "secret-scoped-to-this-task"
}
```

It includes `Idempotency-Key: <task id>` and its locally configured bearer credential. Fields without values are omitted. Callback fields are supplied only when the relay has an HTTPS public URL and `CALLBACK_SIGNING_KEY` configured. The model cannot choose endpoint URLs or credentials.

Persist the task and idempotency key before returning an acceptance response:

```json
{"id":"native-task-id","status":"accepted","thread_url":"https://your-harness.example/chats/native-task-id"}
```

This means **submitted**, not completed. Execute asynchronously and retain the callback credential privately with the native job. After verifying completion, POST to `callback_url` with `Authorization: Bearer <callback_token>` and JSON:

```json
{
  "status": "completed",
  "result": "What changed, validation performed, artifact links, and any required user action.",
  "runId": "native-task-id",
  "thread_url": "https://your-harness.example/chats/native-task-id"
}
```

Allowed callback outcomes: `completed`, `failed`, `needs_attention`. Retry transport/server errors with backoff using the same task; a duplicate terminal callback cannot rewrite confirmed completion. An early callback is preserved if the provider’s acceptance response reaches the companion afterward. Revoking the paired computer disables its callbacks. The callback token cannot create tasks or inspect other tasks. Keep it out of logs and URLs. The task lease supplies token scope; `CALLBACK_SIGNING_KEY` rotation invalidates outstanding callbacks, so coordinate rotation with running cloud jobs.

Homies/Grokbot still need their inbound task endpoint and this completion worker integration implemented in their own platform. This repository contains the Telegate side, not an unverified integration with those private harnesses.

## Completion notifications

- `GET /v1/notifications/config` → `{ready: true|false}`.
- `POST /v1/notifications/register` with the account token and `{token,environment}` (`sandbox` or `production`) registers the current APNs token. Tokens are encrypted at rest. Register on each app launch rather than caching Apple tokens on disk.
- `POST /v1/notifications/unregister` removes that owner’s registration and pending deliveries.

A verified local result or cloud callback atomically stores the task outcome and notification outbox rows for the owner’s registered phones. A worker submits generic alerts to APNs, retries transient errors with stable notification IDs and exponential backoff, and removes invalid tokens. A token moved to another account loses its former pending deliveries. Delivery is subject to Apple/device notification settings; APNs acceptance is not proof a person saw an alert.

Payloads contain only a generic message and `taskId`, never the prompt or result. Tapping opens an authenticated task detail; it does not start the microphone. **Read it to me** or **Continue by voice** explicitly starts a new voice session containing bounded prior-task context. A further explicit request to delegate creates a linked follow-up. No incoming webhook speaks into an active voice call automatically.
