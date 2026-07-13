# Nitro Status + Nitro Points Build Tracker

Last updated: 12 July 2026

This document is the handoff source for the Nitro Status + Nitro Points build. It replaces the unused legacy loyalty concept with a new rewards system that is visible to users, configurable by admins, and traceable in finance.

There are two connected products:

- **Nitro Status** — the customer's rank, based on eligible lifetime spend.
- **Nitro Points** — redeemable reward value earned from eligible spend.

Use this file as the product spec, UI brief, backend implementation plan, and review checklist.

---

## 0. Claude handoff summary

### Preferred team split

- **Claude Code builds.**
- **Codex reviews architecture, money rules, edge cases, and final diffs.**

The backend touches money, discounts, refunds, ledger balances, and finance liability. Do not build it in one giant pass.

### Current UI direction

The user dashboard already uses compact cards and modals:

- top stat cards: `Active`, `Delivered`, `This Week`;
- next-action card;
- feature cards that open modals: `How it works`, `What to Expect`, `Support`;
- recent orders card;
- desktop right sidebar with `Your Stats`.

So Nitro Status + Points should fit that pattern:

- show compact cards on the Home dashboard;
- use popout modals for details;
- add a compact wallet card because points are redeemable value;
- do not create a heavy full page first.

### Current UI file targets

Likely files:

- `components/dashboard.jsx`
  - `OverviewPage` for Home dashboard cards and modals.
  - `RightSidebar` later if we want compact desktop stats.
- `components/addfunds-page.jsx`
  - Wallet/Add Funds compact Nitro Points card.
- `components/new-order.jsx`
  - Later checkout summary: status discount, points redemption, points earned.
- `components/orders-page.jsx`
  - Later order detail/history reward breakdown.

### Current backend file targets

Likely files:

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `lib/nitro-rewards.js` or `lib/nitro-status.js`
- `app/api/dashboard/route.js`
- `app/api/orders/route.js`
- `app/api/orders/bulk/route.js`
- refund/cancel routes used by admin order refund flows
- `app/api/admin/settings/route.js`
- admin finance/users routes once reporting is added

### Strict build rule

If building UI only:

- use mock/fallback rewards data;
- do not create DB writes;
- do not change order pricing logic;
- do not implement real point redemption;
- do not remove old loyalty backend yet.

If building backend:

- follow phases in this file;
- add tests at each phase;
- keep ledger as source of truth;
- never stack old loyalty discount with Nitro Status discount.

---

## 0A. Current UI branch snapshot

Reviewed branch/commit:

- Branch: `origin/rewards-ui`
- Commit: `c7e9af8c307d6de653b7dbf74387285a6ab116f9`
- Commit title: `Rewards UI: Nitro Status, Nitro Points and channel lane on Home`

Files changed by the UI branch:

- `components/dashboard.jsx`
- `components/addfunds-page.jsx`
- `components/rewards.jsx`

What the UI currently adds:

- Home dashboard rewards strip at the top of `OverviewPage`.
- Two live-looking cells:
  - `Nitro Status`
  - `Nitro Points`
- `StatusModal` for the tier ladder/progress details.
- `PointsModal` for points balance, minimum redemption, and recent points activity.
- `WalletPointsCard` on the Wallet/Add Funds page.
- `ChannelLane` on the Home dashboard for WhatsApp channel and optional Telegram community.
- A gated third rewards strip cell for future `Tasks` via `TASKS_ENABLED = false`.

Important: the UI is still mock-driven.

Current UI comments explicitly say:

```js
// MOCK — swap for /api/rewards
```

in:

- `components/dashboard.jsx`
- `components/addfunds-page.jsx`
- `components/rewards.jsx`

Do not treat this UI as a backend implementation. It displays mock rewards until the backend replaces `getRewards()` with a real payload.

### Current UI data shape from `components/rewards.jsx`

The UI currently expects:

