# The Shelf

The one list — everything built dark, parked, or waiting its turn sits on the
shelf until Trip takes it down. When something ships it moves to Closed with
its commit, so it never gets picked up twice. Update this in the same commit
as the work. (Formerly docs/BACKLOG.md.)

## Open

- **Deposit bonus ladder — the restore is built and HELD at Trip's word**
  (held 15 Sep 2026). The rungs run ₦250 / ₦600 / ₦1,500 in the code. The
  restore to **₦500 / ₦1,200 / ₦3,000** exists as a commit in history and is
  taken back out by the last commit of the 15 Sep push, so **reverting that
  commit is how it goes live** — do not retype the values. Trip: "i dont think
  we need to restore it yet. I will tell you when to."

  The measurements are recorded here because they were written into the commit
  message that the 15 Sep squash folded away, and they are the whole argument
  for turning it back on:

  - The 1 Sep cut halved every rung to find out how much of the ladder's pull
    is the money itself. It is most of it. In the fortnight after, first
    deposits under ₦2,500 went 28.6% → 36.6% and the ₦1,000 minimum
    17.5% → 27.9%, while the median held at ₦2,500. The shift lands on 1 Sep,
    five days before the ad audience widened, so the ladder caused it and not
    the targeting change.
  - Seven-day value per first depositor fell ₦5,588 → ₦4,438 with repeat
    behaviour flat (1.34 → 1.36 deposits), so nobody came back later to make it
    up. That is ₦401 of face value saved per depositor against ₦726 of gross
    profit lost — about ₦360k a month.
  - At full rates the ladder costs 6.1% of the gross profit it produces
    (₦429k real against ₦7.04M), and every rung pulls: 106 people at ₦10,000
    against 6 anywhere between ₦5k and ₦10k.

  Restoring also moves the copy that quotes the headline — the emails, the
  Lagos page, the FAQ knowledge base and the service-type meta all say "up to
  ₦1,500" while held and "up to ₦3,000" when restored. The revert carries all
  of it; that is why it is a revert and not a hand edit.

- **Reseller tier ladder — parked 12 Sep 2026, scope complete.** Five tiers
  (Starter 10% → Wholesale 30%) on rolling 30-day retail-equivalent spend,
  automatic promotion on the daily cron, month-end demotion after a grace
  month, one Auto / pinned / custom dropdown in the admin Resellers drawer.
  Settled during scoping: flat % off retail with a margin floor (the thinnest
  band is 1.5× markup — the Ultra bracket at Budget tier — so any flat discount
  of 33.3% or more sells below cost, corrected 14 Sep 2026 from the 1.35×/26%
  this entry used to claim; `tests/markup-reseller.test.js` refuses it); thresholds must count
  retail-equivalent, because orders store the discounted charge and a promoted
  reseller would slow its own measurement; `discountPct` becomes an explicit
  override, not the rate; and the floor clamp is worth shipping on its own —
  the rate box accepts anything up to 99% today, not the 40% this entry used to
  say (`app/api/admin/resellers/route.js`, action `rate`, rejects only `< 0` and
  `>= 100`). Latent, not bleeding: the three resellers on file are on 15%, 15%
  and 10%, all well under the floor. Every charge path already funnels through
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

- **Outreach live feed — decided, not yet built.** A Telegram ping when someone
  a staff member contacted goes on to deposit (name, amount, agent, method,
  touch), plus a daily per-agent roll-up. `OutreachContact` already holds
  who/how/when.

  **Attribution: 21 days, most recent touch wins. Trip's call, 14 Sep 2026.**
  Nothing else blocks the build.

  **Measured rather than guessed.** The only outreach that has ever run is
  12–26 Aug: 2,068 touches across 1,429 people, of whom **31 went on to
  deposit** (2.2%). Lag from first touch to first deposit: median 3.1 days,
  p75 11.2, p90 18.9, longest 23.6. So the proposed 14 days would have caught
  24 of the 31 and handed the other 7 to "organic"; 21 catches 30; 30 days
  catches all 31 but buys that last one for nine extra days of looseness, and a
  window exists to exclude coincidence. Most-recent-touch-wins is close to free
  either way: only 182 of the 1,429 were touched by more than one agent.

  **Two conditions on that number.** It rests on 31 conversions from a single
  fortnight, so it is the best answer the data supports and not a proven one —
  revisit after the next outreach run. And **if the feed ever becomes the basis
  for paying or ranking agents, tighten it to 14**: a generous window is free
  when the output is a message saying your call worked, and expensive once money
  is attached to the credit.

  **Why it is still parked.** A feed that fires 31 times in a fortnight is a
  quiet channel, and outreach is switched off for lack of staff
  (`outreach_paused`). Build it when there is a team to read it; the number is
  settled so nobody has to re-derive it.

