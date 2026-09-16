# The Shelf

The one list — everything built dark, parked, or waiting its turn sits on the
shelf until Trip takes it down. When something ships it moves to Closed with
its commit, so it never gets picked up twice. Update this in the same commit
as the work. (Formerly docs/BACKLOG.md.)

## Open

Grouped by what is actually blocking each one. Verified against the code and the
database on 16 Sep 2026 — several entries had gone stale and are now in Closed.

### Waiting on Trip — one word or one flip

- **Deposit bonus ladder — the restore is built and HELD.** Rungs run
  ₦250 / ₦600 / ₦1,500 live. The restore to **₦500 / ₦1,200 / ₦3,000** is a
  **revert of `235935f5`**, not a retype — that commit carries the copy too (the
  emails, the Lagos page, the FAQ knowledge base, the service-type meta all
  quote the headline). Trip: *"i dont think we need to restore it yet. I will
  tell you when to."*

  The argument for turning it back on, measured after the 1 Sep halving:
  first deposits under ₦2,500 went 28.6% → 36.6% and the ₦1,000 minimum
  17.5% → 27.9%, median holding at ₦2,500; the shift lands on 1 Sep, five days
  before the ad audience widened, so it is the ladder and not the targeting.
  Seven-day value per first depositor fell ₦5,588 → ₦4,438 with repeat
  behaviour flat (1.34 → 1.36), so nobody made it up later — ₦401 of face value
  saved against ₦726 of gross profit lost, about **₦360k a month**. At full
  rates the ladder costs 6.1% of the gross profit it produces (₦429k against
  ₦7.04M) and every rung pulls: 106 people at ₦10,000 against 6 anywhere
  between ₦5k and ₦10k.

- **Cash referrals — built dark, flip `cash_referrals_enabled`** (v2.4.75;
  confirmed still unset). Before it goes live: the admin payouts page (the API
  at `/api/admin/referral-payouts` already lists, completes and rejects), the
  referrer "your cash is on hold" email, void-on-refund for reversed deposits, a
  Terms update for cash payouts, and Trip's sign-off on ₦500 cash / ₦600 wallet
  / ₦2,500 gate / ₦5,000 min / 7-day hold (`ref_cash_amount`,
  `ref_cash_wallet_amount`, `ref_cash_min_payout`, `ref_cash_hold_days`).

  This is the one item that opens a real cash-out path. The welcome bonus is now
  spend-only `BonusCredit` rather than raw balance, so that exposure is closed
  before this ships rather than after.

- **Monthly top-up bonus — built dark, set `topup_bonus_enabled`** (v2.4.89;
  confirmed still unset). Instant-unlock ladder: cross ₦30k in a Lagos calendar
  month → ₦1,500, ₦60k → +₦2,700, ₦100k → +₦5,800 (cumulative 5/7/10%), paid
  inside `finalizeDeposit` as spend-only BonusCredit (`topup_month`, 30-day
  expiry), first-ever deposit and resellers excluded, one award per user per
  month per rung. Before flipping: Trip signs off the rungs, decide whether the
  deposit email mentions the prize (Telegram already counts it), and watch the
  monthly cost against the ~₦45k face estimate. Mock `7adc3631`, backend brief
  `5b60a686`.

### Waiting on data or a date

- **Checkout abandonment — instrumented, not yet running.** `gatewayHandoffAt`
  is stamped immediately before the redirect and `/api/admin/checkout-funnel`
  splits one bucket into **left_at_gateway** (saw the page, walked away — a
  pricing, trust or method question) and **never_arrived** (closed the tab
  before it loaded — a slow handoff, and ours to fix).

  **The clock starts at the deploy, not at 16 Sep.** Checked on 16 Sep: zero
  deposits carry a handoff stamp, because the code is committed and not yet
  live. Read a fortnight from the push, then change the flow — not before.
  Sizing: ~16.6% true leakage, roughly ₦20k/day of deposits and ₦13k/day of
  gross profit, order of ₦130k/month if worked. **Real payment failure is
  0.9%** — the ₦3.25M of "failed attempts" quoted on 11 Sep was abandonment,
  not failure, which is the mistake reading first exists to avoid.

- **Why half of all signups never open the wallet — instrumented 17 Sep, read
  in October.** The second funnel read is done and is in Closed. It found one
  wall and one broken instrument.

  **The wall:** only 47.9% of signups ever open the wallet, and opening it is
  very nearly the whole prediction — **47.5% of those who do pay, against 0.5%
  of those who do not**. It is decided fast: 85.6% of payers deposit within an
  hour of signing up, 93.7% within a day. Not a maturity effect — the cohort
  with 14+ days to act pays at 24.0%, the same as everyone. And nothing reaches
  these people: the only pre-order nudge requires `balance > 0`.

  **What is still unknown, and is the thing worth knowing:** we cannot tell a
  considered no from a four-second bounce. `firstSeenNewOrderAt` used to fire on
  the Services tab rendering, and that is the tab the dashboard opens on, so it
  recorded "logged in". It now waits for a service to be picked (`v2.5.100`), so
  data from 17 Sep onward separates the two. Give it a few weeks.

  **Do not redesign the flow first.** An email is the weakest answer available —
  93.7% of everyone who was ever going to pay had already paid within a day.
  Guest-feel checkout is the only shelf item that removes the wallet as a
  separate destination rather than pointing at it, and this is the first hard
  evidence for it — evidence about *where* people stop, not yet *why*.

- **Scale ladder gate — judge it on database signups, not Meta.** The Lagos
  ₦30,000 → ₦39,000 budget step stays gated on cost per new customer under
  ₦1,600 measured from **real signup counts in the DB**. The CAPI identity fix
  (v2.4.99) makes cost-per-order and ROAS look better from 4 Sep for
  measurement reasons alone — Meta correctly claiming orders it already drove —
  so no metric may be compared across that boundary.

### Waiting on someone outside Nitro