```js
const rewards = {
  status: {
    key: "boost",
    name: "Boost",
    eligibleSpend: 750000,
    currentMin: 500000,
    nextName: "Surge",
    nextMin: 2000000,
    remainingToNext: 1250000,
    progressPct: 16.7,
    discountPct: 1,
    pointEarnPct: 1.25
  },
  points: {
    balance: 8450,
    valueNaira: 8450,
    minRedeem: 5000,
    redeemable: true,
    neededToRedeem: 0
  },
  tasks: {
    available: 2,
    topReward: 500
  },
  history: [
    { kind: "earned", label: "Earned", ref: "#NTR-2475", refType: "order", pts: 125 },
    { kind: "spent", label: "Spent", ref: "#NTR-2480", refType: "order", pts: -5000 },
    { kind: "reversed", label: "Reversed", ref: "#NTR-2440", refType: "refund", pts: -50 }
  ]
};
```

The canonical tier ladder lives in `STATUS_TIERS` inside `lib/nitro-rewards.js`. The user-facing detail modal and admin read-only reference table mirror those values for display.

When backend ships, either:

- return this exact shape from `/api/rewards` or the dashboard payload; or
- add a tiny adapter in the UI to convert the backend shape into this display shape.

### Current UI constants that must be replaced during backend/admin merge

`components/rewards.jsx` currently contains:

```js
export const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q";
```

This should not stay hardcoded because the admin settings work now includes:

- setting key: `social_whatsapp_channel`
- admin-editable from Settings
- exposed through public/settings/menu data for user-facing UI

When merging rewards UI with the admin WhatsApp setting work, replace `WHATSAPP_CHANNEL_URL` with the configured value, probably passed through `socialLinks` or `menuData`.

### UI review notes before backend work

- The UI wording is aligned with product decisions:
  - `Nitro Status`
  - `Nitro Points`
  - `1 pt = ₦1`
  - minimum redemption `5,000`
- The UI currently uses absolute progress toward the next tier minimum:

```js
progressPct = eligibleSpend / nextMin * 100
```

This is acceptable for now, but backend should decide whether final product wants absolute progress or tier-span progress:

```js
progressPct = (eligibleSpend - currentMin) / (nextMin - currentMin) * 100
```

- `Use on next order` currently only navigates to Services/New Order. That is correct for UI-only work. It must not redeem points until backend redemption exists.
- The Home UI includes a future Tasks slot, but tasks are disabled. Do not build tasks as part of the first backend rewards pass.

---

## 1. Locked product decisions

- Nitro Status is based on eligible lifetime spend.
- Nitro Points are earned from spending.
- The points earn rate depends on the user's Nitro Status at the time of purchase.
- `1 Nitro Point = ₦1` redeemable value.
- Minimum redemption is `5,000 points = ₦5,000`.
- Nitro Status gives users service discounts.
- Nitro Points can be redeemed by users.
- Refunds deduct the points originally earned from the refunded order.
- Partial refunds deduct points proportionally.
- If an order used points and is refunded, restore the used points proportionally.
- Redeeming points does not reduce Nitro Status.
- Historical spend should count for Nitro Status.
- The old loyalty system was never operational, so there is no transition/migration obligation for existing loyalty balances.
- Existing users receiving starting Nitro Points from past spend is still an open product decision.

---

## 2. Nitro Status tiers

Approved tier names and spend bands:

| Status | Eligible lifetime spend |
|---|---:|
| Spark | ₦0 – ₦99,999 |
| Pulse | ₦100,000 – ₦499,999 |
| Boost | ₦500,000 – ₦1,999,999 |
| Surge | ₦2,000,000 – ₦7,499,999 |
| Apex | ₦7,500,000 – ₦14,999,999 |
| Legend | ₦15,000,000+ |

Approved/working benefits:

| Status | Service discount | Point earn rate | Example on ₦10,000 eligible spend |
|---|---:|---:|---:|
| Spark | 0% | 0.5% | 50 points = ₦50 |
| Pulse | 0.5% | 1% | 100 points = ₦100 |
| Boost | 1% | 1.25% | 125 points = ₦125 |
| Surge | 2% | 1.5% | 150 points = ₦150 |
| Apex | 3% | 1.75% | 175 points = ₦175 |
| Legend | 4% | 2% | 200 points = ₦200 |