- **Adjacent products — researched 14 Sep 2026, revisit soon.** Seven
  digital-goods verticals that fit the sentence Nitro already answers: a
  Nigerian wants a digital thing, cannot pay in dollars, and needs it in naira
  from a wallet they trust. Clickable write-up with providers, published margins
  and blockers: artifact `59be94ff`.

  **Build, in this order.** (1) **Airtime and data** — VTpass (Nigeria-native,
  all four networks), Reloadly, eBills, 247API. 2–5% on airtime, 3–7% on data
  against 157M mobile internet subscriptions. Thin margin on purpose: it is a
  reason to open the app weekly, measured on wallet-funding frequency, not a
  profit centre. (2) **Gift cards** — Reloadly Gift Cards, Bitrefill. 3–10%, and
  it answers Nitro's own founding complaint aimed at a different product.
  (3) **Bills** — electricity, DStv/GOtv/Startimes, and WAEC/JAMB pins, same key
  as airtime, no extra integration. (4) **Travel eSIM** — Airalo Partner API
  (200+ destinations, white-label delivery email), eSIM Go, MobiMatter. The
  prestige product, not the volume one. (5) **Creator software codes**, wherever
  the brand issues them, on the gift-card rail.

  **Two hard lines.** **Travel eSIM only, never a Nigerian line** — since 2021
  every SIM in Nigeria, physical or embedded, must be registered against a NIN,
  and issuing local lines needs an operator or MVNO partner under NCC rules;
  foreign-destination eSIMs sit entirely outside that. And **no virtual dollar
  cards** — the obvious next step after gift cards is a different, regulated
  business with its own licensing and chargeback exposure.

  **Check before building: betting wallet top-up.** Commercially the largest
  market here and one line once the bills rail exists, but gambling adjacency is
  a merchant-category question. Get it in writing from Flutterwave that it does
  not change Nitro's category or risk rating.

  **Ruled out: social account sales and rented OTP verification numbers.**
  Every major platform prohibits account transfer and Instagram bans on
  suspicion, so the product can be destroyed the day after it sells and the
  refund is ours; supply carries reclamation and stolen accounts; OTP rental is
  the documented standard tool for bulk fake-account creation. Both are
  chargeback magnets, and the guest-checkout entry on this shelf already rules
  out anonymous card payments because chargebacks in this vertical endanger the
  processor relationship — which is the rail every other product here runs on.

