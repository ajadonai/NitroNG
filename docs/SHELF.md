# The Shelf

The one list — everything built dark, parked, or waiting its turn sits on the
shelf until Trip takes it down. When something ships it moves to Closed with
its commit, so it never gets picked up twice. Update this in the same commit
as the work. (Formerly docs/BACKLOG.md.)

## Open

- **Reseller tier ladder — parked 12 Sep 2026, scope complete.** Five tiers
  (Starter 10% → Wholesale 30%) on rolling 30-day retail-equivalent spend,
  automatic promotion on the daily cron, month-end demotion after a grace
  month, one Auto / pinned / custom dropdown in the admin Resellers drawer.
  Settled during scoping: flat % off retail with a margin floor (the thinnest
  band is 1.35× markup, so any flat discount ≥ 26% sells below cost and
  `tests/markup-reseller.test.js` refuses it); thresholds must count
  retail-equivalent, because orders store the discounted charge and a promoted
  reseller would slow its own measurement; `discountPct` becomes an explicit
  override, not the rate; and the floor clamp is worth shipping on its own —
  the rate box accepts 40% today. Every charge path already funnels through
  `getResellerTerms()` → `wholesaleOf()`, so the hook is one function. The API
  docs already promise this ladder and name a "Scale" tier that exists nowhere;
  T4 takes the name. Trip's call on whether the reseller pricing page mirrors
  the retail pricing page layout.

- **Subscription — parked 12 Sep 2026, shape undecided.** The recommendation on
  record: sell scheduling ("Nitro Auto": a service and a weekly amount that
  runs itself), not a discount — a discount subscription answers the same
  question as the reseller ladder and answers it worse. First version charges
  the wallet per run and pauses when it runs dry, sidestepping card
  tokenisation and dunning entirely; card billing only if Auto proves demand.

- **Outreach live feed — waiting on one decision.** A Telegram ping when
  someone a staff member contacted goes on to deposit (name, amount, agent,
  method, touch), plus a daily per-agent roll-up. `OutreachContact` already
  holds who/how/when. Blocked only on the attribution window: 14 days and
  most-recent-touch-wins is the proposal.

- **Saved handles — the pin is per-device.** Shipped as localStorage in
  order-form.jsx; a synced default needs a `pinnedLinks` column on User and a
  migration. Do it when the first person asks why their pin didn't follow them
  to another phone.

- **Dead cross-sell and tier-compare data inside new-order.jsx, found 10 Sep
  2026 by the blind-spot sweep.** `crossSells`/`getCrossSell` (four upsell
  cards: "Complete the look", "Pair it with Likes"…) and `TIER_COMPARE` (the
  Accounts/Refill/Starts/Best-for table) are defined at module scope and
  rendered nowhere — nothing in the repo references either. Fifteen of the
  eighteen module-scope strings the i18n baseline charges to new-order.jsx are
  these. Not deleted: Trip's call, and the upsell cards read like a feature
  that was meant to ship rather than one that was removed. Delete or build —
  either way the baseline drops.

- **Two dead landing files, found 9 Sep 2026 by the translation guard.**
  `components/landing-page.jsx` (2,000+ lines) and
  `components/landing-below-fold.jsx` are not reachable from any route:
  `app/page.jsx` → `components/home-client.jsx` → `components/landing-v3.jsx`
  is the live path, and nothing imports the other two. They were found the
  expensive way — the drift guard reported 87 untranslated strings in them and
  they were an hour from being translated into four languages before anyone
  checked whether a customer could reach them.

  Not deleted, for two reasons: it is Trip's call, and the landing redesign on
  `landing-v2-wip` may yet want the markup. They stay in
  `scripts/i18n-baseline.json` so nobody re-discovers them as new debt; the
  live debt is 1,311 strings, not 1,398. Delete them, or fold what is worth
  keeping into `landing-v3.jsx`, and the baseline drops by 87 for free.

