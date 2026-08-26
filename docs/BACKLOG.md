# Backlog

The one list. When something ships it moves to Closed with its commit, so it
never gets picked up twice. Update this in the same commit as the work.

## Open

- **Admin side, compact and clean** — same row-and-heading language as the
  customer dashboard: admin sidebar sections with separators, Reseller HQ
  ("Full providers" labels, analytics tiles), admin Tasks review queue, Users
  list (show the Reseller chip there too).
- **Reseller API** — `POST /api/v2`. Brief at `docs/v2/reseller_api_brief.md`,
  awaiting Trip's approval. Includes the ID backfill for `ResellerServiceMap`.
- **Onboarding funnel, second read** — after ~30 days of `firstSeenWalletAt` /
  `firstSeenNewOrderAt` data (from 26 Aug 2026), rerun the funnel and see where
  the 74% who never pay actually stop.
- **Outreach re-engagement** — the ~2,000 signups a month who never start a
  payment. Trip: outreach handles this from next month.
- **Cohort / ops** — anything the nightly cohort check surfaces (see the
  protected routes in CLAUDE.md).

## Closed

| Date | Item | Commit |
|---|---|---|
| 2026-08-26 | Backlog starvation in outreach: priority touches are budget-aware, Backlog keeps a floor of 15 | `bfdd3aca` v2.2.36 |
| 2026-08-26 | Failed deposits: 373/30d were abandoned checkouts (`provider_not_found`), now read "Not completed"; real rejections stay red | `8973164e` v2.2.37 |
| 2026-08-26 | Hand-built modals (Rewards, Settings, Home popups) moved onto the `Modal` primitive | `ec78db34` v2.2.38 |
| 2026-08-26 | Full-catalogue name cleanup for resellers: bracket facts → attributes, per-category dedupe, tails without flags, ≤80 chars | `bee8cd0d`, `748779c8` v2.2.39 |
| 2026-08-26 | Untracked agent-tooling folders (`.agents`, `.codex`, `.21st`, `.github/{agents,hooks,skills}`) gitignored | `ef9c3a31` |
| 2026-08-26 | First-seen timestamps for Wallet and New Order, with a governed migration | `2b9711e5` v2.2.35 |
| 2026-08-26 | Dashboard redesign round: Orders (both sides), New Order + bulk + modal, Tasks, Home, Settings, Wallet, theme switch, dock, sharper tokens, ground wash and grain | v2.2.20 – v2.2.34 |