- **Codebase neatness — what the Sep 2026 sweep left as Trip's call.** The sweep
  itself shipped (Phase 1 pipelines `d51a27a3` `12d3ee4a` `e8d7461a` `e395d281`,
  Phase 2 tidy `7bc31d4c` `7c486734` `3a19b4a8` `d57869c2`): 184 unused names
  across 69 files removed, four copies of one loop collapsed, two settings that
  were accepted and ignored deleted. Four decisions were left open and then
  lived only in a chat message, which is why they went missing — they are on the
  shelf now. Two of the original six are since closed (`9add969d`, 14 Sep): the
  dead landing pair and the composer's cross-sell/TIER_COMPARE data.

  1. **`lib/crew-bot.js` — 14 of its 22 exports are called by nothing**
     (re-counted 14 Sep). Used: `sendDM`, `replyInGroup`, `crewWelcome`,
     `crewSignup`, `crewFirstPurchase`, `crewRepeatBuyer`, `crewDmChiefNewLink`,
     `kickFromGroup`. Unused: `crewLeadChange`, `crewFirstBlood`,
     `crewMilestone`, `crewStreak`, `crewWeeklyWinner`, `crewMonthlyChampion`,
     `crewLeaderboard`, `crewAnnouncement`, `crewDailyTip`, `crewDmCommission`,
     `crewDmPayout`, `crewDmNewSignup`, `crewDmFirstPurchase`, `crewDmInactive`.
     Read together they are a crew gamification feature — streaks, milestones,
     weekly winners, commission DMs — written and never wired.
     **Trip's call, 14 Sep 2026: keep it, it will be useful eventually.** Left
     exactly as it is; this row exists so the next sweep does not re-propose it.

  2. **Scripts — done** (`8c3e60c2`, 14 Sep). Ten spent one-offs deleted,
     `scripts/README.md` added naming what every remaining file is for. Four
     were deleted and put back: `cleanup-seed-data.js`, `seed-testuser.js`,
     `seed-blog.cjs` and `seed-production.sql` look spent and are not — somebody
     had already hardened them behind `runGuardedPrismaScript` and written
     `tests/operational-script-safety.test.js` around them. Six tests failed on
     the delete and were right to. A script with a test guarding it is a script
     somebody owns.

  3. **`naira()` — done** (`1bffcfdb`, 14 Sep). `lib/money.js` replaced twelve
     of the twenty-three definitions. The other eleven stay: each is a different
     function wearing the same name, and the module says which and why. The
     reason this needed care rather than a find-and-replace is that the copies
     disagreed on the answer — ₦12,345.67 from the Telegram bot against ₦12,346
     from the outreach summary for the same kobo — so `tests/money-module.test.js`
     pins every old copy's output against its replacement.

  4. **Tickets — done** (`b2a48640` `6614e1d7`, 14 Sep). Removed once Trip
     established the bots do not need it: nothing in `lib/ify` ever read a
     ticket back, only wrote one. The surface was larger than this entry once
     claimed — it said "legacy read-only views" and the daily cron was in fact
     writing, filing a `TicketReply` on every auto-close — so it took the admin
     page, both API routes, the cron pass, the overview's count/list/activity
     translations, the badge, three of the poller's six queries, the dashboard
     payload, the permission entries and the settings toggles.

     Ify escalation now writes one `logActivity` line instead, which lands in a
     feed an admin already reads and needed no migration.

     **The data stayed**: 46 tickets and 190 replies, all Resolved. Account
     deletion still purges a departing customer's, and the stale-signup sweep
     still refuses to delete anyone holding one — both must keep working while
     the rows exist. Dropping the models is a separate, destructive decision
     nobody needs to take yet.

- **Saved handles — the pin is per-device.** Shipped as localStorage in
  order-form.jsx; a synced default needs a `pinnedLinks` column on User and a
  migration. Do it when the first person asks why their pin didn't follow them
  to another phone.

