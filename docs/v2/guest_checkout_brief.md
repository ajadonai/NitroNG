# Guest checkout: engineering brief

Status: **approved by Trip, 16 Oct 2026**, with the decisions below. Step 1 of
the build order (the backend and the order page) is built, uncommitted, dark
behind `guest_checkout_enabled`, along with the entry button and the site-wide
refill change that came out of question 5. The composer card (step 2) is next.

## Decisions (16 Oct 2026)

1. **Guests pay by bank transfer, USSD or Opay. No cards at launch**; add them
   after a few weeks of watching disputes. Logged-in customers keep cards.
2. **Minimum order ₦1,000.**
3. **Guests get the same price as everyone, including site-wide promotions**,
   but no Nitro Status discount, points, coupons or bonuses.
4. **The price is held for 30 minutes.**
5. **Refills: both** a refill button on the order page and WhatsApp. And
   site-wide, every refill request now reaches admins on Telegram (built, see
   "Refills" below).
6. **`nitrongguest@gmail.com` is the guest account's inbox**, and it receiving
   Flutterwave's receipts is fine.

Design source: the mockup at claude.ai/artifact/1e3BcSmFM1LQN3FkbKsQA7 and the
decisions recorded on the Shelf entry "Guest checkout — redesigned 15–16 Oct 2026".

## What it is

A visitor orders one service without making an account: pick a service, paste a
link, pay with Flutterwave, done. They leave with two things: the normal
`NTR-` order ID, and an unguessable **guest code** (`G7K2-9XQM`) that opens a
public order page where they can track delivery and spend any credit. Email is
optional and is only used for the receipt and to attach the order if they sign
up later.

## The one design idea

**A guest payment is an ordinary deposit, and a guest order is an ordinary
order, on an account the guest never sees.** Nothing new handles money.

- Every email-less guest order lives on one shared account,
  `nitrongguest@gmail.com` ("the guest account"). It is `Active` so the wallet
  fence in `deductBalance` passes, but nobody can log in to it.
- The guest's payment is a normal Flutterwave `deposit` transaction on that
  account, finalized by the same `finalizeDeposit` every deposit uses, with
  every bonus switched off.
- The moment it is credited, the order is placed through the same
  `createOrderForSession` every order uses, which debits the same amount
  straight back out. The guest account's wallet is a pass-through and should
  always read ₦0.
- Refunds from failed or partial orders do **not** go to that wallet (it is
  shared). They go onto the guest code as credit.

This reuses the payment reconciler, the webhook, the verify path, the order
validation, pricing, drip, provider dispatch, the status sync and every admin
tool unchanged. It also keeps the financial reports honest without touching
them: guest money shows up as deposits and orders, exactly as it is.

### Why not a new account per guest

About 30 files read the users table: crons that email users, the leaderboard,
outreach, site stats, analytics, and the PROTECTED
`/api/cron/cohort-stats/acquisition`. One account per guest would need every one
of them taught to skip guests. One shared account needs a handful of
exclusions, listed below, and never touches the protected route. (The guest
account itself counts as one signup on the day it is created. That is the
whole effect.)

## Who owns a guest order

| The visitor | Order goes on | Refunds land | Later sign-up |
| --- | --- | --- | --- |
| Gives no email | the guest account | credit on the guest code | nothing to attach |
| Gives an email nobody has | the guest account, email stored on the checkout | credit on the guest code | orders move to the new account, unspent credit moves to its wallet |
| Gives an email that already has an account | **that account** (never logged in) | that account's wallet, as today | already theirs |

The third row is Trip's decision: an existing customer who orders while logged
out still sees the order in their dashboard.

## Data

Two new tables, no change to `User`, `Order` or `Transaction`.