- **Flutterwave USD collection — the last step of foreign payments.** Tested
  live 12 Sep: GHS collects (mobile money shows), KES is built the same way, and
  a USD charge returns *"Oops! No Payment method available."* — Flutterwave
  resolves no method for it. "Pay with international card" means a foreign card
  may pay one of **our** charges; it is not permission to denominate in dollars.
  Until they approve it, USD and GBP are display-only (`canChargeIn()` in
  `lib/currency.js`) and a dollar reader is charged the naira their figure
  converts to.

  **When it is enabled: add the code to `COLLECTIBLE` and nothing else moves** —
  the quote, the stored `providerPriceCurrency`, the verification and the
  per-currency `payment_options` are all already written for it.

  Everything else here has shipped. The phone gate accepts NG/US/GB/GH/KE
  (`2c1ac43a`); the switcher is live with prices, balance and order totals
  converting at one resolved rate; the premium is **on at 15%**
  (`fx_premium_live=1`, `fx_premium_percent=15` — both confirmed in the database
  on 16 Sep). The premium is collected only on a charge Nitro denominates — GHS,
  KES and USDT. A naira charge paid by a foreign card converts at the card
  network's rate, so it collects **0%**; that is structural, and USD collection
  is the only thing that closes it. Which is why an uncollectible currency pick
  falls back to the **country**, never straight to naira — otherwise the picker
  would be a premium waiver.

  **Do not** build per-country wallets or a second price list. The premium lives
  in the deposit rate, and that is settled.

### Designs agreed, not built