- **Foreign payment methods — steps 1 and 2 shipped 8 Sep 2026, steps 3 and 4
  remain.** Signup accepts NG/US/GB/GH/KE (`2c1ac43a`). Flutterwave charges
  in the customer's currency where it can collect in it (GHS, KES — step 3
  below); the other non-naira rail is dollar-denominated USDT.

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
  ladders built that morning came out again the same afternoon (`9aecd275`).

  **Remaining:**
  3. **Flutterwave USD collection — still the real unlock, and now measured.**
     Tested live on 12 Sep: GHS collects (mobile money shows) and KES is built
     the same way, but a USD charge returns **"Oops! No Payment method
     available. Please engage merchant for support."** — Flutterwave resolves
     no method for it. "Pay with international card", which the dashboard has
     switched on, means a card issued abroad may pay one of OUR charges; it is
     not permission to denominate the charge in dollars. That needs USD
     collection, a separate approval. Until Trip has it, USD and GBP are
     display-only (`canChargeIn()` in `lib/currency.js`) and a dollar reader is
     charged the naira their figure converts to, which their card converts back
     at the network rate. **When Flutterwave enables it: add the code to
     `COLLECTIBLE` and nothing else moves** — the quote, the stored
     `providerPriceCurrency`, the verification and the per-currency
     `payment_options` are all already written for it.
  4. **Done 12 Sep.** `SWITCHER_LIVE` is on in production and all five
     currencies are `active` in `lib/currency.js` (the four foreign ones lost
     their Soon tag). The picker also decides what Flutterwave charges in,
     where Flutterwave can collect in it: cedis and shillings, not dollars or
     pounds (see 3). In naira it falls back to the account's country
     (`COUNTRY_CURRENCY`), so a Ghanaian who never touched it still gets cedis
     and mobile money. The wallet stays naira either way.

     **Where the 15% premium is actually collected** (measured 12 Sep, and the
     reason the fallback order matters): only on a charge *we* denominate —
     GHS and KES card/mobile-money, and USDT, where we do the conversion. Every
     naira charge paid by a foreign card converts at the card network's rate,
     not ours, so it collects **0%** whatever currency the page is read in;
     that is structural, not a gap in the code, and USD collection (3) is the
     only thing that closes it. It does mean an uncollectible pick must fall
     back to the **country**, never straight to naira — otherwise the picker is
     a premium waiver: a Ghanaian selecting dollars would be charged naira and
     pay market. Pinned by "a Ghanaian cannot pick their way out of cedis".

  **Do not** build per-country wallets or a second price list — both ruled out
  in the International Nitro entry, and the premium lives in the deposit rate.

- **Checkout abandonment — a project, sized 13 Sep 2026, not started.** 60.0%
  of deposit initiations end in a funded wallet; after netting the 58% who
  complete within 7 days, true leakage is about 16.6% — roughly ₦20k/day of
  deposits and ₦13k/day of gross profit, on the order of ₦130k/month if worked.
  Unremarkable for a Nigerian payment flow: a UX opportunity, not an emergency.
  The ₦3.25M of "failed attempts" quoted on 11 Sep was never real — real
  payment failure is 0.9%; the rest was abandonment. Instrument before
  redesigning. Today the rows say *initiated* (Pending written) and *finished*
  (Completed), and Flutterwave's `provider_not_found` says the customer never
  submitted the form — but nothing records whether they reached Flutterwave's
  page at all. One `navigator.sendBeacon` from the add-funds page immediately
  before the redirect (reference + stage) splits "closed before the gateway
  loaded" from "saw the gateway and left", and the page's own steps (amount →
  method → pay) can ride the existing telemetry route. Read a fortnight of that
  before changing the flow.

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

- **Welcome bonus is raw balance, not spend-only credit** (noted 14 Sep 2026).
  `applyWelcomeBonusDetailed` increments `user.balance` and writes a `bonus`
  transaction; it does not create a `BonusCredit` row the way the top-up bonus
  and win-back credit do. Everything the customer is told — the assistant's
  knowledge file, the FAQ answers, the wallet copy — says the money is
  spend-only and cannot be withdrawn. Checked on 14 Sep and **nothing pays it
  out**: the only withdrawal surface is the Pit payouts page, whose
  `availableBalance` is `approvedTotal − totalPaid − pendingPayoutTotal` from
  affiliate earnings and never reads `user.balance`. So it is a promise the
  code keeps by accident rather than by construction. Restoring the ladder would
  double what sits in that position, which is one more reason to convert it
  first — the restore is built but held, see the first entry on this shelf. Worth converting to a
  real `BonusCredit` before any new cash-out path ships (cash referrals is the
  one on this list that would open one).

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
  with `f10e687a` for the hamburger). Currency and language switchers on all three navs
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
  in KES, USD and GBP. Turning the flag off used to put every foreign charge
  at the legacy cushioned rate, ~13% *above* market — the subsidy described
  below — so the off position of a premium switch was a giveaway; since the
  12 Sep leak audit, **off means market: no premium, no subsidy**
  (`lib/fx-deposit.js`, `source: 'market'`), and legacy is only the fallback
  when no market rate exists. Either way it is one switch in Admin, never a
  side effect of a deploy. The add-funds box speaks
  the picker's currency now that the switcher is live (12 Sep); Flutterwave's
  own page shows the cedi figure.

  **Still open:** the "Soon" tags on
  Pidgin/Yoruba/Hausa/Igbo/Kiswahili/Français are a public promise Trip has not
  yet confirmed.

  **Two items here were already done and the entry had not caught up** (checked
  14 Sep 2026). **Step 1, the phone gate, is open** — it shipped on 8 Sep as
  `2c1ac43a` and this entry, written on the 4th, was never updated. Signup
  accepts NG/US/GB/GH/KE end to end: `validatePhone(country, phone)` in the
  route, and a `PhoneField` with a country picker on both signup surfaces, the
  auth modal and the landing hero, each sending `country`. A French number is
  still refused, which is the supported-country list doing its job.
  **Language is no longer a shell** — four dictionaries carry 2,078 strings
  each, with `tests/i18n-drift-guard.test.js` holding the line. And the
  refund-to-bank line is gone from Terms (`cd9068ab`, 14 Sep); the Refund Policy
  had already lost it on 7 Sep, and for a week the two documents contradicted
  each other.

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