```prisma
model GuestCheckout {
  id                String    @id @default(cuid())
  code              String    @unique    // G7K2-9XQM: opens the order page
  status            String    @default("Quoted")
  // Quoted → AwaitingPayment → Placed | Failed | Expired
  ownerUserId       String               // the guest account, or the existing account the email belongs to
  email             String?              // as typed; null when skipped
  tierId            String?
  serviceId         String
  link              String
  quantity          Int
  comments          String?   @db.Text
  priceKobo         Int                  // the held price; the order must charge exactly this
  creditAppliedKobo Int       @default(0)
  creditFromCode    String?              // the code whose credit paid part of it
  dueKobo           Int                  // priceKobo - creditAppliedKobo; what Flutterwave charges
  transactionId     String?   @unique    // the deposit
  orderId           String?   @unique    // Order.id once placed
  creditKobo        Int       @default(0) // refunds land here (guest-account orders only)
  failReason        String?
  expiresAt         DateTime             // price hold
  claimedByUserId   String?              // set when the email signs up
  ip                String?
  ua                String?   @db.Text
  fbp               String?
  fbc               String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([email])
  @@index([status, expiresAt])
}

model GuestCreditEvent {             // the money trail for credit on a code
  id          String   @id @default(cuid())
  checkoutId  String                 // whose code
  amountKobo  Int                    // + refund in, − spent or moved to a wallet
  reason      String                 // refund_partial | refund_cancelled | placement_failed | spent | claimed
  orderId     String?
  createdAt   DateTime @default(now())
  @@index([checkoutId])
}
```

The guest code is 8 characters of Crockford base32 (no 0/O/1/I/L), shown as
`XXXX-XXXX`: about a trillion combinations, which together with the lookup rate
limit below makes guessing one hopeless.

## The flow

### 1. Quote: `POST /api/guest/quote`

Body: `{ tierId | serviceId, link, quantity, comments?, currency }`.

Runs the same checks an order runs today, before any money moves (this is the
"link checked before payment" decision): `parseCreateOrderInput`,
`calculateCreateOrderPricing`, `validateCreateOrderOfferInput`, the auto-service
target check, and the provider-listing fence. Prices at **retail**: no Nitro
Status discount, no points, no coupons, no bonuses. Refuses anything under the
minimum order value.

Writes a `GuestCheckout` in `Quoted` with `expiresAt` 30 minutes out and returns
`{ checkoutId, priceKobo, display: { amount, currency }, expiresAt }`.

Not in the guest composer at all, by design: option groups (poll votes),
multi-day drip, crypto. Large orders still drip intraday automatically, exactly
as the order route already does.

### 2. Pay: `POST /api/guest/pay`

Body: `{ checkoutId, email?, creditCode? }`.

- Resolves the owner (table above). A malformed email is refused; no email is
  fine.
- If `creditCode` is given, **reserves** its credit: moves up to `priceKobo` out
  of that code's `creditKobo` into this checkout's `creditAppliedKobo`, with a
  `GuestCreditEvent` (`spent`). Released by the expiry sweep if the payment never
  completes.
- If the credit covers everything, skips Flutterwave and goes straight to step
  3 ("Place order" in the mockup).
- Otherwise creates the pending deposit on the owner, for `dueKobo`, and opens
  Flutterwave with:
  - `customer.email`: the guest's email, or `nitrongguest+CODE@gmail.com`
    (plus-addressed per payment, so Flutterwave never sees thousands of
    payments from one email)
  - `currency`: the currency the visitor has the site in when Flutterwave can
    collect it (NGN, GHS, KES), otherwise naira, with the same deposit-rate
    logic `/api/payments/initialize` uses today. A guest has no signup country,
    so the site's currency decides.
  - `redirect_url`: `/?guest_order=CODE&verify=REF`, the order card on the home page, which turns into the receipt
- Status → `AwaitingPayment`.

### 3. Place: `placeGuestOrder(checkoutId)`

Called when the deposit is finalized, from one place: the end of
`finalizeDeposit`, after it commits, whenever the deposit belongs to a guest
checkout. That covers the webhook, the verify redirect, the reconcile cron and
an admin approving a Review row, without touching any of them. A small sweep in
the existing payments cron re-runs it for any checkout that is paid but not
`Placed`, so a crash between the two steps heals itself.

Idempotent: a conditional update claims the checkout (`AwaitingPayment →
Placing`) before anything else, so two callers can never place two orders.

Inside `finalizeDeposit`, a guest deposit skips the coupon, welcome bonus,
referral and top-up bonus. "No bonus for guest checkouts" is enforced there,
not in the UI.

Then `createOrderForSession(owner, …, { source: 'guest', guest })`, where the
`guest` option:

- skips Nitro Status, points and the duplicate-link 409 prompt;
- refuses if the charge it computes differs from `priceKobo` (a price change
  inside the 30-minute hold is honoured by refunding to credit, never by
  overcharging);
- sends the Meta Purchase event with the guest's own email when given, and no
  email otherwise, never `nitrongguest@gmail.com`; fbp/fbc come from the
  checkout row;
