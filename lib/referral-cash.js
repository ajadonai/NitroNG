// Cash referrals: real-money earnings for referrers, held for the refund
// window, then payable to a bank account or convertible to wallet credit at a
// premium. Everything is gated on the cash_referrals_enabled setting — while
// it is 'false' (or absent) the classic wallet-credit referral path runs
// untouched and the page stays hidden.

export const CASH_REF_DEFAULTS = {
  amount: 50_000, // kobo — ₦500 cash per activated friend
  walletAmount: 60_000, // kobo — ₦600 if taken as wallet credit instead
  minPayout: 500_000, // kobo — ₦5,000 before a bank payout can be requested
  holdDays: 7, // the refund window before an earning becomes available
};

const keys = ['cash_referrals_enabled', 'ref_cash_amount', 'ref_cash_wallet_amount', 'ref_cash_min_payout', 'ref_cash_hold_days'];

const posInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function cashReferralSettings(db) {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    enabled: map.cash_referrals_enabled === 'true',
    amount: posInt(map.ref_cash_amount, CASH_REF_DEFAULTS.amount),
    walletAmount: posInt(map.ref_cash_wallet_amount, CASH_REF_DEFAULTS.walletAmount),
    minPayout: posInt(map.ref_cash_min_payout, CASH_REF_DEFAULTS.minPayout),
    holdDays: posInt(map.ref_cash_hold_days, CASH_REF_DEFAULTS.holdDays),
  };
}

/** Roll a user's earnings up into the figures the page leads with. */
export function summarizeEarnings(earnings, now = new Date()) {
  const sums = { available: 0, held: 0, requested: 0, paidOut: 0 };
  for (const e of earnings) {
    if (e.status === 'voided') continue;
    if (e.status === 'paid' || e.status === 'credited') sums.paidOut += e.amount;
    else if (e.status === 'requested') sums.requested += e.amount;
    else if (e.status === 'held') {
      if (new Date(e.releasesAt) <= now) sums.available += e.amount;
      else sums.held += e.amount;
    }
  }
  return sums;
}
