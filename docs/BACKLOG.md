# Backlog

The one list. When something ships it moves to Closed with its commit, so it
never gets picked up twice. Update this in the same commit as the work.

## Open

- **A failed `voidCommissions` can leave an affiliate owed money on a cancelled
  order, and nothing ever retries it.** Seen 28 Aug on NTR-7919: the cancel and
  the ₦7,191 refund both went through, then the commission void hit a Neon
  connection drop and raised a `void_failed` money alert. Harmless that time
  (the order carried no commission) and no commission is currently stuck on any
  cancelled order — but the four call sites (`app/api/admin/orders`,
  `app/api/orders`, `app/api/cron/orders` ×2) are all fire-and-forget with no
  reconciliation. Two fixes: retry `voidCommissions` on transient connection
  errors (it is already idempotent — `SELECT FOR UPDATE`, a second run voids
  nothing and returns 0), and add a nightly sweep that voids any commission
  still `held`/`approved` whose order is Cancelled/Failed/Rejected.

- **Full catalogue is listable but not orderable (blocks the reseller full
  tier).** `services` returns 9,462 raw services (`FULL_CATALOGUE_WHERE` has no
  `enabled` check) but `add` → `resolveVisible` requires `Service.enabled`, and
  only 5 of those 9,462 are enabled. A full-catalogue reseller would sync the
  list and get "Service not available" on 99.9% of it. Decide which side is
  right — list only what is enabled, or let the full catalogue order regardless
  — and make both paths agree. Found 28 Aug 2026 during the margin pull.

- **Pulse: put credits and bonuses back, as a third row of month facts.** The
  redesign dropped Welcome Bonuses and Outflows. Add a third row of five to
  "This month": **Bonuses** (`welcomeBonus.total`), **Payouts** (sum of
  `monthPayouts`: referrals, gifts, coupons, leaderboard, game and video
  rewards) — both already in the payload — plus three worth their place:
  **Refunds** (month to date; needs one new query, and it is the biggest leak
  in the book at 7.5% of revenue), **Cancel rate** (from `byStatus`, was in the
  old Key Metrics), and **Idle wallets** (`idleUsersWithBalance`, money sitting
  unspent). Swap any of the last three if something else earns it more.

