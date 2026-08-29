# Backlog

The one list. When something ships it moves to Closed with its commit, so it
never gets picked up twice. Update this in the same commit as the work.

## Open

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
| 2026-08-29 | The dock is five tabs again; WhatsApp is a float above it (bottom-right on a desktop) that opens the concierge panel: We can order for you, the order-page service as one tap, three quick prompts, the paste-your-link field with the same message as before; Support on the rail opens the panel; the mobile Help button and the More-sheet WhatsApp link are gone | `926bb9ad` v2.4.36 |
| 2026-08-29 | Comment orders that providers reject: only lines with words count as comments (emoji-only lines do not), said before paying on the customer form, the cart, the single and bulk APIs; admin Create Order now requires comments and other typed input on the services that need them and refuses them in batch mode | `89392005` v2.4.35 |
| 2026-08-29 | Finance Breakdown and Rewards rebuilt to the mock: four ledgers (Revenue, Cost, Cash with Refunded to bank, What we owe) each ending on one total, by tier and by platform in the overview's row shape, the top-up form as a card, filters and Export in their own row; Rewards as four facts, two ledgers and an orders-by-status ladder (new in the rewards API), on the shared period picker | `ce4ccad3` v2.4.34 |
| 2026-08-29 | Cash refunds booked: a debit can be tagged "Sent back to their bank" from the Users drawer, stored on the transaction, and Finance shows it as Refunded to bank under cash out; today's refund re-tagged | `0b728c82` v2.4.33 |
| 2026-08-29 | Finance on a custom range (Last month) read net revenue, refunds and cost up to today, not the range end; fixed in analytics and financials. Admin tab pills take the new segmented look | `20980977` v2.4.32 |
| 2026-08-29 | Finance overview rebuilt to the mock: four facts with the period before beside them, a strip showing where the gross went, revenue against cost by day, platforms with profit on cost, cash in by method with wallet liability; the period picker in its own row, no buttons in the header; analytics API carries prev, cost per day and platform, deposits by method | `95175dec` v2.4.32 |
| 2026-08-29 | Admin Settings rebuilt in the user Settings layout: profile card and facts, Account / Site / Appearance / System groups of rows that open modals, sharing the user page's row, section head and icons; cleanup is a row with a confirm | `970d3227` v2.4.31 |
| 2026-08-29 | Left rail rebuilt on both sides: admin jump box (/ to focus), pinned tiles, one-open accordion sections following the page; user eyebrows with a rule, accent-bar active row, muted icons, Tasks and Resellers blue | `9901b6fe` v2.4.30 |
| 2026-08-29 | Discord members/boost orders and Website Traffic orders get a gate at Place order (bot link as the one button; where visitors show and the targeting read back), a tick that unlocks the order, and a receipt reminder for Discord | `2e2dbc62`, `3b081525` v2.4.29 |
| 2026-08-29 | stuck_payments only fires for a live deposit; an untrusted read on an Expired, Failed or Cancelled row is counted separately and never pages | `050e85ad` v2.4.28 |
| 2026-08-29 | YouTube and TikTok order notices reworded: one pace tile for YouTube (50–500 a day, subscriber orders only), three plain risks and a start-small tip for TikTok | `2ebc8895` v2.4.27 |
| 2026-08-29 | Mobile hero card rebuilt to the mock: live strip, numbers on rails (Orders · Accounts · Delivery, centred), gift tile, one button with Log in as a line | `cc7e4960`, `4ca7281c`, `fa605392` v2.4.26 |
| 2026-08-29 | Pulse month facts reordered in the one grid: money, orders, people and wallets side by side | `bc759f0b` v2.4.25 |
| 2026-08-29 | Raw Services lists the services we use first, then A to Z, numbers, symbols, dropdown too; the last raw provider names cleaned in the admin activity feed and cron alerts | `826fb7f6`, `bc2708dd` v2.4.22 |
| 2026-08-29 | Users profile is a drawer over the list again on desktop, a sheet on phone; transactions in naira | `bb581e67` v2.4.21 |
| 2026-08-29 | Admin Create Order shows the typed-input box by the customer rule (custom comments, replies, reviews, mentions, poll, keywords via apiType) | `bac8fd1a` v2.4.20 |
| 2026-08-29 | Resellers rebuilt to the mock: facts row, one list with a status word, catalogue and rate inline, the reason and who approved, revoked rows dimmed at the bottom, Grant access as a modal from the header, a skeleton in the shape of the list instead of a spinner, phone cards that do not wrap | `1a265696` v2.4.24 |
| 2026-08-29 | Pricing rebuilt to the mock, Settings-style: eight tap-to-edit cards that say what each setting does in plain words, each opening a modal that saves itself; Reprice the menu as the one action card; Try a cost and Quick reference stay on the page | `2b0e2496` v2.4.23 |
| 2026-08-29 | Raw Services rebuilt to the mock with cleaned provider names: `lib/service-display.js` turns a raw name into a title and facts (used on Raw Services and in Menu Builder), facts row, one toolbar, a list with a named header and the on/off toggle on the row, open row is facts then actions, skeleton while loading | `510c3748` v2.4.22 |
| 2026-08-29 | First-look fixes on the four rebuilds: composer closed until opened with (i) explainers on a phone, Users pagination inline and the phone sheet solid and locked, profit on cost on Menu Builder and Create Order, Hide off hides off tiers, phone chips under the icon, Create Order total strip pinned | `45aff85d` v2.4.18–21 |
| 2026-08-29 | Users rebuilt to the mock: one flat row of facts, a list with a real header and a status word, chips beside the name, the profile as a panel beside the list on a desktop and a sheet on a phone with facts, actions, credit or debit inline, 90-day spend and the latest transactions | `fd4fd22a` v2.4.21 |
| 2026-08-29 | Create Order rebuilt to the mock: Customer, Service, Order and Delivery as four cards, tier chips that carry price and margin, a drip block that shows the per-day split, the summary beside the form on a desktop and a sticky bar on a phone, Top up on the customer row | `2fba0cc6` v2.4.20 |
| 2026-08-29 | Menu Builder rebuilt to the mock: one list by platform with real icons, tier prices on every row, margin per tier, Swap and inline edit, platform dropdown, phone cards | `28d16ed6` v2.4.19 |
| 2026-08-29 | Announcements admin rebuilt to the mock: live notices across audiences, a composer with a real preview and expiry, Take down and Restore, Remove only in the past | `ff80c81f` v2.4.18 |
| 2026-08-29 | Announcement strip rebuilt to the mock: dot + type word, message, action, "1 of N", dismiss reveals the next; several notices live at once (admin no longer auto-pauses); message box asks for what · effect · what we are doing | `d671da23` v2.4.17 |
| 2026-08-29 | Order receipt rebuilt to the mock: facts on rails, order number copies, refill stated, same-height carousel with a reseller slide ("Join") that points at /resellers, Tasks slide and nav icon blue to match Home | `9026c8fa` v2.4.16 |
| 2026-08-29 | Public order count head start 8,000 → 6,000 (20K originally), now one constant in `lib/public-counts.js` shared by site-info and the blog | `5a739993` v2.4.15 |
| 2026-08-28 | Tasks on both sides, crew payouts and bulk order rows open with the shared look (`lib/expandable-card.js`). Remaining expandables are drawers and modals, which are a different thing | `5aaf76ea` v2.4.13 |
| 2026-08-28 | "Which tier?" rebuilt 1:1 to the approved mock: three tap-to-pick columns, tinted head, facts on rails, Most pick badge, selected state, Good/Better/Best and Normal/Priority/First wording; platform picker keeps its structure with the mock's finish (58/54px tiles, 16/15px icons, 10px labels, soft surfaces, "All N platforms" line) | `556f5e76` v2.4.12 |
| 2026-08-28 | Pulse: third row of month facts (Bonuses, Payouts, Refunds, Cancel rate, Idle wallets; `monthRefunds` added to the API) and the Platforms bar in brand colours via `lib/platform-brand.js` | `3e15dfcb` v2.4.11 |
| 2026-08-28 | Full catalogue orderable: `resolveVisible` and the order path no longer require `Service.enabled` for a full-catalogue reseller; listed + priced + mtp/dao is the rule on both sides | `26a73dcd` v2.4.10 |
| 2026-08-28 | `voidCommissions` retries transient connection drops (idempotent), and `/api/cron/commission-sweep` (02:30 nightly) voids any commission still live on a cancelled order and raises a warning if it had to | `b19d688e` v2.4.9 |
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