- **Foreign payment methods — steps 1 and 2 shipped 8 Sep 2026, steps 3 and 4
  remain.** Signup accepts NG/US/GB/GH/KE (`4776d901`). Flutterwave is
  hardcoded to `currency: 'NGN'` (`app/api/payments/initialize/route.js:100`)
  and the only non-naira rail is dollar-denominated USDT.

  **Done:** the gateway list is cut by the country on the account —
  `app/api/payments/gateways/route.js` marks every rail `nigeriaOnly` except
  crypto, hides the rest for a foreign account, and returns how many it hid so
  the wallet can say why in one line ("Card and bank transfer are Nigerian-only
  for now. USDT works from anywhere, and credits your wallet in naira."). A
  gateway id it does not recognise is treated as Nigerian; no session or no
  country reads as Nigeria, which is the list it always returned.
  `tests/gateways-by-country.test.js`.

  **Also decided the same day:** the deposit premium is ON at 15%
  (`fx_premium_live = 1`, `fx_premium_percent = 15`) — Trip's call after
  finding the off state was not neutral but the legacy cushioned rate, which
  had been crediting every USDT deposit 15% above market (₦20,000 per $100).
  Deposit rate is now market ÷ 1.15 ≈ ₦1,156/$. A Nigerian paying USDT pays it
  too; Trip chose not to carve that segment out. And there is **one welcome
  bonus ladder for everyone**, in naira, converted on screen — the per-currency
  ladders built that morning came out again the same afternoon (`bc3b40ec`).

  **Remaining:**
  3. **Flutterwave USD (and GHS/KES) collection** — the real unlock, and the
     thing Trip has already asked Flutterwave to enable. Credits naira at the
     deposit rate like everything else; the wallet stays naira. When a rail
     goes live, flip its `nigeriaOnly` in the gateways route — that is the
     whole change on the payments side.
  4. **Done 12 Sep.** `SWITCHER_LIVE` is on in production and all five
     currencies are `active` in `lib/currency.js` (the four foreign ones lost
     their Soon tag). The picker changes what prices are read in, never what
     anyone pays: the currency Flutterwave charges in follows the account's
     country (`COUNTRY_CURRENCY`), so a Nigerian viewing in cedis is still
     charged naira. Whether the picker should instead decide the charge
     currency is Trip's call, not yet made.

  **Do not** build per-country wallets or a second price list — both ruled out
  in the International Nitro entry, and the premium lives in the deposit rate.

- **Auto data-saver — parked design, agreed 6 Sep 2026** (the improved version
  of the audit's "Data-Saver toggle"): no manual toggle — animations cost CPU,
  not data, and a switch nobody finds helps nobody. Instead the app reads the
  browser's own signals: `navigator.connection.saveData` (the user's OS-level
  Data Saver, exposed by Chrome on Android — exactly our audience) and
  `effectiveType` (`"3g"`/`"2g"`). When either says constrained:
  **lengthen the polling intervals** (the real data eater — the dashboard's
  pollers, not the visuals), pause ambient animation (aurora, marquee, ticker
  pulses — reduced-motion plumbing already exists everywhere new), and defer
  heavy assets. One small hook (`useDataSaver()`) consumed by the pollers and
  the atmosphere layer; zero settings UI; helps precisely the users on weak
  networks without them doing anything. Optional later: a one-line "data saver
  on" indicator so support can explain why charts feel slower.

- **Outcome Bundles ("Campaign Goals") — parked design, agreed 6 Sep 2026**
  (the improved version of the audit's bundles item): sell outcomes, not line
  items — "New Brand Launch" packages followers + views + saves in one
  checkout. Two corrections to the naive version: **(1) bundles must resolve
  dynamically, never pin service IDs** — a bundle item is a rule ("the enabled
  Standard-tier Instagram Followers service"), because services retire and get
  swapped (NTR-9182 taught this) and a flagship product must not silently
  break; **(2) bundles are not one-click on inputs** — followers need a
  profile link, views and saves need post links, so the composer asks for
  "your profile + one or two posts" and fans those into the right items. The
  rails already exist: bulk checkout places up to 50 orders with
  retry-then-refund, so a bundle is a curated bulk template with a friendly
  face. Surface as a "Campaign Goals" entry on the order page (and a landing
  section later). Admin: bundle builder (name, pitch, item rules, quantities).
  **Open for Trip:** the bundle list (Brand Launch / Music Drop / Going Viral
  etc.), whether bundles carry a small discount (it is the incentive, and it
  is margin), and whether resellers see them (probably not — they compose
  their own).

- **Guest-feel checkout ("order first, account at payment") — parked design,
  agreed 6 Sep 2026** (build when Trip reopens it; more audit items incoming):
  an external audit flagged "no guest checkout" as a conversion barrier. Half
  the claim is already false — `/pricing` is public, server-rendered from the
  live catalogue, and headlines "Every price in naira, before you sign up" —
  so pricing visibility needs nothing. The real wall is **testing the
  platform**: today it is signup → fund wallet → order, three steps before any
  value. The agreed answer is NOT true guest checkout, for three structural
  reasons: refunds and refill cover resolve into the wallet (card reversals
  mean processor fees, delays and disputes); anonymous one-off card payments
  are how carders test stolen cards, and chargebacks endanger the processor
  relationship itself in this vertical; and the wallet is the retention
  flywheel — welcome bonus, referrals and the shelved top-up game all hang off
  deposits. Instead: **keep the account, shrink it, and move it to the end.**

  **The flow.** 1) A public order composer (no auth): pick service and tier,
  paste the link, choose quantity, see the exact naira price live — priced from
  the same catalogue as `/api/pricing` via a public quote endpoint. 2) At pay
  time the buyer gives **email + WhatsApp number only** — no password, no name
  — and the account is created implicitly (passwordless; the NG phone gate at
  `app/api/auth/signup/route.js:45` applies unchanged until International
  Nitro opens it). 3) **One payment sized exactly to the order** — no
  fund-then-order two-step. The charge carries an order intent
  (`{serviceId, tierId, link, qty}` stored with the pending deposit); on
  webhook success `finalizeDeposit` credits the wallet and the order is placed
  in the same transaction chain, debiting the fresh balance — same idempotency
  discipline as the referral/top-up credits. The wallet stays the ledger, so
  refunds and refills land exactly as they do for everyone else. 4) After
  payment: a session via magic link / OTP, an order-status link by email and
  WhatsApp, and a normal account with history waiting when they return.

  **Why this shape wins:** the buyer experiences guest checkout (zero fields
  until pay, one payment), while Nitro keeps the wallet rail, the fraud fence
  (phone + email uniqueness, deposit history, existing velocity checks), the
  bonus flywheel (the payment IS a first deposit), and CAPI identity — email
  and phone hashed at purchase plus the visitor's own fbc/fbp cookies, a
  better match than a true guest could ever give.

  **Touchpoints when built:** public composer component (candidates: landing
  hero, `/pricing`, `/services`); public quote endpoint; implicit-account
  variant of signup (skip password, reuse `check-email`/`check-phone` and the
  phone gate); order-intent field on the deposit + execution inside
  `finalizeDeposit`; passwordless session issuance; the order pipeline itself
  unchanged.

  **Open decisions for Trip:** does the welcome bonus apply to the implicit
  first deposit (it is a first deposit — probably yes, it is the hook); a
  minimum order size for the flow (the ₦1,000 deposit minimum exists); where
  the composer lives; passwordless forever vs a password nudge on the second
  visit; and **measure first** — pull the funnel from `/pricing` and
  `/services` visits to signup before building, because if that leak is small
  this whole item is low priority.

  **Addendum (6 Sep 2026) — measured speed stats:** the audit's "real-time
  speeds" idea joins this item, with one hard rule: provider speed fields are
  never shown (house rule — they identify the source on sight). Instead compute
  Nitro's own numbers from order history — median time-to-start and
  time-to-complete per service over the last ~100 orders — and show them on the
  public composer and service pages as "starts in ~4 min · completes in ~2 hrs,
  measured from recent orders". Honest, ours, and a stronger trust signal than
  any provider claim. Needs a small nightly rollup (order timestamps already
  exist) rather than live queries.