Recommended display copy:

- `Boost`
- `1% off services`
- `1.25% points back`
- `₦1,250,000 to Surge`

Avoid the term `account status` in the UI. Use `Nitro Status`.

---

## 3. Eligible spend definition

Eligible spend is the real order value that should count toward status and points.

Eligible spend includes:

- completed/non-cancelled order spend;
- wallet/cash amount actually paid by the user;
- successful order value after discounts.

Eligible spend excludes:

- refunded value;
- cancelled value;
- points-funded value;
- bonus/free credit where identifiable;
- admin test/comp orders if marked as such.

Important anti-double-dip rule:

> If a user places a ₦10,000 order and redeems ₦5,000 Nitro Points on it, only ₦5,000 should count toward new points and status progress.

---

## 4. Points accounting rules

### Value

- `1 point = ₦1`.
- `5,000 points = ₦5,000`.

### Internal precision

Avoid floating point math.

Recommended implementation:

- store rewards internally as integer kobo-equivalent, e.g. `pointsKobo` or `rewardValueKobo`;
- `100 pointsKobo = 1 point = ₦1`;
- minimum redemption is `500,000 pointsKobo`;
- display as `pointsKobo / 100`.

Award calculation should be deterministic:

```text
pointsKoboEarned = floor(eligibleSpendKobo * pointEarnRatePercent / 100)
```

If product wants only whole visible points, round display down to whole points while keeping ledger exact.

### Earning

Points are earned on eligible order spend.

The earn rate must be snapshotted from the user's Nitro Status at purchase time.

Example:

- User is Pulse.
- Pulse earns 1%.
- User spends eligible ₦10,000.
- User earns 100 points.
- Points value is ₦100.

### Redemption

- Minimum redemption: 5,000 points.
- User can redeem points only when balance is at least 5,000 points.
- Redemption should be auditable in finance.

Preferred launch implementation:

- redeem points directly at checkout as a points discount;
- do not convert points into normal wallet balance.

Avoid treating redeemed points as ordinary wallet credit unless the order engine can clearly exclude points-funded spend from future points/status calculation.

### Refunds

When an order is refunded:

- deduct the points originally earned by that order;
- if the order used points, restore the redeemed points proportionally;
- refund only the actual cash/wallet amount paid.

Full refund example:

- Order: ₦10,000.
- Points redeemed on order: 5,000 points.
- Eligible paid amount: ₦5,000.
- Points earned: 50.
- Full refund should:
  - deduct 50 earned points;
  - restore 5,000 redeemed points;
  - refund ₦5,000 paid amount.

If points were already redeemed elsewhere and the reversal pushes the user below zero, allow temporary negative points. Future earned points should first repay the negative balance naturally.

---

## 5. Required data model

The core requirement is a points ledger. Do not rely only on a cached balance.

### Suggested table: `NitroPointLedger`

Fields to consider:

- `id`
- `userId`
- `type`
- `pointsKobo` or `rewardValueKobo`
- `orderId`
- `transactionId`
- `redemptionId`
- `refundId`
- `statusAtEvent`
- `pointRateAtEvent`
- `eligibleSpendKobo`
- `metadata`
- `createdByAdminId`
- `reason`
- `createdAt`

Suggested ledger types:

| Type | Meaning |
|---|---|
| `earned_order` | Points earned from an order |
| `redeemed_order` | Points spent/redeemed by user |
| `reversed_refund` | Points removed because an order was refunded |
| `restored_refund` | Points restored because a refunded order had used points |
| `manual_credit` | Admin added points |
| `manual_debit` | Admin removed points |
| `opening_balance` | Optional launch/backfill grant |

The user's points balance should equal:

```text
SUM(nitro_point_ledger.pointsKobo)
```

Cached balances may be added for performance, but the ledger remains the source of truth.

### Recommended uniqueness / idempotency

Add protection against duplicate financial events:

- one `earned_order` ledger row per order;
- one `redeemed_order` ledger row per redemption/order;
- one refund reversal/restoration per refund event;
- manual entries always require a reason and admin identity.