- **Pulse: colour the Platforms bar by each platform's own brand colour**, not
  the generic palette, so the split reads without the legend. Needs a shared
  map (Instagram #E1306C, YouTube #FF0000, Facebook #1877F2, Telegram #229ED9,
  WhatsApp #25D366, LinkedIn #0A66C2, Spotify #1DB954, Twitch #9146FF,
  Discord #5865F2 …), with a light neutral standing in for the black-brand ones
  (TikTok, X, Threads, Tidal) since Pulse is a dark surface.

- **Build the approved "Which tier?" explainer.** Mocked and iterated to
  approval 27–28 Aug: three columns side by side, every fact visible with no
  scrolling and nothing to tap; a tinted head per tier (icon inline with the
  name, centred, caption under it) over fact rows on rails that line up across
  columns; "Most pick" as a filled badge on Standard. Copy corrected — no tier
  is described as basic, the third row is **Queue** not Start (Budget is not
  slow: ten Budget tiers list 0–2 hrs), and the lead says every tier starts
  about as quickly. Phone uses one-word values plus a legend; wide spells them
  out and adds the "who it is for" line. Replaces both the narrow and wide
  layouts of `TierExplainer` in `components/new-order.jsx` with one that
  reflows. Mock: artifact `0cb7b320-9855-46b7-a519-031273fe739d`.

- **Every expandable card opens the same way** — services and order history now
  share `lib/expandable-card.js` (accent frame, lifted off the list, header
  tinted deeper than the body). Bring the rest to it: bulk order rows, admin
  refills, tasks, users drawer, resellers, promotions, anywhere a row opens
  into detail. One look for "this is open", everywhere.

- **Reseller API follow-ups** (v2 of the API, not started): drip-feed and
  multi-day parameters, webhooks, per-key IP allowlists. Brief:
  `docs/v2/reseller_api_brief.md`.
- **Onboarding funnel, second read** — after ~30 days of `firstSeenWalletAt` /
  `firstSeenNewOrderAt` data (from 26 Aug 2026), rerun the funnel and see where
  the 74% who never pay actually stop.
- **Outreach re-engagement** — the ~2,000 signups a month who never start a
  payment. **Paused (26 Aug 2026): no staff.** The whole outreach machine is
  off via Admin → Outreach → Pause (`outreach_paused` setting); resume there
  when there is a team again, then pick this up.
- **Cohort / ops** — anything the nightly cohort check surfaces (see the
  protected routes in CLAUDE.md).

## Closed

| Date | Item | Commit |
| --- | --- | --- |
| 2026-08-27 | Trip's four: the duplicate "need help ordering" line under search results removed, opened order rows framed like opened service cards on both sides with the header tinted deeper than its body, Pulse deposit channels coloured per method, and every button answers the hand (lift on hover, sink on press, reduced-motion respected) | `0719f4c8`, `68d2269c` v2.4.8 |
| 2026-08-27 | Copy buttons on Referrals and the API docs work again: the v2.4.4 clipboard sweep shadowed a same-named local, so `copyText` called itself until the stack blew and the surrounding catch swallowed it | `69610f64` v2.4.7 |
| 2026-08-27 | Gradual orders schedule at any hour and any size: each day's batches get a span budget so they fit inside that day, and a day is the 24 hours from its own anchor unless a delivery window makes it a calendar day | `71144835` v2.4.6 |
| 2026-08-27 | Versioning rule states what earns a milestone, and that a long patch run is the healthy case | `f1214c0b` v2.4.5 |
| 2026-08-27 | Admin side, compact and clean — every named piece is in place: sidebar sections with separators (`admin-dashboard.jsx`), reseller programme tiles including "On full catalogue" (`admin-resellers.jsx`), the Tasks submissions review queue with approve/reject (`admin-tasks.jsx`), the Users-list chip. Nothing further is specified; reopen with a named page if one still reads wrong | verified, `20cd8c59` |
| 2026-08-26 | Reseller and API chips on admin orders and the users list, `Placed from` on the order facts; disabled profiles no longer count as resellers; changelog entry for the API launch | `20cd8c59` v2.4.5 |
| 2026-08-26 | Six Sentry issues: Meta CAPI retry and classification, registration through the outbox, clipboard never throws, Prisma read retry, Redis outages are warnings | `7a7f85dd` v2.4.4 |
| 2026-08-26 | Pulse and Live rebuilt: full viewport, fullscreen, people first, today's figures on their own day lines | `d81f7de1`, `8342a73d` v2.4.2–3 |
| 2026-08-26 | Outreach paused with a switch every outreach cron honours (Admin → Outreach) | `ce5fea5a` v2.4.1 |
| 2026-08-26 | Reseller API carries instructions: `description` and standard `type` on every service, `add` accepts comment lists and traffic targeting | `9acf854a`, `97039c60` v2.4 |
| 2026-08-26 | Reseller API carries instructions: `description` (group note, Discord bot setup with the live link, traffic and comment parameters) and a standard `type` on every service; `add` accepts comments/usernames/keywords and traffic targeting | v2.4 |
| 2026-08-26 | API keys for every verified account at retail; wholesale by approval on the same key; HQ tab in the nav for everyone | `27001ab9` v2.3.2 |
| 2026-08-26 | Reseller HQ merged with the public resellers page: one component in two states, no child panel; key in HQ and Settings (`/api/reseller/key`, read + rotate); docs at `/resellers/docs`; catalogue points at both | `b0d4a6a3` v2.3.1 |
| 2026-08-26 | Reseller API: `POST /api/v2` in the SMM convention, one order path for web and API (`createOrderForSession`, `patchOrderForSession`, `refillOrderForSession`), curated vs full decided by the key, 584 missing IDs minted (map now 9,806) | `e277fcce` v2.3 |
| 2026-08-26 | Backlog starvation in outreach: priority touches are budget-aware, Backlog keeps a floor of 15 | `815f9655` v2.2.36 |
| 2026-08-26 | Failed deposits: 373/30d were abandoned checkouts (`provider_not_found`), now read "Not completed"; real rejections stay red | `64b17b3e` v2.2.37 |
| 2026-08-26 | Hand-built modals (Rewards, Settings, Home popups) moved onto the `Modal` primitive | `4a27b858` v2.2.38 |
| 2026-08-26 | Full-catalogue name cleanup for resellers: bracket facts → attributes, per-category dedupe, tails without flags, ≤80 chars | `9623e463` v2.2.39 |
| 2026-08-26 | Untracked agent-tooling folders (`.agents`, `.codex`, `.21st`, `.github/{agents,hooks,skills}`) gitignored | `9623e463` |
| 2026-08-26 | First-seen timestamps for Wallet and New Order, with a governed migration | `2b9711e5` v2.2.35 |
| 2026-08-26 | Dashboard redesign round: Orders (both sides), New Order + bulk + modal, Tasks, Home, Settings, Wallet, theme switch, dock, sharper tokens, ground wash and grain | v2.2.20 – v2.2.34 |