- **Deposit bonus ladder cut — watching, revert if it bites** (1 Sep 2026,
  `v2.4.78`). Every rung was halved to test how much of the ladder's pull is
  the money itself:

  | Deposit | Was | Now |
  | --- | --- | --- |
  | ₦2,500+ | ₦500 (20%) | **₦250 (10%)** |
  | ₦5,000+ | ₦1,200 (24%) | **₦600 (12%)** |
  | ₦10,000+ | ₦3,000 (30%) | **₦1,500 (15%)** |

  **To put it back:** restore those three numbers in `lib/welcome-bonus.js` —
  `TIERS` (in kobo: 50000 / 120000 / 300000), `BONUS_PRESETS`, `bonusForNaira`
  and `nextBonusTier` — then run
  `grep -rn "up to ₦1,500" lib components` and set the copy back to
  "up to ₦3,000" everywhere it appears (12 files: emails, landing page, auth
  modal, order form, order tour, add funds, dashboard nudge, Lagos page, FAQ
  answers in `service-type-meta.js`, and the assistant's `lib/ify/knowledge.js`
  tier list). Nothing else moves; there is no migration and no setting.

  **What to watch, and the numbers before the cut** (90 days to 1 Sep): first
  deposits clustered hard on the thresholds — **₦2,500: 529 people, ₦5,000:
  374, ₦10,000: 106**, against only 26 at ₦3,000 and 10 at ₦4,000, with 271 at
  the ₦1,000 minimum and 444 (29%) depositing under ₦2,500 at all. Bonus paid
  was ₦1,159,400 face value over the quarter (~₦143k/month, ~₦53k/month real
  at the 37% provider cost of spend-only credit) against ₦5.6M gross profit
  from those same customers. **The tell that it bit:** the ₦2,500 spike
  collapsing toward ₦1,000. Rerun the clustering query after two weeks — if
  the median first deposit falls or the ₦1,000 bucket swells past ~35%, the
  ₦2,500 rung is the one to restore first (it does the activation work; the
  ₦10,000 rung is the safest to leave cut).

- **Cash referrals — launch checklist** (built dark in v2.4.75; flip
  `cash_referrals_enabled` to `'true'` to go live): admin payouts page (the
  API at `/api/admin/referral-payouts` already lists/completes/rejects), the
  referrer "your cash is on hold" email (the wallet email correctly stays
  silent in cash mode), void-on-refund for reversed deposits, Terms update for
  cash payouts, and Trip's sign-off on the four numbers (₦500 cash / ₦600
  wallet / ₦2,500 gate / ₦5,000 min · 7-day hold — all settings:
  `ref_cash_amount`, `ref_cash_wallet_amount`, `ref_cash_min_payout`,
  `ref_cash_hold_days`).

- **Monthly top-up bonus — launch checklist** (built dark in v2.4.89; set
  `topup_bonus_enabled` to `'true'` to go live): the instant-unlock ladder —
  cross ₦30k in a Lagos calendar month → ₦1,500, ₦60k → +₦2,700, ₦100k →
  +₦5,800 (cumulative 5%/7%/10%), paid inside `finalizeDeposit` as spend-only
  BonusCredit (`source 'topup_month'`, 30-day expiry), first-ever deposit and
  resellers excluded, one award per user/month/rung via transaction
  idempotencyKey `topup:YYYY-MM:r<minKobo>`. The wallet card, amount nudge and
  unlock toast render only when the flag is on. Settings:
  `topup_bonus_rungs` (JSON `[{min,prize}]` kobo), `topup_bonus_expiry_days`.
  Before flipping: Trip signs off the rungs, decide whether the deposit email
  mentions the prize (Telegram already counts it in the bonus total), and
  watch the monthly cost against the ~₦45k face estimate. Design notes:
  mock artifact 7adc3631, backend brief artifact 5b60a686.