Use unique constraints or guarded transaction checks where appropriate.

---

## 6. Purchase-time snapshots

Every order that participates in Nitro Status/Points should snapshot:

- Nitro Status at purchase;
- point earn rate at purchase;
- status discount at purchase;
- eligible spend;
- points earned;
- points redeemed;
- points-funded amount;
- cash/wallet-funded amount.

This prevents old orders from changing when tier settings change later.

Suggested order snapshot fields:

- `nitroStatusAtPurchase`
- `nitroStatusDiscountPct`
- `nitroStatusDiscountKobo`
- `nitroPointEarnRatePct`
- `nitroEligibleSpendKobo`
- `nitroPointsEarnedKobo`
- `nitroPointsRedeemedKobo`
- `nitroPointsFundedKobo`
- `cashFundedKobo`

If adding many order columns feels heavy, use a JSON metadata field only if it is queryable enough for finance/admin needs.

---

## 7. Finance tracking

Finance needs to see rewards as a liability.

Since `1 point = ₦1`, outstanding points are equal to outstanding rewards liability.

### Rewards overview metrics

Track:

- total outstanding points;
- total outstanding liability in ₦;
- points issued this month;
- points redeemed this month;
- points reversed from refunds;
- points restored from refunded redemptions;
- manual credits/debits;
- net rewards liability movement.

Example:

```text
Outstanding Nitro Points: 4,250,000
Rewards Liability: ₦4,250,000
Redeemed this month: ₦380,000
Reversed this month: ₦42,000
```

### Finance reconciliation

Finance should be able to reconcile:

- ledger balance per user;
- total platform points liability;
- redemptions against order discounts or rewards-credit transactions;
- refund reversals against refunded orders.

---

## 8. User-side UI plan

### Home dashboard placement

Add a rewards section on Home under the top stat cards and before the next-action card.

Current Home already has:

- top stat cards;
- next-action card;
- feature card buttons that open modals;
- recent orders;
- mobile/tablet active orders;
- desktop right sidebar.

The rewards section should be two cards:

- Nitro Status card;
- Nitro Points card.

Desktop/tablet:

- two cards side-by-side.

Mobile:

- stacked cards.

### Nitro Status card

Example:

```text
Nitro Status
Boost

₦750,000 lifetime spend
₦1,250,000 to Surge

[progress bar]

View status details
```

Card behavior:

- `View status details` opens a modal.
- Card can also be clickable if it is clear and accessible.

### Nitro Points card

Redeemable example:

```text
Nitro Points
8,450 pts

≈ ₦8,450
Redeemable now

View points
```

Below-minimum example:

```text
Nitro Points
3,200 pts

≈ ₦3,200
1,800 more to redeem

View points
```

Card behavior:

- `View points` opens a modal.

### Status details modal

Use the same modal style as existing `How it works` and `What to Expect` popups in `OverviewPage`.

Title:

```text
Nitro Status
```

Hero copy:

```text
Boost
You’re getting 1% off services and earning 1.25% back in Nitro Points.
```

Progress:

```text
Progress to Surge
₦750,000 / ₦2,000,000
₦1,250,000 remaining
```

Tier ladder:

```text
Spark    ₦0+          0% off      0.5% points
Pulse    ₦100k+       0.5% off    1% points
Boost    ₦500k+       1% off      1.25% points   Current
Surge    ₦2m+         2% off      1.5% points
Apex     ₦7.5m+       3% off      1.75% points
Legend   ₦15m+        4% off      2% points
```

### Points details modal

Use the same modal style as existing Home modals.

Title:

```text
Nitro Points
```

Hero:

```text
8,450 pts
≈ ₦8,450
```

Redeemable copy:

```text
You can redeem your points on orders.
Minimum redemption: 5,000 points.
```

Button:

```text
Use on next order
```

For UI-only phase, this button should navigate to New Order. Backend redemption comes later.

Below-minimum copy:

```text
Minimum redemption is 5,000 points.
Earn 1,800 more points to redeem.
```

Activity preview:

```text
Recent activity

+125 pts    Earned from order #NTR-2475
-5,000 pts  Redeemed on order #NTR-2480
-50 pts     Reversed from refund #NTR-2440
```

Empty state:

```text
Your points activity will appear here after your next order.
```

### Wallet page compact card

Add a compact card near the balance/summary area of Wallet/Add Funds.

Example:

```text
Nitro Points
8,450 pts ≈ ₦8,450
Minimum redemption: ₦5,000

View points
```

The button opens the same Points modal or a reused Points modal component.

### Future checkout UI

Do this only when backend supports it.

In New Order summary:

```text
Subtotal: ₦10,000
Boost discount (1%): -₦100
Nitro Points used: -₦5,000
Total: ₦4,900

You’ll earn 61 Nitro Points from this order.
```

If the user cannot redeem:

```text
Nitro Points
3,200 available
Minimum redemption is 5,000 points.
```

### Future order history/detail UI

Inside order details:

```text
Nitro Status at purchase: Boost
Status discount: ₦100
Points used: 5,000
Points earned: 61
Eligible spend: ₦4,900
```

This must use purchase-time snapshots, not current status.

### UI wording rules

- Use `Nitro Status`, not `account status`.
- Use `Nitro Points`, not `loyalty points`.
- Use `Nitro Status discount`, not `loyalty discount`.
- Do not show old loyalty and new Nitro Status as separate stacked benefits.
- Keep the tone calm and simple.
- Avoid making rewards feel like gambling.
- Make next tier progress clear and reachable.

### UI styling direction

Fit existing dashboard style:

- rounded card style already used in Home;
- translucent day/night card backgrounds;
- `t.cardBorder`;
- muted labels;
- `t.accent` for subtle actions;
- green only for positive redeemable value / reward value;
- no loud warning colors unless redemption is unavailable or blocked.

---

## 9. UI mock data contract

For UI-only work, use mock/fallback data shaped like this.

This matches the current `components/rewards.jsx` contract from `origin/rewards-ui@c7e9af8`:

```js
const rewards = {
  status: {
    key: "boost",
    name: "Boost",
    eligibleSpend: 750000,
    currentMin: 500000,
    nextName: "Surge",
    nextMin: 2000000,
    remainingToNext: 1250000,
    progressPct: 16.7,
    discountPct: 1,
    pointEarnPct: 1.25
  },
  points: {
    balance: 8450,
    valueNaira: 8450,
    minRedeem: 5000,
    redeemable: true,
    neededToRedeem: 0
  },
  tasks: {
    available: 2,
    topReward: 500
  },
  history: [
    { kind: "earned", label: "Earned", ref: "#NTR-2475", refType: "order", pts: 125 },
    { kind: "spent", label: "Spent", ref: "#NTR-2480", refType: "order", pts: -5000 },
    { kind: "reversed", label: "Reversed", ref: "#NTR-2440", refType: "refund", pts: -50 }
  ]
};
```

The user-facing UI keeps a display copy of the tier ladder in `STATUS_TIERS`, exported from `components/rewards.jsx`; the backend source of truth is `lib/nitro-rewards.js`.

When backend is ready, this can become:

```js
user.rewards
```

or a dashboard payload field:

```js
{
  user,
  orders,
  transactions,
  rewards
}
```

---

## 10. Admin side plan

### Admin settings

Add/manage:

- Nitro Points enabled: true/false;
- Nitro Status discounts enabled: true/false;
- minimum redemption: default 5,000;
- status tiers:
  - name;
  - min eligible lifetime spend;
  - service discount rate;
  - point earn rate;
  - perks/copy.

Settings validation must reject:

- negative thresholds;
- overlapping or unsorted tiers;
- invalid rates;
- minimum redemption below 0;
- duplicate tier keys/names.

### Admin user drawer

Show:

- current Nitro Status;
- eligible lifetime spend;
- next status progress;
- points balance;
- points value;
- points ledger/history;
- redemptions;
- refund reversals;
- manual adjustment controls.

Manual adjustments should require:

- permission;
- reason;
- admin activity log;
- ledger entry.