- **Reseller tier ladder — scope complete, 12 Sep 2026.** Five tiers (Starter
  10% → Wholesale 30%) on rolling 30-day retail-equivalent spend, automatic
  promotion on the daily cron, month-end demotion after a grace month, one
  Auto / pinned / custom dropdown in the admin drawer. Settled: flat % off
  retail with a margin floor — the thinnest band is 1.5× markup, so any flat
  discount of **33.3% or more sells below cost** (`tests/markup-reseller.test.js`
  refuses it); thresholds count retail-equivalent, because orders store the
  discounted charge and a promoted reseller would slow its own measurement;
  `discountPct` becomes an explicit override, not the rate. The API docs already
  promise this ladder and name a "Scale" tier that exists nowhere; T4 takes it.

  **The margin floor is DONE and shipped ahead of the ladder** (`v2.5.102`).
  Trip's rule, 17 Sep: *"our worst case scenario should be margin of 10% at 30%
  tier."* The tier rate is a ceiling on the discount now, not a promise about it
  — the promise is `price >= cost / 0.9`, applied per service in the price path.
  A reseller on Wholesale gets the full 30% wherever 30% is affordable and 25.9%
  on the thinnest band, which is exactly 10% margin. Measured across the live
  catalogue: 219 quotable services, 10 clamped (4.6%), **0 under 10%**, worst
  case exactly 10.00%. It also closes the rate box for free — 40% can still be
  typed in and simply stops biting where it would cost money.

  **Still to build: the ladder itself and the admin page.** Trip's call on
  shape, 17 Sep: reseller pricing gets **the same band structure as the retail
  pricing page** — a per-band cap on the discount, read from the same
  `markup_brackets` so the two cannot drift, with the floor becoming the
  validation on the input rather than a silent clamp at charge time. Chosen
  shape is **A: one rate per tier plus one cap per band** (11 numbers),
  effective = `min(tierPct, bandCap)`, over B, a full 5×6 matrix. **The cap
  must bind every tier**, not only the top — cap only Wholesale and Scale on 25%
  pays less than Wholesale held at 22%, so climbing a tier raises the price.
  Only Ultra binds on today's brackets; five of six rows read "no cap".
  **Tier thresholds are editable on the page** (Trip: "we need to be able to
  change tier amount"). **Starter's threshold is the price of admission** —
  Trip, 17 Sep: *"if a reseller doesnt hit the volume of start, they drop out of
  the program after a month right?"* The first draft had Starter at ₦0, which
  meant nobody ever dropped out and a reseller doing ₦5k a month was a retail
  customer with a 10% badge — exactly what the break-even table says not to
  create. Now: a new reseller gets one full month on Starter regardless; after
  that, a month under the threshold plus a grace month reverts them to retail
  pricing (profile kept, discount gone, restored the night they clear it again).
  **Starter is ₦100,000 — Trip's number, 17 Sep.** Trade had to move above
  it, so the drawn ladder reads ₦100k / ₦250k / ₦500k / ₦1M / ₦2M; the four
  above Starter are proposals. The rule, in Trip's words: *"a user in starter
  that doesn't hit the minimum after a month gets put on normal pricing"* —
  confirmed, one month, no grace month unless Trip asks for it back (the
  original spec had one; it is a one-line switch). **Lifetime seat, Trip's
  idea: ₦1,000,000 of lifetime retail-equivalent spend keeps the Starter seat
  for good** — the reseller still moves between tiers on rolling volume but
  can never be put on normal pricing. It protects the seat, not the tier: a
  dormant lifetime reseller costs 10% of whatever little they spend, which is
  bounded and cheap; locking Wholesale would not be. Nobody on file qualifies;
  the largest lifetime spend among the three is ₦122,323.

  **Reviewed 17 Sep for leaks and errors** (Trip asked). No provider names, no
  customer data, no cost on any customer-facing surface. Band-level profit
  maths agrees with the per-order run to within ₦900 on ₦4–7M. Four fixes: a
  non-number in a cap box now means "no cap", not 0% (which would have put
  every tier on retail for that band); the simulator never quotes above retail,
  matching `lib/markup.js`; the ceiling display clamps at 0 instead of going
  negative at a high floor; the drop-out rule reads one month, as Trip said.
  Mockups: ladder `02ba676e`, pricing page `4eb3b4ca` (live — every box
  recomputes), **resellers page `ac056a0a`** (17 Sep): the list gains
  tier, mode and a 30-day bar against the amount that holds the tier; the
  drawer replaces the free-text "Personal rate" with Auto / Pin / Custom, shows
  the first-month deadline, the seat progress, their rates by band, and "Rate
  before the ladder" so day one's cut is visible; one new surface, Tier
  history. Built on the three real resellers — all on Starter, first month;
  Emmanuel's four orders all came through the API.

  **Profitability, measured 17 Sep on 90 days of real orders** (₦12.56M
  revenue, 63.4% blended margin, repriced as if every buyer were a reseller):
  every tier is profitable on every order — worst single service 10%, blended
  never under 48.1%. But a 30% discount on a 63% margin business is a **46.4%
  cut in profit**, so the thresholds are the profitability lever, not the
  floor. Break-even volume — how many retail customers' spend a reseller must
  bring to earn the same profit: Starter 1.19×, Trade 1.31×, Bulk 1.46×, Scale
  1.64×, **Wholesale 1.87×**. Below that a tier is a discount to somebody who
  would have paid retail; above it, new money. Set thresholds against this.
  Nothing to cannibalise today: the three resellers on file are all tiny.

  **Open for Trip.** (1) The five thresholds — ₦50k/₦250k/₦750k/₦2M are proposed
  rather than measured; there is no reseller volume to fit a curve to. (2) What
  happens to the three existing resellers on day one: two drop from 15% to 10%
  under Auto, because the global rate is already 20%. (3) The badge must read
  **"up to 30%"** in the docs and the drawer, since the thinnest services charge
  25.9% — a flat claim would be the one untrue thing here. (4) Whether the
  reseller pricing page mirrors the retail one.

  **Found while building:** three services are priced at 1.02×–1.11× markup **at
  retail**, so a walk-in customer already earns us under 10% on them. The floor
  caps wholesale at retail rather than charging a reseller above the public
  price, so those rows are hidden from the reseller catalogue instead. That is a
  stale retail price to fix, not a reseller question.

  **Mockup, 17 Sep 2026: artifact `02ba676e`.** Built on the live brackets
  rather than the defaults in `lib/markup.js`, which are stale — production
  runs a thinnest band of **1.5×** (Ultra at Budget tier), so 33.3% is cost and
  a 30% Wholesale tier leaves **4.8%** margin there. Four questions on the
  mockup for Trip: the five thresholds (₦50k/₦250k/₦750k/₦2M, proposed not
  measured — there is no reseller volume to fit a curve to); what happens to the
  three existing resellers on day one, since two would drop from 15% to 10%
  under Auto; whether 30% is the right top or 25% (which leaves 11.1%); and the
  pricing-page question above. Note the global `markup_reseller_discount` is
  **20%** today, so T3 is the current rate and the ladder moves people either
  side of where they already sit.

- **Subscription — shape undecided, 12 Sep 2026.** Recommendation on record:
  sell **scheduling**, not a discount ("Nitro Auto" — a service and a weekly
  amount that runs itself). A discount subscription answers the same question as
  the reseller ladder and answers it worse. First version charges the wallet per
  run and pauses when it runs dry, sidestepping card tokenisation and dunning
  entirely; card billing only if Auto proves demand.

- **Adjacent products — researched 14 Sep 2026.** Seven digital-goods verticals
  that fit the sentence Nitro already answers: a Nigerian wants a digital thing,
  cannot pay in dollars, needs it in naira from a wallet they trust. Write-up
  with providers, margins and blockers: artifact `59be94ff`.

  Build in this order. **(1) Airtime and data** — VTpass (Nigeria-native, all
  four networks), Reloadly, eBills, 247API. 2–5% on airtime, 3–7% on data
  against 157M mobile internet subscriptions; thin margin on purpose, measured
  on wallet-funding frequency rather than profit. **(2) Gift cards** — Reloadly,
  Bitrefill, 3–10%, and it answers Nitro's own founding complaint aimed at a
  different product. **(3) Bills** — electricity, DStv/GOtv/Startimes, WAEC/JAMB
  pins, same key as airtime. **(4) Travel eSIM** — Airalo Partner API, eSIM Go,
  MobiMatter; the prestige product, not the volume one. **(5) Creator software
  codes** on the gift-card rail.

  **Ruled out by Trip, 17 Sep 2026: nothing gambling-related.** Betting wallet
  top-up was on this list as the largest market of the lot and one line once the
  bills rail exists. It is off, and not on a technicality about merchant
  categories — Nitro is not doing bet-adjacent products. Do not re-propose it.

  **Two hard lines.** Travel eSIM only, **never a Nigerian line** — every SIM in
  Nigeria must be registered against a NIN since 2021 and issuing local lines
  needs an operator or MVNO partner under NCC rules. And **no virtual dollar
  cards** — a different, regulated business with its own licensing and
  chargeback exposure.

  **Ruled out: social account sales and rented OTP numbers.** Every major
  platform prohibits account transfer and Instagram bans on suspicion, so the
  product can be destroyed the day after it sells and the refund is ours; OTP
  rental is the documented standard tool for bulk fake-account creation. Both
  are chargeback magnets, and chargebacks in this vertical endanger the
  processor relationship every other product here runs on.

- **Outcome Bundles ("Campaign Goals") — agreed 6 Sep 2026.** Sell outcomes, not
  line items: "New Brand Launch" packages followers + views + saves in one
  checkout. Two corrections to the naive version: bundles must **resolve
  dynamically, never pin service IDs** (a bundle item is a rule — "the enabled
  Standard-tier Instagram Followers service" — because services retire and get
  swapped, which NTR-9182 taught); and bundles are **not one-click on inputs**,
  since followers need a profile link and views need post links, so the composer
  asks for "your profile + one or two posts" and fans those out. Bulk checkout
  already places up to 50 orders with retry-then-refund, so a bundle is a
  curated bulk template with a friendly face.

  **Open for Trip:** the bundle list (Brand Launch / Music Drop / Going Viral),
  whether bundles carry a discount (it is the incentive, and it is margin), and
  whether resellers see them (probably not — they compose their own).

- **Guest-feel checkout — agreed 6 Sep 2026, and measure first.** An audit
  flagged "no guest checkout" as a conversion barrier. Half of that is already
  false: `/pricing` is public, server-rendered from the live catalogue, and
  headlines "Every price in naira, before you sign up". The real wall is
  **testing the platform** — signup → fund wallet → order is three steps before
  any value.

  Not true guest checkout, for three structural reasons: refunds and refill
  cover resolve into the wallet (card reversals mean fees, delays and disputes);
  anonymous one-off card payments are how carders test stolen cards, and
  chargebacks endanger the processor relationship; and the wallet is the
  retention flywheel. Instead **keep the account, shrink it, move it to the
  end**: a public composer priced from the same catalogue as `/api/pricing`;
  email + WhatsApp number only at pay time, account created implicitly
  (passwordless, NG phone gate unchanged); **one payment sized exactly to the
  order**, carrying an order intent so `finalizeDeposit` credits the wallet and
  places the order in the same transaction chain; then a magic-link session and
  a status link. The buyer experiences guest checkout while Nitro keeps the
  wallet rail, the fraud fence, the bonus flywheel and CAPI identity.

  **Measure before building.** Pull the funnel from `/pricing` and `/services`
  visits to signup. If that leak is small this whole item drops down the list.

  **Addendum — measured speed stats.** The audit's "real-time speeds" idea joins
  this item with one hard rule: **provider speed fields are never shown** (house
  rule — they identify the source on sight). Compute Nitro's own numbers from
  order history instead — median time-to-start and time-to-complete per service
  over the last ~100 orders — and show them as "starts in ~4 min · completes in
  ~2 hrs, measured from recent orders". Needs a small nightly rollup, not live
  queries.

### Content and long tail

- **Reseller API v2** — drip-feed and multi-day parameters, webhooks, per-key IP
  allowlists. Brief: `docs/v2/reseller_api_brief.md`.

- **Outreach re-engagement — paused, no staff.** The ~2,000 signups a month who
  never start a payment. The whole outreach machine is off via Admin → Outreach
  → Pause (`outreach_paused` confirmed `true` on 16 Sep). Resume there when there
  is a team again, then pick this up. The conversion feed and daily roll-up are
  built and waiting behind the same flag.

- **Cohort / ops** — anything the nightly cohort check surfaces. See the
  protected routes in CLAUDE.md.

## Closed

- **Auto data-saver — the connection decides, not a settings toggle** (17 Sep
  2026, `v2.5.101`). The audit asked for a Data-Saver switch. That was wrong
  twice: the things it would turn off — aurora, grain, shimmer — cost CPU and
  battery rather than data, so the name lies; and a setting nobody finds helps
  nobody. `useDataSaver()` asks the browser instead: `saveData` (the OS-level
  Data Saver, which Chrome on Android exposes — exactly our audience) and
  `effectiveType` of 2g/slow-2g/3g, which is measured round-trip time rather
  than the radio badge, so a congested Lagos 4G cell reports honestly.

  When either says constrained: the two dashboard pollers stretch 45s → 135s
  and 60s → 180s, the leaderboard 60s → 180s, and `<html data-saver>` drops the
  aurora, the grain, the star twinkle and four shimmer loops. Re-read on the
  connection's own `change` event, so walking out of wifi onto mobile data
  applies mid-session — and `saving` is in the effect dependencies, because an
  interval already running does not change length on its own.

  **What it deliberately does not touch.** The crypto deposit poll, which runs
  while somebody watches for a payment to confirm — the kilobytes are not worth
  a person believing their money vanished. Every `animate-pulse`, all four of
  which are status indicators (deposit pending, payment confirming, batch
  running, promotion live); a live state drawn as a dead one is a worse bug than
  a warm phone. Skeleton shimmer, which says the page is loading, which is
  exactly what a slow connection needs to be told. And no settings UI, which was
  the point.

- **The "Soon" language tags were already gone** (17 Sep 2026). The shelf
  carried this as an open promise to Trip since 4 Sep. It was stale, and worse,
  partly invented: it named Yoruba, Hausa and Igbo, which have never existed in
  the codebase. Checked against the running code — `AVAILABLE_LOCALES` holds all
  four dictionaries (`pcm`, `fr`, `sw`, `ar`), every currency is `active`, and
  the `Soon` branch in the picker is a guard for a locale that arrives without a
  dictionary, not a label sitting on any of these. Nothing to ship; the only
  change was a comment in `components/locale.jsx` still claiming the set was
  "Empty today". Trip: *"move on from it."*

- **The onboarding funnel, read — and the step in it that measured nothing**
  (17 Sep 2026, `v2.5.100`). 2,082 signups since 26 Aug. The headline of the
  first read was wrong and Trip caught it: *"99% reach the new order cos its
  automatically the first page everybody lands on."* The dashboard opens on the
  Services tab, so `firstSeenNewOrderAt` fired on first render for everybody and
  recorded *logged in*. Checked rather than assumed — of the 20 accounts (1.0%)
  without the stamp, **zero** have a wallet stamp, so those are beacons that
  never ran. The true figure is 100% and the step carried no information; "two
  thirds looked at New Order and never funded" was never a finding. The beacon
  now waits for a service to be picked. **The default landing tab is unchanged
  and intentional** — everyone still lands on New Order; only the measurement
  moved.

  What survived: 47.9% open the wallet, 47.5% of those pay against 0.5% of those
  who do not, 85.6% of payers deposit within the hour, and no message reaches
  anyone who never funded. The open question — bounce or considered no — is now
  instrumented and back on the shelf as a wait.

- **Five more platform pages, and the other twelve ruled out** (17 Sep 2026,
  `v2.5.99`). Threads, Kick, SoundCloud, Bluesky and Deezer now have
  `/services/<slug>` pages — real prose, four translations each, twenty slugs
  crawlable in total.

  The shelf said "17 platforms still have no page" and named kick, threads and
  webtraffic as the next batch. Measuring first changed the answer: **webtraffic
  has no curated group at all** — 95 full-list services and nothing curated — so
  a page for it would have been a headline over a search box.

  The bar was the one the first four cleared: two or more curated groups behind
  the page. Threads clears it by more than any page written so far (10 groups,
  14 tiers, four of them Nigerian-targeted), then Kick (4/4), SoundCloud (4/4),
  Bluesky (4/5) and Deezer (2/2).

  **Twelve did not clear it and are not coming back**: trustpilot, shazam and
  vimeo have a single group each; webtraffic, quora, reddit, onlyfans, kwai,
  applemusic, pinterest, tumblr and tidal have **none**. Thin pages across every
  remaining tile are doorway pages, which Google treats worse than no page at
  all — so writing them would have cost the pages that work. If one of those
  tiles later gains two curated groups it earns a page then.

  The five SEO `<title>` tags stay English like the fifteen before them: they
  target English-language Nigerian search queries, and the i18n baseline moved
  20 → 25 to record exactly that and nothing else.

- **"Lifetime" on a phone, second attempt** (17 Sep 2026, `v2.5.99`). The first
  fix added `'Lifetime guarantee': 'Lifetime'` to `ATTR_SHORT` and shipped, and
  Trip reported the badge still reading long. It was.

  The refill chip is the one badge on a full-list row that is **not** drawn from
  the attribute list. It comes from `row.refillLabel`, and the list that feeds
  every other badge filters refill attributes out by design
  (`attrKind(a) !== "refill"`) — so the chip never met `AttrText` and never met
  the shortening map. UHQ and HQ shortened around it while it stayed long, which
  is exactly what Trip was looking at.

  It renders through `AttrText` now, and a test asserts the chip is not printed
  raw, so the two paths cannot drift apart again.

- **The Sep 2026 neatness sweep is finished, all four decisions taken** (16 Sep
  2026; work itself shipped 14 Sep). The sweep removed 184 unused names across
  69 files, collapsed four copies of one loop and deleted two settings that were
  accepted and ignored (`d51a27a3` `12d3ee4a` `e8d7461a` `e395d281` `7bc31d4c`
  `7c486734` `3a19b4a8` `d57869c2` `9add969d`). The four questions it left open
  lived only in a chat message, which is how they went missing; all four are now
  answered.

  **`lib/crew-bot.js` stays.** 14 of its 22 exports are called by nothing —
  read together they are a crew gamification feature (streaks, milestones,
  weekly winners, commission DMs) written and never wired. **Trip's call: keep
  it, it will be useful eventually.** This line exists so the next sweep does
  not re-propose it.

  **Scripts** (`8c3e60c2`): ten spent one-offs deleted, `scripts/README.md`
  names what every remaining file is for. Four were deleted and put back —
  `cleanup-seed-data.js`, `seed-testuser.js`, `seed-blog.cjs` and
  `seed-production.sql` look spent and are not; somebody had already hardened
  them behind `runGuardedPrismaScript` with a test around them. Six tests failed
  on the delete and were right to. A script with a test guarding it is a script
  somebody owns.

  **`naira()`** (`1bffcfdb`): `lib/money.js` replaced twelve of twenty-three
  definitions. The other eleven stay — each is a different function wearing the
  same name, and the module says which and why. It needed care rather than a
  find-and-replace because the copies disagreed: ₦12,345.67 from the Telegram
  bot against ₦12,346 from the outreach summary for the same kobo.
  `tests/money-module.test.js` pins every old copy against its replacement.

  **Tickets** (`b2a48640` `6614e1d7`): removed once Trip established the bots do
  not need it — nothing in `lib/ify` ever read a ticket back, only wrote one.
  The surface was larger than the entry claimed: it said "legacy read-only
  views" while the daily cron was filing a `TicketReply` on every auto-close. It
  took the admin page, both API routes, the cron pass, the translations, the
  badge, three of the poller's six queries, the dashboard payload, the
  permission entries and the settings toggles. Ify escalation writes one
  `logActivity` line now. **The data stayed** — 46 tickets, 190 replies, all
  Resolved; account deletion still purges a departing customer's and the
  stale-signup sweep still refuses to delete anyone holding one. Dropping the
  models is a separate destructive decision nobody needs to take yet.


- **The whole admin reads days in Lagos now** (16 Sep 2026, `v2.5.98`). Fault 08
  of the 15 Sep tracking review, raised then rather than fixed because
  correcting one page would have made it disagree with every other. `createdAt`
  is a plain timestamp, so a naive truncation cuts the day at midnight UTC —
  1am in Lagos. **275 of 10,050 orders over 90 days, 2.7%, sit in that hour**
  and were being reported on the day before they happened.

  Three faults, not one. The presets on both finance pages counted back in raw
  milliseconds from the current instant, so "Last 30 days" meant thirty days and
  one afternoon, the oldest day was a fragment, and the total moved while you
  watched it. The date picker beside those presets cut its days in UTC on
  financials and in Lagos on analytics, so the same fortnight gave two answers
  depending on which page you asked. And its end edge was set with `setHours`,
  which is the server's timezone rather than anybody's — an hour that moves with
  the deploy region.

  `lib/acquisition-window.js` is now `lib/report-window.js`, because it stopped
  being about acquisition the moment the finance pages imported it, and it gained
  `reportWindow()` — one resolver for every admin range, deferring to the
  charts' own `windowFor` for the day ranges so a page and the chart on it can
  never mean different weeks. Every window closes exclusively, custom ranges
  included; the analytics chart walks true Lagos day starts instead of
  `setDate`. Totals move by under 0.5% — that is only the partial fragment
  going. The invariant is in CLAUDE.md so it does not drift back, along with the
  line that matters: a rolling duration (a 30-day expiry, a 7-day hold) is a
  different thing and stays raw milliseconds.

  `/api/cron/cohort-stats/acquisition` already cut in Lagos and is PROTECTED —
  untouched.

- **The tracking panel's seven faults are fixed, and the feed pings live**
  (16 Sep 2026, `v2.5.80` and `v2.5.97`). The 15 Sep review found nine things
  wrong with tracking-link analytics; 01–07 were approved and are now all shut,
  pinned by `tests/tracking-link-analytics.test.js`. Five of them were one bug
  wearing different clothes — nobody agreed what "the last 30 days" meant. It
  meant now minus 30×86400000, which lands mid-afternoon and drew a stub first
  bar (65 clicks against a 408 average on alabi-ad, a 6× dip that never
  happened); it meant whatever days the database returned, so a month with
  traffic on ten days drew ten bars and called it thirty; at 24h it meant the
  hour digit, so a window opening at 20:00 drew yesterday's 21:00 at the far
  right. The other two: the card row mixed an all-time numerator with a
  windowed denominator and printed 142.5% conversion, and 30 days was the
  longest range offered for links three months old. Now: one window feeds every
  figure, every slot is emitted whether or not anything happened in it, both
  series sit on the same slots with their own peaks named in the legend, 90d
  and All are offered with the bucket following the range, and the lifetime
  totals live on a strip that says they are lifetime. **Fault 08 is not part of
  this** — it moved to Open, because it is admin-wide.

  The **outreach live feed** shipped alongside it: `tgOutreachConversion` fires
  from `lib/deposit-notifications` the moment a contacted person's deposit
  completes, and `/api/cron/outreach-daily` posts the per-agent roll-up each
  evening — sent even on a zero day, because a silent channel and a quiet one
  look identical. Attribution is **21 days, most recent human touch wins**, and
  the window is measured rather than assumed: of 530 people a staff member
  actually wrote to, 25 deposited afterwards, with the gap running median 2.6
  days, p75 11.2, p90 17.0 and longest 18.9. Seven days would catch 15 of the
  25, 14 catches 20, 21 catches all of them, and 30 catches exactly the same 25
  — so 21 is the smallest window that loses nobody. It shipped at 14 by mistake
  and was corrected to Trip's recorded call. **If this ever decides pay or
  rank, tighten it to 14.** The recycler's `expired` rows can never earn
  credit. Still gated on `outreach_paused`, so it stays quiet while outreach is
  off for lack of staff.

- **The welcome bonus is spend-only credit now, and it never expires** (16 Sep
  2026, `v2.5.95`). It had been plain balance since launch: 1,349 grants,
  ₦1,293,050, more than half of every naira sitting in a wallet, with nothing
  marking it as promotional. "Bonus cannot be withdrawn" was true only because
  no withdrawal path reads `user.balance` — a promise kept by accident, and
  cash referrals would have opened exactly such a path. It now writes a
  `BonusCredit` the way the top-up bonus and win-back credit always have.
  **No expiry**, on the measurement: 91.0% of recipients order within 24 hours
  and 94.5% within 30 days, so a 30-day deadline would have motivated nobody
  and put a clock on 1,277 people's money to recover ₦51,250 from 72 who never
  ordered at all. `expiresAt` is nullable so "never" is representable rather
  than faked with a far-future date; Postgres sorts NULLs last, so a perishable
  win-back credit is always spent before the permanent welcome one.
  **Not backfilled** — deliberately. The 1,349 existing grants have no row and
  will not get one: most of that money is long spent, so a backfill would claim
  the full grant still remains and put a bonus line on wallets whose owners
  would have no idea what it referred to. Going forward only.

- **`ResellerProfile.catalog` dropped, and the full list has a guide** (16 Sep
  2026, `v2.5.93`). The column had been unread since `v2.5.77`; the three values
  it held are recorded in the migration itself so the history survives the drop.
  And the full list now has "How to read this list" — six annotated facts off a
  single row, reachable from the notice above it, reopenable. The order tour
  could never teach this: it forces the curated view on purpose, because its
  argument is that Nitro tests the picks.


- **The `[dir="ltr"]` trap is written down and the three fixes are pinned**
  (16 Sep 2026, `v2.5.92`). CLAUDE.md now has a section on why a media query
  cannot outrank a `[dir]` rule, the three bugs it caused, and the three fixes
  that work — logical property first, out-specify second, mirror the pair
  third. A general detector was measured and rejected: two of the three were
  Tailwind utilities, so no scan of `globals.css` would have found them. The
  tests pin the fixes instead.


- **The array-literal blind spot is ratcheted shut** (16 Sep 2026, `v2.5.91`).
  `[value, "Orders"]` was invisible to the detector, which is how English
  shipped on the Arabic hero under a green guard. A hard rule was measured and
  rejected: 534 strings across 40 files match, and most are correctly English.
  Instead every file carries its 16 Sep count as a budget it may never exceed,
  and the 43 files at zero can never gain one. Proven against the original bug.


- **Four platform pages written, so the landing claim has some evidence**
  (16 Sep 2026, `v2.5.90`). WhatsApp, Audiomack, Boomplay and Google — picked
  on depth rather than count, each with curated groups and real full-list
  volume. 11 crawlable slugs to 15. 68 new strings, translated into all four
  languages. The remainder is in Open above, ranked.


- **A pinned handle follows the person, not the phone** (16 Sep 2026,
  `v2.5.89`). `User.pinnedLinks` holds a JSON map of platform id to link, served
  on the same request that fetches the recent links so the page still makes one
  call. One pin per platform, because one box gets filled; cleared with a null
  link rather than a second action; and the column is parsed defensively since
  it is text and may hold anything. Migration applied.


- **A dismissed notification stays dismissed on every device** (16 Sep 2026,
  `v2.5.88`). The bell's × hid the row where it was tapped and marked it read
  everywhere, so it came back on a laptop as an ordinary read line. `User.
  notifClearedIds` mirrors `notifReadIds` — a JSON array in a nullable text
  column, capped at 500, merged on write so two devices cannot erase each
  other's dismissals. Migration applied.


- **Deposits that succeeded at the bank but not at the quote have a surface**
  (16 Sep 2026, `v2.5.87`). A Flutterwave mismatch parked as `Review` and told
  only Sentry — Admin → Payments lists manual and crypto, so the row rendered
  nowhere and the money sat in our Flutterwave balance uncredited. It now shows
  above the filters (a status filter could otherwise hide it), across every
  method, with quoted, arrived and the gap, and a button that names the figure
  rather than saying "approve".

  The rules that decide how money moves are in `lib/payment-review.js` and
  pinned by tests: credit what arrived and never the quote, never more than was
  quoted, no invented rate for a currency we do not hold one for, claim the
  review before the credit so a race cannot pay twice, and hand it back if the
  credit fails. A reference mismatch with a matching amount carries a warning,
  because that is also what a double charge looks like.

  Evidence is written into the note as `[flutterwave_paid:…]`, the same way this
  table already carries `[approved_by:…]` — no migration, and the figures travel
  with the row instead of living in an alert. Zero of these existed when it was
  built.


- **jap is disconnected** (16 Sep 2026, `v2.5.86`). Removed from `lib/smm.js`
  (the register), the balance, prices and daily crons, the admin sync, topups,
  issues and pricing pages, the env validation and the pull-providers script —
  eleven files, because several wrote `['mtp','jap','dao']` out by hand instead
  of reading `PROVIDER_IDS`. `tests/provider-register` now pins that, so the
  next provider change is one edit.

  The 6,023 service rows stay: 22 orders point at them, and deleting them would
  either be refused by the foreign key or erase what those customers bought.
  They are `providerListedAt: null` and `enabled: false`, which is what every
  catalogue query already fences on. CLAUDE.md says so, and says not to tidy
  them up.


- **The two empty groups are filled, and the hole that emptied them is shut**
  (16 Sep 2026, `v2.5.85`). Threads Followers and X/Twitter Followers 🇺🇸 were
  enabled with zero tiers, rendering as cards a customer could open and buy
  nothing from. Both have real supply, so both got a Budget/Standard/Premium
  ladder off mtp and dao — ₦3,162 / ₦15,192 / ₦40,363 and ₦4,082 / ₦10,660 /
  ₦50,612 — each refill promise matching what the provider states in its own
  name, all priced by `calculateTierPrice`.

  The guard the note asked for already existed in two places and missed the
  third: enabling a group with nothing orderable is refused, and disabling the
  last orderable tier takes the group with it, but **deleting** it did not.
  That is how all three stranded groups actually happened. `delete-tier` calls
  `closeStrandedGroups` now. Enabled groups with no enabled tier: 0.


- **jap is down to zero live tiers, so the provider can be dropped** (16 Sep
  2026, `v2.5.84`). Clubhouse Followers and the three Tidal groups are switched
  off — five tiers, zero orders between them all time, and no honest replacement
  in the catalogue: the only Clubhouse candidate is Turkish-only and the only
  Tidal match is a one-month subscription package. Tiers are disabled rather
  than deleted, so the price history survives and a switch back is one flag.
  CLAUDE.md's note that 14 jap tiers block removing the provider is now stale:
  **0 enabled, in 0 enabled groups.**


- **Two of the seven jap tiers moved to providers we are keeping** (16 Sep 2026,
  `v2.5.83`). Boomplay Streams 🇳🇬 to an mtp service that is both cheaper
  ($2.97 against $3.08) and actually Nigerian, with identical limits — the
  first search missed it because it carries the 🇳🇬 flag rather than the word.
  SoundCloud Plays to mtp at $0.95 against jap's $0.28, which is the real cost
  of leaving jap and shows up as ₦1,563 → ₦3,432 per 1,000. Both repriced by
  `calculateTierPrice`. The five that remain are in Open above.


- **Spotify is fully off `jap`** (16 Sep 2026, `v2.5.82`). Two of the three
  tiers on the shelf note had already been re-pointed at mtp and dao by the
  15–16 Sep cleanup; the third left "Spotify Podcast Plays" as an enabled-
  looking group with no tiers in it, switched off so it would not render a card
  with nothing to order. It carries a dao Standard tier now — global, lifetime
  guaranteed, 10K-1M/day — priced by `calculateTierPrice`, the same function the
  nightly prices cron uses, so the row is not a hand-typed number the next run
  quietly corrects. All twelve Spotify groups are live and none is jap-backed.


- **The tracking panel, the full list's words, the landing catalogue section,
  one reseller catalogue, the sky theme control and the Arabic nav**
  (16 Sep 2026, `d969c76b`..`a3471b96`, `v2.5.74`–`v2.5.79`). Six issues in one
  push: the All range serving seven days and the 145.3% conversion; the
  traffic-source classifier plus Instant / 0-24 hours / UHQ / HQ and the facet
  menus that offered what they did not have; landing section 03 with counts read
  live from `buildAll`; the reseller API dropping the curated tiers and the
  per-account flag, and the provider's own category stopping at the door; the
  three-stop sky replacing the grey theme pill; and the nav hairline hover with
  the two RTL faults behind it. Follow-ups from the same push are in Open above.


- **Currency switch — every money figure in the user dashboard follows the
  picker** (7–8 Sep 2026, ending `9aecd275` — the range start was squashed away, all under `v2.4.104`).
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
| 2026-09-15 | Full list types re-sorted across all 28 platforms, not the seven first sampled: Members split out of Followers (472 services needing a channel link, not a profile), Shares made its own type (307 that sat in two places — Instagram Reposts as likes, X Retweets as engagement, the same action), and the catch-all read end to end, 300 labels down to 223. Every move was a real mis-bin: "Follow" rather than "Followers" (Deezer, Quora, Spotify page follows, LinkedIn connects, friend requests), star ratings as reviews, up/downvotes that a word boundary stopped reading as votes, profile visits as views. Spotify restored: 13 tiers and their services re-enabled, 3 jap-backed ones left off | `4f9159de` v2.5.5 |
| 2026-09-15 | New Order gains a second catalogue. Nitro picks is untouched — the only addition on that side is the two-tab selector; everything new is the Full list: the 9,748 provider services that were imported, priced and refreshed nightly but invisible, now orderable by anyone. Instagram's 1,060 become 599 (per-item packages out, exact twins out), labelled in Nitro's words with a test that no provider tell survives, priced above cost or hidden, grouped by type read off the Nitro label, and carrying a like/dislike only someone who has ordered it can cast. Open: which platforms show it — drawn as the ones we sell, and Twitch, Kick and Discord have provider services but no tested tier, so an admin switch per platform would let them in | `445a0b8d` v2.5 |
| 2026-09-14 | Ticket system removed from the code — admin page, both API routes, the writing cron pass, overview counts and list, badge, poller queries, permissions and settings toggles. Ify escalation writes an activity line instead. The 46 tickets and 190 replies stay in the database | `6614e1d7` v2.4.170 |
| 2026-09-14 | One naira formatter replaces twelve of twenty-three `naira()` definitions; the copies disagreed (₦12,345.67 vs ₦12,346 for the same kobo) so rounding is a parameter and every old output is pinned by test | `1bffcfdb` v2.4.168 |
| 2026-09-14 | Ten spent scripts deleted and a README added; four were deleted and restored because tests already guarded them. Dead 615-line `support-page.jsx` removed, and the rest of the ticket surface measured: not read-only, 744 lines plus references across thirteen files | `8c3e60c2` `b2a48640` v2.4.167 v2.4.169 |
| 2026-09-14 | Terms stops offering to return unused wallet money to a bank, a week after the Refund Policy stopped; the two had been contradicting each other and Terms is the one that binds | `cd9068ab` v2.4.166 |
| 2026-09-14 | Dead landing pair and the composer's unrendered upsell data deleted; the three test files reading `landing-page.jsx` now read the live page, which exposed that the public-statistics honesty guard had been vacuous for as long as v3 has been live. Translation debt 293 → 159 strings | `9add969d` v2.4.165 |
| 2026-09-14 | Bell rows open the order or the wallet entry they name; grouped by day; two-line descriptions; per-row dismiss; counted filter chips including Rewards; 10→30 with no dead footer; phone gets the house bottom sheet. Support rows removed — they carried `alwaysUnread`, which no Mark all read or Clear all could touch, leaving 22 customers with a badge they could not clear; the 25 flags were cleared in the database the same day | `a0d9ec6f` v2.4.164 |
| 2026-09-14 | Saved handles fold behind one line and page three at a time, in the order form and on every bulk cart row, so the form's height stops depending on how many accounts someone orders for | `5cae78e2` v2.4.163 |
| 2026-09-14 | Deposit bonus ladder restored to ₦500 / ₦1,200 / ₦3,000 after the two-week test at half rates: sub-₦2,500 first deposits 28.6% → 36.6%, 7-day value per depositor ₦5,588 → ₦4,438 with repeat behaviour flat, about ₦360k/month lost. Tests now read the rungs from `bonusForAmount` instead of restating them | `8e09ea7f` v2.4.162 |
| 2026-09-14 | Wallet and notifications: bell translates (14 strings, deps fixed), ledger descriptions stop printing raw internal notes (they named admins and other customers), glyph icons become SVG, and the balance follows the currency picker | `2d3c6848` v2.4.161 |
| 2026-09-14 | Public order-count head start 6,000 → 4,000 (real orders 10,363; shown figure 16,363 → 14,363) | `f7d21d81` v2.4.158 |
| 2026-09-14 | Telegram bot: markup was labelled margin (172% beside 63% in one message) — now margin on revenue everywhere; /revenue and /stats stop narrating gross-less-refunded | `f7d21d81` v2.4.158 |
| 2026-09-14 | Browser-extension noise filtered from Sentry: MetaMask rejects a plain object with no frames, so the hint is now checked and extension-rooted stacks are dropped | `f7d21d81` v2.4.158 |
| 2026-09-13 | Four dropdowns anchored again after the RTL pass added insetInlineEnd as a duplicate style attribute (silently dropped by JSX); react/jsx-no-duplicate-props now an error | `ebe1feb3` v2.4.155 |
| 2026-09-13 | Admin create order names the missing tier instead of quoting ₦0, and a free order shows the value it gives away and the cost it spends | `5018d2c3` v2.4.156 |
| 2026-09-13 | A free admin order now needs a reason, records it in the activity log, and raises a Telegram alert with the value given away and the provider cost | `c14a9d13` v2.4.157 |
| 2026-09-13 | Acquisition endpoint: first-ever orders and signups per Lagos day plus signup→buyer by week, behind the cohort reader's tokens, under the robots-allowed prefix — retires the hand-derived cost-per-customer factor | `563a83f5` v2.4.154 |
| 2026-09-13 | Abandoned Flutterwave checkouts read "Not completed" in the wallet and "not completed, nothing charged" on return — not Expired/Retrying, not "could not be reached" | `32d7e188` v2.4.132 |
| 2026-09-13 | The tidy: 184 unused names across 69 files brought to zero outside parked/frozen files — dead imports, props, helpers, components, colour tables, two ignored rate-limit knobs and an ignored tgOutreach param; i18n record followed down | `61f1d8df` v2.4.152 |
| 2026-09-13 | partialAdjustment shared from lib/ledger.js (was four copies); email.js on the logger; sentry-filters.js wired into the client init; digest's dead month aggregates gone | `38429030` v2.4.153 |
| 2026-09-13 | One definition read everywhere: lib/ledger.js (dead order states, wallet funding) replaces 62 status literals and 21 money-in literals; 25 legacy ledger rows normalised | `973b137f` v2.4.148 |
| 2026-09-13 | Activity is any live order, not Completed only — win-back no longer credits a customer whose last order ended Partial; ad activation and the outreach pool count admin credits as funded | `d6069398` v2.4.149 |
| 2026-09-13 | Admin-placed orders carry source 'admin', send no Meta Purchase (nor do re-dispatches), and fire the shared first-order hook, which now also recognises a first purchase that was a cart | `aad32d5c` v2.4.150 |
| 2026-09-13 | One Lagos-day helper: watBounds gains last/next month and year starts; digest, Financials and top-up bonus stop hand-rolling UTC+1 | `cde599e3` v2.4.151 |
| 2026-09-13 | Google sign-ups could never delete their account (stored with password '', the route demanded a password match); they now confirm by typing their email, password accounts unchanged | `5ba0a43a` v2.4.146 |
| 2026-09-13 | Sentry noise: a crawler's malformed Next-Router-State-Tree header on GET / was reported as a server error; filtered on Next's error codes, everything else still forwards | `dce0a681` v2.4.147 |
| 2026-09-12 | Leak audit of the currency/deposit path: short bank transfers refused (charged_amount read), paid-but-mismatched deposits parked in Review with an alert instead of a silent Failed, Kenya quoted in whole shillings, quote stored as quoted, FX refresh failure alerts, and the premium switch's off position made neutral (market, not the legacy cushion) | `a5d67466` v2.4.145 |
| 2026-09-12 | Closed a premium waiver in the currency picker: an uncollectible pick fell straight to naira, so a Ghanaian reading dollar prices was charged naira at market instead of cedis at the padded rate. Falls back to the account's country first now | `e1aeee3c` v2.4.140 |
| 2026-09-12 | USD/GBP made display-only after a live test returned Flutterwave's "No Payment method available" — dollar collection is an approval we do not have, so those readers are charged naira and their card converts it back; US and GB accounts were hitting the same dead end | `e1aeee3c` v2.4.140 |
| 2026-09-12 | stuck_payments paged on normal operation: it raised on any retryable read, and Rejected/Completed rows were not treated as closed. Now it waits for a row with a prior attempt that is still unsettled 30 minutes on, and owes nothing on a closed row | `c2465363` v2.4.143 |
| 2026-09-12 | Meta CAPI sends the hashed account country on every Purchase and CompleteRegistration (match quality for the scale-ladder measurement) | `9f3bedc2` v2.4.141 |
| 2026-09-12 | Currency picker live in production with all five currencies selectable; Flutterwave checkout asks for mobile money in Ghana/Kenya and cards everywhere by sending payment_options per charge currency | `0a6b8a3b` v2.4.140 |
| 2026-09-07 | Offline screen: the installed app no longer shows the browser's error page when signal drops. A real service worker precaches one self-contained page and serves it on a failed navigation; it never caches an API response, so no balance is ever shown from cache. Agreed scope: dashboard only, no figures on screen | `cc5adbb6` v2.4.103 |
| 2026-08-31 | Admin table headers align with their rows (fixed actions column) and dense tables scroll rather than clip | `22bd31d2` v2.4.59 |
| 2026-08-31 | Pulse shows the day's margin as profit on cost beside the profit figure | `b65eeecb` v2.4.60 |
| 2026-08-31 | Rewards gets its own page with the tier colours, gold points and the ladder; the two pop-ups stay and link to it; Guide is a searchable reading list; the task editor is two columns with a live preview and folded limits; row actions can no longer be pushed off a card | `20520632` v2.4.59 |
| 2026-08-30 | Changelog (collapsible composer, proper editor height) and Tasks (submissions first, proof on the row, reject reason) rebuilt with page-shaped skeletons; Announcements composer taller | `55a878ea` v2.4.53 |
| 2026-08-30 | Single-day orders no longer refused above ~2,600 followers: the intraday scheduler is capped to a day and sends larger batches (customer, bulk, reorder, admin paths) | `2e92e323` v2.4.52 |
| 2026-08-30 | Crew rebuilt on the shared frame with a drawer, facts and page-shaped skeletons | `08fdb9aa` v2.4.51 |
| 2026-08-30 | Rewards, Blog, Email blasts, Promotions, Tracking links and Outreach rebuilt to their mocks with page-shaped skeletons | `2632662d` v2.4.50 |
| 2026-08-30 | Terms and Refund Policy dated 29 August: unused wallet funds refundable on request (bank or wallet); order refunds stay in the wallet | `8517a5e1` v2.4.49 |
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