- **Scale ladder gate — measure from the database, not Meta** (note, 4 Sep 2026):
  the CAPI identity fix (v2.4.99) will make cost-per-order and ROAS look better
  from 4 Sep for measurement reasons alone — Meta correctly claiming orders it
  already drove. The Lagos ₦30,000 → ₦39,000 budget step stays gated on cost
  per new customer under ₦1,600 measured from **real signup counts in the DB**,
  not Meta-attributed orders. Match-quality verification ~8 Sep: if phone
  coverage reads high but the Purchase score is still 7.5, suspect
  normalisation. No metric comparisons across the 4 Sep boundary.

- **International Nitro — parked design, agreed 4 Sep 2026** (build nothing
  until Trip reopens it): Nigerians keep the cheaper Nitro; foreigners pay a
  premium. The mechanism is **one padded exchange rate, not a second price
  list**: the wallet and the whole catalogue stay in naira forever, and a
  foreign-currency deposit (Flutterwave USD, and the crypto rail) credits the
  wallet at Nitro's own sell rate set below mid-market — market ₦1,529/$,
  credit at e.g. ₦1,300/$ ≈ +17% — so the premium follows the **payment
  currency**, not nationality or IP, needs no detection, and extends to
  GHS/KES/GBP as the same % over mid-market. One admin setting (fx sell rate
  or premium %); "≈ $" display prices are computed at the padded rate so what
  foreigners see is what they pay. **Premium % is undecided** — the ~15–20%
  above is a placeholder for Trip to set. The signup gate lives at
  `app/api/auth/signup/route.js:45` (rejects anything not `[789]`+9 digits):
  opening it means generic E.164 (8–15 digits with country code), strict NG
  validation kept for local-looking numbers, plus touches to `check-phone`,
  the auth modal's +234 UI, and admin phone search; wa.me links, phone
  uniqueness and the CAPI hasher already handle foreign numbers. **Sequence
  when reopened:** 1) open the phone gate (small — it is also the demand
  meter), 2) "≈ $" at the padded rate on pricing/order/add-funds (small),
  3) Flutterwave USD collection crediting naira at the padded rate (medium),
  4) never multi-currency wallets.

  **Addendum, 7 Sep 2026 — reopened; step 2 shipped** (`80ec76d6` v2.4.104,
  with `0237a2f1` for the hamburger). Currency and language switchers on all three navs
  (labelled on desktop, icons only on a phone); prices on pricing/services,
  the dashboard balance and the order-form total convert at one resolved
  deposit rate via `lib/currency.js` + `components/locale.jsx`; public
  `/api/fx`; admin "Foreign deposits" card on the pricing page. Decisions
  made: **premium is 15%**, admin-editable (`fx_premium_percent`), stored as a
  percentage so it keeps its meaning as the naira moves. **No currency lock**
  — the premium sits inside the exchange at deposit, so switching the display
  cannot dodge it (three tests pin this); a lock would also have trapped
  Nigerian USDT payers, since crypto is dollar-denominated. **The balance
  converts** on the same rate as prices, so "can I afford this" has one
  answer in any unit. Naira is shown alongside a foreign figure in exactly one
  place: the crypto modal's rate line.

  **Two corrections to the entry above.** (1) The worked example's "market
  ₦1,529" was `markup_usd_rate` — market plus the ₦200 pricing cushion. Real
  mid-market was ≈₦1,324; every figure here was recomputed on it. (2) The
  crypto rail has always credited at that cushioned rate, i.e. **above**
  market — a ~13% subsidy on every USDT deposit that nobody chose. It now reads
  `lib/fx-deposit.js`; with `fx_premium_live` off (the default) behaviour is
  byte-identical, and flipping it on moves USDT to the premium rate. That flip
  is ~36% more dollars per naira for USDT payers, mostly in Nigeria, so it is a
  deliberate act in Admin, announced first — not a side effect of shipping.

  **Addendum, 12 Sep 2026 — step 3 built (v2.4.140), country-driven.** The
  Flutterwave charge currency follows the signup country (GH → GHS, KE → KES,
  GB → GBP, US → USD, else NGN), because mobile money — how Ghana and Kenya
  pay — only appears on a charge in its own currency. The naira credit is
  fixed at initialise from `resolveDepositRate()`, the foreign figure is
  ceiled to the cent and stored on the row (`providerPriceAmount/Currency`),
  verification checks that quote and that currency, and the wallet is credited
  the stored naira, never the foreign minor units. Missing rate → naira charge,
  as before. **The premium is the same admin flip as USDT, and in production
  it is ON** (`fx_premium_live=1`, 15%, checked 12 Sep): ₦5,000 costs a
  Ghanaian GH₵49.39 against GH₵42.94 at market — +15.0% — and the same +15%
  in KES, USD and GBP. Turning the flag off would put every foreign charge
  at the legacy cushioned rate, ~13% *below* market, the subsidy described
  below. Either way it is one switch in Admin, never a side effect of a
  deploy. The add-funds box speaks
  the picker's currency now that the switcher is live (12 Sep); Flutterwave's
  own page shows the cedi figure.

  **Still open:** step 1 (phone gate — foreigners still cannot sign up); the
  "Soon" tags on Pidgin/Yoruba/Hausa/Igbo/Kiswahili/Français are a public promise Trip has
  not yet confirmed; language is a shell (English only, no i18n); and Trip
  wants "refund to your bank" removed from the refund policy — its own commit
  with the policy date bumped, and it removes the foreign-refund question.