- **Tracking-link analytics, items 01–07 — approved, mockup exists, never
  built** (16 Sep 2026). Trip said "Go ahead" a long while back and the build
  never happened. What shipped in `v2.5.74` is only the two faults Trip pointed
  at on 16 Sep: "All" silently serving seven days, and the 145.3% conversion
  from mixing an all-time numerator with a windowed denominator. The other
  diagnosed faults — the ones the original mockup covers — are still open. Find
  the mockup and the 9-fault write-up from the earlier session before starting;
  do not re-diagnose from scratch.

- **19 of 31 platforms have no `/services/<slug>` page** (16 Sep 2026). Landing
  section 03 now claims 31 platforms and only 12 are crawlable, so the claim
  has no evidence behind it. `lib/platform-pages.js` is the one list and
  `tests/platform-page-parity` asserts both directions, so adding a slug there
  without writing its page is worse than leaving it out — a sitemap entry that
  404s is crawl budget spent on nothing. Scope this as its own piece.

- **The i18n detector cannot see array-literal labels** (16 Sep 2026). An
  Arabic reader saw "Orders", "Accounts" and "Delivery" in English on the hero
  stats while the drift guard stayed green, because `scanRepo` finds nothing at
  all in `components/landing-v3.jsx` — it knows JSX text nodes, quoted values on
  prose-ish keys and a few attributes, but not `[value, "Label"]` inside a map.
  Six strings were wrapped by hand in `v2.5.79`. Teaching the detector that
  shape is the durable fix; check the blast radius first, since widening it will
  surface hits across the app that then need either wrapping or a
  DELIBERATELY_ENGLISH entry.

- **The `[dir="ltr"]` specificity trap — worth writing down properly** (16 Sep
  2026). It has now caused three separate live bugs. The RTL build plugin
  rewrites asymmetric physical properties into `[dir="ltr"] .sel`, which is
  (0,2,0), and a media query adds no specificity of its own — so any
  `@media ... { .sel }` written to override it silently loses. It cost the
  locale pills a night, it left `max-desktop:text-center` on the hero column
  never applying at any width, and it compounded rather than cancelled the nav's
  `left-1/2` + `-translate-x-1/2` so the Arabic links drew straight through the
  currency pills. The fixes that work: logical properties (`padding-inline`,
  `text-start`) so no `[dir]` rule is generated, or a selector that out-specifies
  it. Worth a short section in CLAUDE.md rather than a shelf note, and worth a
  guardrail test if one can be written cheaply.

- **`ResellerProfile.catalog` is now unread** (16 Sep 2026, `v2.5.77`). The
  column still exists and nothing reads or writes it. Dropping it is a
  migration and a separate decision; it was left in place to keep the history
  of who was on which catalogue.

- **The full list has no guide of its own** (16 Sep 2026). The main tour
  deliberately forces the curated view, so it cannot teach the full list. If
  the full list is going to carry a landing section pointing at it, it probably
  wants a short separate guide — not started, not scoped.

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
