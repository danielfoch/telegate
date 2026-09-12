# More life. Less screen.

Telegate helps people get substantial work moving without sitting at their computer. Voice is how they think through the request; their chosen harness is where the work happens. The product should give people a clear handoff and a reason to put the phone away.

## Core copy

- Brand theme: **More life. Less screen.**
- Dashboard promise: **Get work done. Get your day back.**
- Supporting line: **Talk it through. Send it off. Get back to your day.**
- Voice screen: **Talk it through. Get your day back.**
- Mac companion: **Leave your desk behind. Keep this computer ready for your next idea.**

Use a calm ink, pale paper and fresh green palette; generous space; large voice controls; simple progress cards. Celebrate completed work and the freedom to step away. Avoid addictive streaks, guilt for missing days, or claims that more prompts automatically mean better work. Completion alerts invite a review when the user chooses; they do not open voice on their own.

## Metrics and meaning

| Metric | Rule | What it does not prove |
| --- | --- | --- |
| Prompts shipped | Each unique accepted submission, including a draft when explicitly sent; retries count once | Harness execution or success; some queued work may be cancelled |
| Work completed | Tasks reported complete by their harness; duplicate callbacks count once | Independent assessment of quality or business value |
| Estimated screen time saved | Completed tasks × user's chosen average hands-on minutes avoided ÷ 60 | Measured screen time, physical time away, or elapsed agent runtime |
| Personal milestones | Lifetime completion thresholds; no deadline or daily streak | Competition with other users |
| Optional community rank | Last-7-days shipped count, with equal counts sharing a rank | Verified productivity or hours reclaimed |

The 30-minute starting estimate is explicitly a placeholder. Users can set 0–480 minutes in dashboard settings. Changing it recalculates past totals. A later product iteration could allow per-task estimates and user correction, but the current implementation does not pretend to infer saved time from model runtime.

The community board shares only a user-chosen alias and aggregate counts with signed-in users. Membership defaults off; there are no seed users or fake rankings. Choosing not to join leaves every personal dashboard feature available. No screen, location, or activity monitoring was added.

## UI verification

A Debug-only `--dashboard-preview` launch argument renders the real dashboard component with explicitly labeled sample data, without creating accounts, calling models, or writing metrics. It is excluded from Release. This fixture exists for visual inspection, not as a product metric feed.