- **Landing redesign v2 — parked, Trip not yet impressed** (4 Sep 2026): the
  full build lives on local branch `landing-v2-wip` (commit `d1838b9f`, never
  pushed); the design mock is artifact `213efb73`. What it contains: a
  one-viewport fold (sticky nav with centred links and announcement bar above,
  hero with a working order-starter widget priced from `/api/pricing`, platform
  marquee, clean stat band), Why Nitro with the five feature cards and both
  product screenshots, priced platform list, three steps, pricing cards,
  resellers section with the Emeka quote, single blush pull-quote, plum closer,
  existing footer; fully theme-tokenised (light and dark verified), trust line,
  gift-icon CTA, height-stepped fold, no em dashes in copy, honest platform
  count (`uniquePlatforms`, fixing the old 152+ groups-as-platforms bug).
  Standing taste notes from the rounds: no duplicated stats or CTAs, bare-number
  stat band not cards, icons not text and positioned in true empty zones,
  hamburger only below desktop, login prominent but not oversized, sections must
  not blend (alternating surfaces), richness over minimalism below the fold.
  Next session: either iterate on the branch or restart the design; the current
  production landing is untouched.

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

- **Currency switch — every money figure in the user dashboard follows the
  picker** (7–8 Sep 2026, `3a83005b` → `bc3b40ec`, all under `v2.4.104`).
  Landing, overview, new order, order form, wallet (deposit box, native
  quick-picks, bonus cards, summary, coupons, ledger), rewards, tasks, earn,
  orders, referrals, reseller HQ and catalogue. The rule that settled every
  edge: **the wallet converts, the bank does not** — anything landing in a
  Nigerian bank account (transfer sheet, cash referrals, crew payouts) stays
  naira, as does "1 point = ₦1" and every "you will be charged ₦…" line, since
  Flutterwave collects naira. Rounding got a direction: prices up, balances and
  benefits down — which fixed a live bug where 60 accounts were shown more
  money than they held. Cannot convert: 6,985 transaction descriptions with
  naira baked into the string at write time; the amount beside them does. Two
  dashboard crashes shipped from the same mechanical edit (a `money()` call in
  a component without the hook, then one above its declaration); the guardrail
  in `tests/money-hook-scope.test.js` now checks presence and order. The picker
  went live in production on 12 Sep (`SWITCHER_LIVE`).