### Admin finance/rewards page

Show:

- rewards liability overview;
- issued/redeemed/reversed metrics;
- searchable points ledger;
- filter by user, type, date, order, redemption;
- export option later.

---

## 11. Retiring old loyalty system

The old loyalty system was not operational and has no user balance transition requirement.

Replace old loyalty logic with Nitro Status + Nitro Points:

- old `loyalty_tiers` admin UI becomes Nitro Status settings;
- old loyalty discount in checkout becomes Nitro Status discount;
- old loyalty display becomes Nitro Status + Nitro Points;
- old order `loyaltyDiscount` field can remain historically, but new user-facing copy should say Nitro Status discount.

Critical rule:

> Do not stack old loyalty discount and new Nitro Status discount.

Search terms to audit during implementation:

- `loyalty`
- `loyaltyDiscount`
- `loyalty_tiers`
- `loyalty_enabled`
- `discount`

---

## 12. Backend implementation phases

### Phase 1 — Foundation ✓

- `[x]` Define Nitro Status/Points config defaults.
- `[x]` Add points ledger model and migration.
- `[x]` Add helper to compute eligible lifetime spend.
- `[x]` Add helper to compute Nitro Status from eligible lifetime spend.
- `[x]` Add helper to compute points balance from ledger.
- `[x]` Add helper to build rewards dashboard payload.
- `[x]` Add admin settings validation for tiers/rates/min redemption.
- `[x]` Add tests for tier calculation, progress calculation, and points math.

Phase 1 should be read-only for users except the new ledger table/settings. No checkout changes yet.

### Phase 2 — Status discount and points earning ✓

- `[x]` Replace old loyalty discount pricing path with Nitro Status discount.
- `[x]` Snapshot status/rate/discount on order.
- `[x]` Award points on successful order creation.
- `[x]` Prevent duplicate point awards per order.
- `[x]` Exclude points-funded value from eligible spend.
- `[x]` Add tests for earning by status.

Do not start redemption in this phase.

### Phase 3 — User redemption ✓

- `[x]` Add redeem/apply-points endpoint or checkout parameter.
- `[x]` Enforce minimum 5,000 points.
- `[x]` Debit ledger transactionally.
- `[x]` Apply redemption as checkout discount or rewards credit, not normal wallet balance.
- `[x]` Add user points history.
- `[x]` Add tests for redemption, insufficient points, duplicate redemption, and concurrent redemption.

### Phase 4 — Refund handling ✓

- `[x]` Reverse points originally earned on refunded orders.
- `[x]` Restore points used on refunded orders.
- `[x]` Handle partial refunds proportionally.
- `[x]` Allow negative points after reversal.
- `[x]` Ensure future earnings repay negative balance naturally.
- `[x]` Add tests for full and partial refund scenarios.

### Phase 5 — Admin and finance visibility ✓

- `[x]` Add rewards overview/liability reporting.
- `[x]` Add admin user drawer rewards section.
- `[x]` Add points ledger filters.
- `[x]` Add manual adjustment with reason and activity log.
- `[x]` Add finance reconciliation tests.

### Phase 6 — Cleanup and launch (in progress)

- `[x]` Verify migrations present and ordered.
- `[x]` Verify Prisma schema/client generation.
- `[x]` Run focused rewards tests (103 pass).
- `[x]` Run full test suite (403 pass).
- `[ ]` Remove old loyalty UI wording.
- `[ ]` Confirm old loyalty discount cannot stack.
- `[ ]` Decide whether to grant opening balances for historical spend.
- `[ ]` Backfill status snapshot only if needed.
- `[ ]` Deploy and monitor finance/rewards metrics.

---

## 13. Backend invariants / review checklist

These are the rules Codex should review every Claude backend commit against.

### Money safety

- `[ ]` Ledger is source of truth for points.
- `[ ]` No direct balance mutation without ledger entry.
- `[ ]` No floating point math for money/points.
- `[ ]` No duplicate point awards per order.
- `[ ]` No duplicate redemption debits.
- `[ ]` No points awarded on cancelled order value.
- `[ ]` No points awarded on refunded value.
- `[ ]` No points awarded on points-funded value.
- `[ ]` No old loyalty discount stacked with Nitro Status discount.
- `[ ]` Points redemption is not treated as normal wallet credit.