- sends the receipt email when there is an email: the guest code, the order
  page link, the NTR number and what was paid.

If placement fails for any reason (the service was switched off, the provider
rejected it), the paid amount moves from the owner's wallet onto the code as
credit (`placement_failed`), status `Failed`, and the order page says so. For
an existing account the money simply stays in their wallet.

### 4. Refunds: one helper (built 16 Oct 2026)

Order refunds credit a wallet in about 19 places. Twelve of them run without
the customer's own session, so they can meet a guest order, and all twelve now
go through `creditOrderRefund(tx, orderId, { data })` (`lib/order-refund-credit.js`):

- `app/api/cron/orders/route.js`: five (cancelled, partial, dispatch failed,
  recovered, and the stuck-order sweep)
- `app/api/admin/orders/route.js`: four admin refund paths
- `app/api/admin/sync/route.js`: one
- `lib/drip-completion.js`: a drip that ends Partial
- `app/api/orders/route.js`: `refundRejectedCreatedOrder`, a provider rejecting
  the order at placement

The helper takes each site's refund row exactly as it was written. If the order
is on the guest account, the amount goes onto the code's `creditKobo` with a
`GuestCreditEvent` and the row's method becomes `guest_credit`; otherwise the
wallet is credited exactly as before. The row is written either way, so
`getTotalRefundedKobo` still blocks a double refund.

The other seven (customer cancel, bulk cancel, the status-check button) act on
the signed-in customer's own orders. Nobody can sign in to the guest account,
so they never reach a guest order and are unchanged. A test fails if any of the
twelve sessionless sites credits a wallet directly again.

### 5. The order page: `/order/[code]`

Public, server-rendered, `noindex` by meta tag. (Do **not** add it to
`robots.txt`: that file is PROTECTED.) Shows the order as the mockup does:
delivering with progress, partly delivered with the credit and "Use credit",
completed, failed. "Help on WhatsApp" carries the code in the prefilled
message. `?verify=REF` polls the existing verify path once, so a visitor
arriving back from Flutterwave sees "Order placed" the moment it is.

`GET /api/guest/track?code=` feeds the "Already ordered? Track" pop-up with the
same facts.

A completed order the tier promises a refill on (see "Refills") shows a refill
button, which uses the same route as the dashboard; WhatsApp stays alongside it.

### 6. Signing up later

Decided 16 Oct 2026: by the guest code, plus automatically on Google sign-up.
Never by email alone, because email sign-up does not verify the address, so
anyone who knew a guest's email could otherwise take their orders and credit.

- **Google sign-up** (`app/api/auth/google/callback`): Google has verified the
  email, so every settled guest checkout bought with it moves in when the
  account is created.
- **The guest code**, which only the buyer holds: "Move to my account" on the
  order page when signed in, and "Add a guest code" under the dashboard's
  orders (`POST /api/guest/claim`).

Moving a checkout (`claimCheckout` in `lib/guest-checkout.js`): its order's
`userId`, and any credit left on its code into the wallet as one `guest_credit`
row (`GCC-<code>`), with `claimedByUserId` and `ownerUserId` set to the
account. Stamped first and conditionally, so it can never be claimed twice.
Only settled checkouts move (placed, or failed with credit); one still being
paid for stays on the guest account, where its payment is about to land.

### 7. Keeping the guest account out of things

- **Login:** the password login route, Google sign-in and password reset all
  refuse the guest account outright.
- **Leaderboard** (public and admin) and the admin top-spender lists exclude
  it, or it tops them with everyone's guest spend.
- **Nitro Status and points:** skipped at order time (step 3).
- **Emails and outreach:** the account is created with every notification
  preference off and `outreachOptedOutAt` set. Part of the build is checking
  each user-emailing cron actually honours those, and adding the exclusion
  where one doesn't.
- **Meta/TikTok:** never sent the shared email (step 3).
- **Site stats:** the account adds one to "accounts created", once. Guest
  orders do count as orders, because they are.

## Admin

- A "Guest" chip on guest orders in the orders list, and the code, email and
  credit on the order detail.
- A guest checkouts view: code, status, email, credit, order. Read-only in v1;
  admins already refund and retry through the order itself.
- A Telegram line on each guest order, so they are visible from day one.
- An alert if the guest account's wallet is ever not ₦0, because that means a
  pass-through broke.