| Date | Item | Commit |
| --- | --- | --- |
| 2026-09-12 | Meta CAPI sends the hashed account country on every Purchase and CompleteRegistration (match quality for the scale-ladder measurement) | `70fe9a2b` v2.4.141 |
| 2026-09-12 | Currency picker live in production with all five currencies selectable; Flutterwave checkout asks for mobile money in Ghana/Kenya and cards everywhere by sending payment_options per charge currency | `d233127f` v2.4.140 |
| 2026-09-07 | Offline screen: the installed app no longer shows the browser's error page when signal drops. A real service worker precaches one self-contained page and serves it on a failed navigation; it never caches an API response, so no balance is ever shown from cache. Agreed scope: dashboard only, no figures on screen | `e4ed4f0f` v2.4.103 |
| 2026-08-31 | Admin table headers align with their rows (fixed actions column) and dense tables scroll rather than clip | `f21c93e4` v2.4.59 |
| 2026-08-31 | Pulse shows the day's margin as profit on cost beside the profit figure | `7e927581` v2.4.60 |
| 2026-08-31 | Rewards gets its own page with the tier colours, gold points and the ladder; the two pop-ups stay and link to it; Guide is a searchable reading list; the task editor is two columns with a live preview and folded limits; row actions can no longer be pushed off a card | `20520632` v2.4.59 |
| 2026-08-30 | Changelog (collapsible composer, proper editor height) and Tasks (submissions first, proof on the row, reject reason) rebuilt with page-shaped skeletons; Announcements composer taller | `ca4494b4` v2.4.53 |
| 2026-08-30 | Single-day orders no longer refused above ~2,600 followers: the intraday scheduler is capped to a day and sends larger batches (customer, bulk, reorder, admin paths) | `c3ab862a` v2.4.52 |
| 2026-08-30 | Crew rebuilt on the shared frame with a drawer, facts and page-shaped skeletons | `e2a55dd4` v2.4.51 |
| 2026-08-30 | Rewards, Blog, Email blasts, Promotions, Tracking links and Outreach rebuilt to their mocks with page-shaped skeletons | `2632662d` v2.4.50 |
| 2026-08-30 | Terms and Refund Policy dated 29 August: unused wallet funds refundable on request (bank or wallet); order refunds stay in the wallet | `c8cbb659` v2.4.49 |
| 2026-08-30 | Right rail rebuilt as one system on both sides (eyebrow + card, three row kinds), every page rail rewritten to it | `c1fb6302` v2.4.48 |
| 2026-08-30 | Today starts at Lagos midnight on the server everywhere (Payments facts, Users week/month, outreach day windows) | `fb57fa20` v2.4.47 |
| 2026-08-30 | Solid surfaces in both themes on the rebuilt admin pages: selected chips readable in dark mode, drawers and menus opaque | `997388b1` v2.4.46 |
| 2026-08-30 | Skeleton pass: a shared kit shaped like the pages (facts, toolbar, rows) on both sides; no grey slabs, spinners or Loading… text; Orders and Users dim instead of blanking while paging | `3e03b3ad` v2.4.45 |
| 2026-08-30 | Overview rebuilt: today against yesterday, a needs-you strip of doors that open the page pre-filtered, orders by the hour, latest orders, newest customers, what the team did | `66e27aaf` v2.4.44 |
| 2026-08-29 | Refills is a queue, oldest ask first, Send refill and Reset on the row, facts row and Handled list; phone cards read top to bottom | `7f87af5d` v2.4.43 |
| 2026-08-29 | Team as a roster with a drawer (Pages, Abilities, Password); the API page is Providers with balance, menu share, orders, connection, Test and Sync per row and a Last sync card; Maintenance says Online/Offline with the one button, time left, a preview and past downtimes; admin avatar drops the account menu | `61ae3c58` v2.4.42 |
| 2026-08-29 | Issues is one triage list, decisions first then newest, red needs a person and amber can wait; provider balances in the facts row; a Checks card (what runs when, what it last found); Handled list; Run all checks now. Logs is a day-grouped timeline with a who-was-busy facts row and a System tab with a severity bar | `19b97ed6` v2.4.41 |
| 2026-08-29 | Payments rebuilt: facts row (waiting, in today, this month, failed today), waiting rows tinted with Approve and Reject on the row, copyable reference, sender under the method, Needs approval toggle, plain status words; Gateways as doors with live count and share by method; phone cards | `5b9a9199` v2.4.40 |
| 2026-08-29 | Refills badge clears: an admin sending a refill marks the request handled (`refillHandledAt`, new column and migration), a new customer request clears it, and the Refills page and both badge counts show only requests not yet sent | `2af4fdb4` v2.4.39 |
| 2026-08-29 | Landing page scrolls as a normal document on phones and tablets with the nav sticky, so no band of background sits under the footer; desktop keeps the inner scroller and snap | `619b038d` v2.4.38 |
| 2026-08-29 | Admin badges refresh on every page, not only Overview: a light counts endpoint polled every 20s and on arrival, Refills included; the More sheet on a phone gets the rail's rows and eyebrows and its Support row opens the concierge | `d4087f3a` v2.4.37 |
| 2026-08-29 | The dock is five tabs again; WhatsApp is a float above it (bottom-right on a desktop) that opens the concierge panel: We can order for you, the order-page service as one tap, three quick prompts, the paste-your-link field with the same message as before; Support on the rail opens the panel; the mobile Help button and the More-sheet WhatsApp link are gone | `aee479c5` v2.4.36 |
| 2026-08-29 | Comment orders that providers reject: only lines with words count as comments (emoji-only lines do not), said before paying on the customer form, the cart, the single and bulk APIs; admin Create Order now requires comments and other typed input on the services that need them and refuses them in batch mode | `33cb7943` v2.4.35 |
| 2026-08-29 | Finance Breakdown and Rewards rebuilt to the mock: four ledgers (Revenue, Cost, Cash with Refunded to bank, What we owe) each ending on one total, by tier and by platform in the overview's row shape, the top-up form as a card, filters and Export in their own row; Rewards as four facts, two ledgers and an orders-by-status ladder (new in the rewards API), on the shared period picker | `884ef845` v2.4.34 |
| 2026-08-29 | Cash refunds booked: a debit can be tagged "Sent back to their bank" from the Users drawer, stored on the transaction, and Finance shows it as Refunded to bank under cash out; today's refund re-tagged | `e0b97d67` v2.4.33 |
| 2026-08-29 | Finance on a custom range (Last month) read net revenue, refunds and cost up to today, not the range end; fixed in analytics and financials. Admin tab pills take the new segmented look | `b4db6360` v2.4.32 |
| 2026-08-29 | Finance overview rebuilt to the mock: four facts with the period before beside them, a strip showing where the gross went, revenue against cost by day, platforms with profit on cost, cash in by method with wallet liability; the period picker in its own row, no buttons in the header; analytics API carries prev, cost per day and platform, deposits by method | `b4db6360` v2.4.32 |
| 2026-08-29 | Admin Settings rebuilt in the user Settings layout: profile card and facts, Account / Site / Appearance / System groups of rows that open modals, sharing the user page's row, section head and icons; cleanup is a row with a confirm | `b8db42ae` v2.4.31 |
| 2026-08-29 | Left rail rebuilt on both sides: admin jump box (/ to focus), pinned tiles, one-open accordion sections following the page; user eyebrows with a rule, accent-bar active row, muted icons, Tasks and Resellers blue | `f1dc4c99` v2.4.30 |
| 2026-08-29 | Discord members/boost orders and Website Traffic orders get a gate at Place order (bot link as the one button; where visitors show and the targeting read back), a tick that unlocks the order, and a receipt reminder for Discord | `3d31ab42`, `3d31ab42` v2.4.29 |
| 2026-08-29 | stuck_payments only fires for a live deposit; an untrusted read on an Expired, Failed or Cancelled row is counted separately and never pages | `0ca23f5e` v2.4.28 |
| 2026-08-29 | YouTube and TikTok order notices reworded: one pace tile for YouTube (50–500 a day, subscriber orders only), three plain risks and a start-small tip for TikTok | `b90e163e` v2.4.27 |
| 2026-08-29 | Mobile hero card rebuilt to the mock: live strip, numbers on rails (Orders · Accounts · Delivery, centred), gift tile, one button with Log in as a line | `b6280a42`, `9290aad4`, `9290aad4` v2.4.26 |
| 2026-08-29 | Pulse month facts reordered in the one grid: money, orders, people and wallets side by side | `8a817611` v2.4.25 |
| 2026-08-29 | Raw Services lists the services we use first, then A to Z, numbers, symbols, dropdown too; the last raw provider names cleaned in the admin activity feed and cron alerts | `b355c28c`, `62e6b341` v2.4.22 |
| 2026-08-29 | Users profile is a drawer over the list again on desktop, a sheet on phone; transactions in naira | `6f0e48dd` v2.4.21 |
| 2026-08-29 | Admin Create Order shows the typed-input box by the customer rule (custom comments, replies, reviews, mentions, poll, keywords via apiType) | `8614cae4` v2.4.20 |
| 2026-08-29 | Resellers rebuilt to the mock: facts row, one list with a status word, catalogue and rate inline, the reason and who approved, revoked rows dimmed at the bottom, Grant access as a modal from the header, a skeleton in the shape of the list instead of a spinner, phone cards that do not wrap | `ef4285b5` v2.4.24 |
| 2026-08-29 | Pricing rebuilt to the mock, Settings-style: eight tap-to-edit cards that say what each setting does in plain words, each opening a modal that saves itself; Reprice the menu as the one action card; Try a cost and Quick reference stay on the page | `89294f5d` v2.4.23 |
| 2026-08-29 | Raw Services rebuilt to the mock with cleaned provider names: `lib/service-display.js` turns a raw name into a title and facts (used on Raw Services and in Menu Builder), facts row, one toolbar, a list with a named header and the on/off toggle on the row, open row is facts then actions, skeleton while loading | `b5ae880b` v2.4.22 |
| 2026-08-29 | First-look fixes on the four rebuilds: composer closed until opened with (i) explainers on a phone, Users pagination inline and the phone sheet solid and locked, profit on cost on Menu Builder and Create Order, Hide off hides off tiers, phone chips under the icon, Create Order total strip pinned | `928026c2` v2.4.18–21 |
| 2026-08-29 | Users rebuilt to the mock: one flat row of facts, a list with a real header and a status word, chips beside the name, the profile as a panel beside the list on a desktop and a sheet on a phone with facts, actions, credit or debit inline, 90-day spend and the latest transactions | `092847f0` v2.4.21 |
| 2026-08-29 | Create Order rebuilt to the mock: Customer, Service, Order and Delivery as four cards, tier chips that carry price and margin, a drip block that shows the per-day split, the summary beside the form on a desktop and a sticky bar on a phone, Top up on the customer row | `1b246e68` v2.4.20 |
| 2026-08-29 | Menu Builder rebuilt to the mock: one list by platform with real icons, tier prices on every row, margin per tier, Swap and inline edit, platform dropdown, phone cards | `c901e0e1` v2.4.19 |
| 2026-08-29 | Announcements admin rebuilt to the mock: live notices across audiences, a composer with a real preview and expiry, Take down and Restore, Remove only in the past | `06c0af23` v2.4.18 |
| 2026-08-29 | Announcement strip rebuilt to the mock: dot + type word, message, action, "1 of N", dismiss reveals the next; several notices live at once (admin no longer auto-pauses); message box asks for what · effect · what we are doing | `ceac2445` v2.4.17 |
| 2026-08-29 | Order receipt rebuilt to the mock: facts on rails, order number copies, refill stated, same-height carousel with a reseller slide ("Join") that points at /resellers, Tasks slide and nav icon blue to match Home | `efa31747` v2.4.16 |
| 2026-08-29 | Public order count head start 8,000 → 6,000 (20K originally), now one constant in `lib/public-counts.js` shared by site-info and the blog | `d5ceb2b5` v2.4.15 |
| 2026-08-28 | Tasks on both sides, crew payouts and bulk order rows open with the shared look (`lib/expandable-card.js`). Remaining expandables are drawers and modals, which are a different thing | `a05f7c38` v2.4.13 |
| 2026-08-28 | "Which tier?" rebuilt 1:1 to the approved mock: three tap-to-pick columns, tinted head, facts on rails, Most pick badge, selected state, Good/Better/Best and Normal/Priority/First wording; platform picker keeps its structure with the mock's finish (58/54px tiles, 16/15px icons, 10px labels, soft surfaces, "All N platforms" line) | `8aa2a303` v2.4.12 |
| 2026-08-28 | Pulse: third row of month facts (Bonuses, Payouts, Refunds, Cancel rate, Idle wallets; `monthRefunds` added to the API) and the Platforms bar in brand colours via `lib/platform-brand.js` | `22d1a3c9` v2.4.11 |
| 2026-08-28 | Full catalogue orderable: `resolveVisible` and the order path no longer require `Service.enabled` for a full-catalogue reseller; listed + priced + mtp/dao is the rule on both sides | `721ef63a` v2.4.10 |
| 2026-08-28 | `voidCommissions` retries transient connection drops (idempotent), and `/api/cron/commission-sweep` (02:30 nightly) voids any commission still live on a cancelled order and raises a warning if it had to | `ef26967a` v2.4.9 |
| 2026-08-27 | Trip's four: the duplicate "need help ordering" line under search results removed, opened order rows framed like opened service cards on both sides with the header tinted deeper than its body, Pulse deposit channels coloured per method, and every button answers the hand (lift on hover, sink on press, reduced-motion respected) | `828f8979`, `828f8979` v2.4.8 |
| 2026-08-27 | Copy buttons on Referrals and the API docs work again: the v2.4.4 clipboard sweep shadowed a same-named local, so `copyText` called itself until the stack blew and the surrounding catch swallowed it | `d697c7ea` v2.4.7 |
| 2026-08-27 | Gradual orders schedule at any hour and any size: each day's batches get a span budget so they fit inside that day, and a day is the 24 hours from its own anchor unless a delivery window makes it a calendar day | `e8f4a6f4` v2.4.6 |
| 2026-08-27 | Versioning rule states what earns a milestone, and that a long patch run is the healthy case | `fb0a6870` v2.4.5 |
| 2026-08-27 | Admin side, compact and clean — every named piece is in place: sidebar sections with separators (`admin-dashboard.jsx`), reseller programme tiles including "On full catalogue" (`admin-resellers.jsx`), the Tasks submissions review queue with approve/reject (`admin-tasks.jsx`), the Users-list chip. Nothing further is specified; reopen with a named page if one still reads wrong | verified, `fb0a6870` |
| 2026-08-26 | Reseller and API chips on admin orders and the users list, `Placed from` on the order facts; disabled profiles no longer count as resellers; changelog entry for the API launch | `fb0a6870` v2.4.5 |
| 2026-08-26 | Six Sentry issues: Meta CAPI retry and classification, registration through the outbox, clipboard never throws, Prisma read retry, Redis outages are warnings | `b0068b08` v2.4.4 |
| 2026-08-26 | Pulse and Live rebuilt: full viewport, fullscreen, people first, today's figures on their own day lines | `10f4f29c`, `9c4269e0` v2.4.2–3 |
| 2026-08-26 | Outreach paused with a switch every outreach cron honours (Admin → Outreach) | `017fbcd5` v2.4.1 |
| 2026-08-26 | Reseller API carries instructions: `description` and standard `type` on every service, `add` accepts comment lists and traffic targeting | `0750eeaa`, `0750eeaa` v2.4 |
| 2026-08-26 | Reseller API carries instructions: `description` (group note, Discord bot setup with the live link, traffic and comment parameters) and a standard `type` on every service; `add` accepts comments/usernames/keywords and traffic targeting | v2.4 |
| 2026-08-26 | API keys for every verified account at retail; wholesale by approval on the same key; HQ tab in the nav for everyone | `a0aab6af` v2.3.2 |
| 2026-08-26 | Reseller HQ merged with the public resellers page: one component in two states, no child panel; key in HQ and Settings (`/api/reseller/key`, read + rotate); docs at `/resellers/docs`; catalogue points at both | `b0d4a6a3` v2.3.1 |
| 2026-08-26 | Reseller API: `POST /api/v2` in the SMM convention, one order path for web and API (`createOrderForSession`, `patchOrderForSession`, `refillOrderForSession`), curated vs full decided by the key, 584 missing IDs minted (map now 9,806) | `e277fcce` v2.3 |
| 2026-08-26 | Backlog starvation in outreach: priority touches are budget-aware, Backlog keeps a floor of 15 | `815f9655` v2.2.36 |
| 2026-08-26 | Failed deposits: 373/30d were abandoned checkouts (`provider_not_found`), now read "Not completed"; real rejections stay red | `64b17b3e` v2.2.37 |
| 2026-08-26 | Hand-built modals (Rewards, Settings, Home popups) moved onto the `Modal` primitive | `4a27b858` v2.2.38 |
| 2026-08-26 | Full-catalogue name cleanup for resellers: bracket facts → attributes, per-category dedupe, tails without flags, ≤80 chars | `9623e463` v2.2.39 |
| 2026-08-26 | Untracked agent-tooling folders (`.agents`, `.codex`, `.21st`, `.github/{agents,hooks,skills}`) gitignored | `9623e463` |
| 2026-08-26 | First-seen timestamps for Wallet and New Order, with a governed migration | `2b9711e5` v2.2.35 |
| 2026-08-26 | Dashboard redesign round: Orders (both sides), New Order + bulk + modal, Tasks, Home, Settings, Wallet, theme switch, dock, sharper tokens, ground wash and grain | v2.2.20 – v2.2.34 |
