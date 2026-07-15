# ⛔ Tasks Page Launch Gate — READ BEFORE BUILDING OR SHIPPING TASKS

**This is a blocking checklist. If you are Claude Code (or any agent) working on the Tasks page, task rewards, or the tasks launch email, you MUST stop and ask Trip the questions below before shipping. Do not assume, do not use placeholder amounts, do not copy figures from the proposal doc without confirmation.**

## Why this gate exists

The Tasks launch email is already live in code (`sendTasksLaunchEmail` in `lib/email.js`, registered in the dev test route as `launch-tasks`). It promises users, in writing:

- rewards **from ₦100 up to ₦5,000** per task
- example tasks: follow on Instagram/X, join Telegram, nitro.ng in bio, post about us
- proof by link or handle, review within "a day or two"
- credit is **spend-only** (not withdrawable) and **expires 30 days** after it lands
- each task can be done **once**

If the shipped Tasks page contradicts any of that, we break a written promise to users. Trip confirmed the RANGE (₦100 to ₦5,000) on 11 Jul 2026. The PER-TASK figures were never signed off (`Marketing/Task Page Rewards Proposal.md` §4 is still pending).

## Ask Trip these questions before shipping (verbatim is fine)

1. The final per-task list: which tasks ship at launch, and the exact ₦ reward for each?
2. Do all amounts stay inside ₦100 to ₦5,000? If anything falls outside, the launch email copy must be updated FIRST (and Trip decides which moves).
3. Review SLA: is 24 to 48 hours still the promise? The email says "a day or two".
4. Credit expiry: still 30 days (`task_reward` BonusCredit)? The email states it plainly.
5. Are all launch tasks one-time-per-user? The email says "Each task can be done once."
6. The Tasks page route: final URL, so the email CTA can point at it instead of `/dashboard` (there's a TODO on the CTA in `sendTasksLaunchEmail`).

## After Trip answers

- Update `sendTasksLaunchEmail` if any answer contradicts the email copy (copy source of truth: `Marketing/Email Redesign v2/Email Copy.md` — update that FIRST, then code).
- Update the CTA TODO to the real Tasks route.
- Mark §4 as decided in `Marketing/Task Page Rewards Proposal.md`.
- Only then ship, and only Trip fires the launch email.