### Race/concurrency safety

- `[ ]` Redemption checks and ledger debit happen in one transaction.
- `[ ]` Order creation, status snapshot, points redemption, and wallet charge are transactionally consistent.
- `[ ]` Refund reversal/restoration is idempotent.
- `[ ]` Concurrent redemptions cannot overspend points.

### Snapshot safety

- `[ ]` Order stores status/rate/discount at purchase time.
- `[ ]` Order history uses snapshot values, not current tier.
- `[ ]` Refund math uses original order snapshot.

### Finance safety

- `[ ]` Outstanding liability equals ledger sum.
- `[ ]` Admin manual adjustments require reason and admin identity.
- `[ ]` Finance can filter ledger by user/type/date/order.

---

## 14. Test checklist

### Unit tests

- `[ ]` tier selection at boundaries;
- `[ ]` next tier progress;
- `[ ]` point earning by tier;
- `[ ]` eligible spend excludes points-funded amount;
- `[ ]` minimum redemption;
- `[ ]` refund reversal math;
- `[ ]` partial refund proportional math;
- `[ ]` negative balance after reversal.

### Integration/route tests

- `[ ]` dashboard returns rewards payload;
- `[ ]` order creation snapshots status and awards points;
- `[ ]` bulk order creation awards once per order;
- `[ ]` redemption rejects below 5,000;
- `[ ]` redemption rejects insufficient balance;
- `[ ]` concurrent redemption cannot overspend;
- `[ ]` full refund reverses earned points and restores redeemed points;
- `[ ]` partial refund reverses/restores proportionally;
- `[ ]` old loyalty and new status discount cannot stack.

### UI checks

- `[ ]` Home cards fit desktop/tablet/mobile.
- `[ ]` Status modal opens/closes cleanly.
- `[ ]` Points modal opens/closes cleanly.
- `[ ]` Wallet card opens Points modal.
- `[ ]` No `loyalty points` wording.
- `[ ]` No `account status` wording.
- `[ ]` No backend-only values hardcoded into user UI when API is available.

---

## 15. Open product decisions

- `[ ]` Should existing users receive an opening Nitro Points balance based on historical spend?
- `[ ]` Should points redemption happen only at checkout, or into a separate rewards-credit bucket?
- `[ ]` Should points expire later, or never expire?
- `[ ]` Should manual admin adjustments require owner approval above a threshold?
- `[ ]` Should status be based on all-time eligible spend forever, or rolling 12-month eligible spend?
- `[ ]` Should visible points allow decimals, or should the UI display whole points only?

Current recommendation:

- Use all-time eligible spend for Nitro Status.
- Start points from launch for financial conservatism, unless we intentionally want a goodwill opening balance.
- Redeem points at checkout or into a separate rewards-credit bucket, not ordinary wallet balance.
- No expiry at launch.
- Store internal point value in integer kobo-equivalent for precision.

---

## 16. Immediate next actions for Claude

UI branch `origin/rewards-ui@c7e9af8` has already completed the first visual pass:

1. Home dashboard rewards strip exists.
2. Status modal exists.
3. Points modal exists.
4. Wallet compact points card exists.
5. Channel lane exists.
6. Rewards data is still mocked.

If Claude continues UI work before backend:

1. Keep rewards mocked only.
2. Do not touch checkout/order money logic.
3. Replace the hardcoded WhatsApp channel constant with the configured `social_whatsapp_channel` value when merging with the admin WhatsApp setting work.
4. Keep Tasks disabled unless the product explicitly starts the Tasks build.
5. Run build.

If Claude is doing backend next:

1. Start with Phase 1 only.
2. Add schema + helpers + read-only rewards payload.
3. Wire dashboard/wallet UI to real read-only rewards data.
4. Add tests.
5. Stop for review before touching checkout/order creation, discounts, points earning, or redemption.