## Rate limits

| Route | Limit |
| --- | --- |
| quote | 20 a minute per IP |
| pay | 5 per 10 minutes per IP |
| track and the order page | 60 per 10 minutes per IP, one budget shared by both |

The unknown-code lock first proposed here was dropped while building it.
Nigerian mobile networks put many customers behind one IP address, so a lock
after ten wrong codes would shut everyone on that address out of their own
order page, and the order page checks on a payment every 10 seconds for five
minutes. The code space (eight characters from 29, about 500 billion codes) is
the real guard; the limit only makes walking it slower.

Expired quotes are swept every run of the existing payments cron, and their
reserved credit is released.

## Build order

1. **Backend, dark.** Migration, quote/pay/place, the refund helper across
   all seven sites, the order page and the track endpoint, the guest account
   and its exclusions. Everything behind `guest_checkout_enabled`.
2. **Front end.** The composer card from the mockup in the hero spot (desktop
   and phone), the in-card receipt, the track pop-up, the order page UI. Wire
   `startGuestOrder` in `landing-v3.jsx`, which today does nothing.
3. **Claim and admin.** Sign-up claim, the Guest chip and the checkouts view,
   the receipt email.
4. **Test on production with the flag on for staff only** (one real ₦1,000
   order each way: no email, new email, existing account, credit spend), then
   flip it for everyone. The flip is the milestone.

## Tests

- Guest deposits skip every bonus in `finalizeDeposit`.
- `placeGuestOrder` places exactly one order however many times it is called,
  and refuses a price that drifted from the hold.
- `creditOrderRefund` routes guest-account orders to code credit and leaves
  every other order on today's path; a guard test that no order-refund site
  increments `balance` directly any more.
- Credit reservation: two checkouts spending the same code can never take more
  than it holds; an expired checkout gives its reservation back.
- Claim on signup moves orders and credit exactly once.
- The guest account cannot log in by password, Google or reset.
- Code generator: alphabet, length, format; lookups are rate-limited.

## Risks

- **Card fraud and chargebacks.** Anonymous one-off card payments are how
  stolen cards get tested, and chargebacks put the Flutterwave relationship at
  risk. This was the main reason the September version kept the account. See
  the first open question.
- **Claiming without verification.** Whoever signs up first with an email gets
  that email's guest orders and credit. Trip has accepted this for an SMM
  panel; it is recorded here so nobody is surprised.
- **An existing account's email typed by someone else.** The order attaches to
  the real owner, and so would any refund. The payer loses out, not the owner.
- **Flutterwave receipts.** Every email-less payment sends Flutterwave's own
  receipt to `nitrongguest+CODE@gmail.com`, which is Trip's inbox. A Gmail
  filter on the guest address handles it. Plus-addressing should be checked in
  Flutterwave's test mode before the build relies on it.
- **One account, many orders.** The guest account will hold thousands of
  orders. Any admin view that loads a user's whole order history needs to
  paginate for it.

## Refills (built 16 Oct 2026, site-wide)

Who may ask follows the tier name the customer bought, the Nitro promise:
Budget never, Standard within 30 days of completion, Premium any time
(`lib/refill-promise.js`). The refill route and the orders list both read it;
until now both read the provider's refill flag, so 957 Premium and 1,391
Standard completed orders had no refill button and 836 Budget ones did.

Every request pings the Telegram Orders topic. Where the provider offers a
refill on that service it is also sent to them straight away, and the message
says so; otherwise, or when the provider refuses, the message says "Needs a
manual refill". The admin Refills queue and "Reset refill" are unchanged.

Guest orders use the same route through their code.

## Open questions (answered 16 Oct, see Decisions)

1. **Cards for guests?** Recommendation: launch guests on bank transfer, USSD
   and Opay only, and add cards after a few weeks of watching disputes.
   (Logged-in customers keep cards as today.) The composer's payment line
   changes to match.
2. **Minimum order:** ₦1,000 was assumed and never confirmed.
3. **Site-wide promotions:** recommendation is that guests get the sale price
   like everyone else, while still getting no loyalty, points or bonuses.
4. **Price hold:** 30 minutes recommended.
5. **Refills:** WhatsApp only in v1 (recommended), or a refill button on the
   order page from the start?
6. **The guest account:** confirm `nitrongguest@gmail.com` is the inbox to use,
   and that it is fine for it to receive Flutterwave's receipts.
