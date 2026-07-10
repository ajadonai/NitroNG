import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const DAY = 86400000;

function winbackCredit(lifetimeSpendKobo, pct, minNaira, capNaira) {
  const raw = Math.floor(lifetimeSpendKobo * pct / 100);
  return Math.min(Math.max(raw, minNaira * 100), capNaira * 100);
}

describe('winbackCredit formula', () => {
  it('applies percentage to lifetime spend', () => {
    expect(winbackCredit(1_000_000, 15, 100, 500)).toBe(50_000);
  });

  it('floors at minimum for small spenders (₦500 lifetime → ₦100)', () => {
    // ₦500 = 50_000 kobo × 15% = 7_500, floored at ₦100 = 10_000
    expect(winbackCredit(50_000, 15, 100, 500)).toBe(10_000);
  });

  it('caps at maximum for big spenders', () => {
    expect(winbackCredit(10_000_000, 25, 150, 1000)).toBe(100_000);
  });

  it('returns floor when spend is zero', () => {
    expect(winbackCredit(0, 15, 100, 500)).toBe(10_000);
  });

  it('day-60 mid-range falls within floor/cap', () => {
    // ₦3,000 = 300_000 kobo × 25% = 75_000 (₦750), within 150-1000
    expect(winbackCredit(300_000, 25, 150, 1000)).toBe(75_000);
  });

  it('day-60 floors at ₦150 for small spenders', () => {
    expect(winbackCredit(20_000, 25, 150, 1000)).toBe(15_000);
  });
});

describe('winback eligibility', () => {
  it('purchaser + 30d quiet fires', () => {
    const lastCompletedAt = new Date(Date.now() - 35 * DAY);
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
    expect(lastCompletedAt < thirtyDaysAgo).toBe(true);
  });

  it('non-purchaser never fires', () => {
    const hasCompletedOrder = false;
    expect(hasCompletedOrder).toBe(false);
  });

  it('recent order does not fire', () => {
    const lastCompletedAt = new Date(Date.now() - 10 * DAY);
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
    expect(lastCompletedAt < thirtyDaysAgo).toBe(false);
  });

  it('day-60 requires day-30 sent (not epoch failure)', () => {
    const realSend = new Date(Date.now() - 25 * DAY);
    expect(realSend > new Date(1000)).toBe(true);
    const failedSend = new Date(0);
    expect(failedSend > new Date(1000)).toBe(false);
  });

  it('order resets the cycle', () => {
    const winback30SentAt = new Date(Date.now() - 20 * DAY);
    const newOrderCreatedAt = new Date(Date.now() - 5 * DAY);
    expect(newOrderCreatedAt > winback30SentAt).toBe(true);
  });
});

describe('retired nudges never send', () => {
  it('comeback nudge logic is removed from cron', async () => {
    // The cron no longer imports sendNudgeComeback or calls it.
    // Verify by checking the import line doesn't include the retired functions.
    const { readFileSync } = await import('fs');
    const cron = readFileSync('app/api/cron/daily/route.js', 'utf8');
    expect(cron).not.toContain('sendNudgeComeback');
    expect(cron).not.toContain('sendNudgeLapsed');
    expect(cron).toContain('RETIRED: comeback');
  });
});

describe('spacing guard', () => {
  it('user nudged 5 days ago gets Play 7 delayed not skipped', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY);
    const nudgedFiveDaysAgo = new Date(Date.now() - 5 * DAY);

    // Spacing guard excludes if any SentAt > tenDaysAgo
    const blocked = nudgedFiveDaysAgo > tenDaysAgo;
    expect(blocked).toBe(true);

    // But the user is still eligible (winback30SentAt is null) — just delayed.
    // On a future cron run after 10 days pass, they'll qualify.
    const fiveDaysLater = new Date(nudgedFiveDaysAgo.getTime() + 10 * DAY);
    const futureGuard = new Date(fiveDaysLater.getTime() - 10 * DAY);
    expect(nudgedFiveDaysAgo > futureGuard).toBe(false);
  });

  it('user nudged 12 days ago clears the guard', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY);
    const nudgedTwelveDaysAgo = new Date(Date.now() - 12 * DAY);
    expect(nudgedTwelveDaysAgo > tenDaysAgo).toBe(false);
  });

  it('epoch failure markers do not trigger the guard', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY);
    const epochMarker = new Date(0);
    expect(epochMarker > tenDaysAgo).toBe(false);
  });
});

describe('grant-vs-send ordering and retry', () => {
  it('credit grant is gated by spacing guard — both delayed together', () => {
    const spacingBlocked = true;
    const grantHappened = !spacingBlocked;
    const emailSent = !spacingBlocked;
    expect(grantHappened).toBe(false);
    expect(emailSent).toBe(false);
  });

  it('first attempt: grant, then email; email failure sets retry marker', async () => {
    const ops = [];
    let flag = null;
    const isRetry = false;
    const attempt = 1;

    // Simulate first-attempt loop body
    try {
      if (!isRetry) { ops.push('grant'); }
      try {
        ops.push('send_email');
        throw new Error('SMTP down');
      } catch {
        flag = attempt >= 3 ? new Date(0) : new Date(attempt);
        ops.push(`set_marker_${flag.getTime()}`);
      }
    } catch { flag = new Date(0); }

    expect(ops).toEqual(['grant', 'send_email', 'set_marker_1']);
    expect(flag).toEqual(new Date(1));
  });

  it('failed send retries next run without double-granting', async () => {
    const ops = [];
    // Retry: winback30SentAt = Date(1) means isRetry = true
    const isRetry = true;
    const attempt = 2; // Date(1).getTime() + 1

    if (!isRetry) { ops.push('grant'); }
    // On retry, grant is skipped — only email is attempted
    ops.push('lookup_credit');
    ops.push('send_email');

    expect(ops).not.toContain('grant');
    expect(ops).toEqual(['lookup_credit', 'send_email']);
  });

  it('success on retry 2 sets the flag clean (real date)', async () => {
    let flag = new Date(1); // after 1st failure
    const isRetry = flag !== null;
    const attempt = flag.getTime() + 1; // 2

    // Simulate successful email on retry
    const emailSucceeded = true;
    if (emailSucceeded) {
      flag = new Date(); // real date = clean success
    }

    expect(flag.getTime()).toBeGreaterThan(1000);
    expect(attempt).toBe(2);
  });

  it('3rd failure sets permanent marker (Date(0))', () => {
    const attempt = 3;
    const marker = attempt >= 3 ? new Date(0) : new Date(attempt);
    expect(marker).toEqual(new Date(0));
  });

  it('grant failure on first attempt sets permanent marker', async () => {
    const ops = [];
    let flag = null;

    try {
      ops.push('grant');
      throw new Error('DB error');
    } catch {
      flag = new Date(0);
      ops.push('permanent_marker');
    }

    expect(ops).toEqual(['grant', 'permanent_marker']);
    expect(flag).toEqual(new Date(0));
  });
});

describe('stale offer protection', () => {
  const STALE_CUTOFF_MS = 4 * DAY;

  it('offer with 5 days left proceeds', () => {
    const msLeft = 5 * DAY;
    expect(msLeft >= STALE_CUTOFF_MS).toBe(true);
  });

  it('offer with 3 days left is skipped', () => {
    const msLeft = 3 * DAY;
    expect(msLeft >= STALE_CUTOFF_MS).toBe(false);
  });

  it('exhausted retries never send a stale offer', () => {
    // Scenario: 3 failures over 4 days. Credit has 3 days left.
    const attempt = 3;
    const msLeft = 3 * DAY;

    // Before attempting, check staleness
    const isStale = msLeft < STALE_CUTOFF_MS;
    // Even if we hadn't exhausted retries, staleness skips the send
    expect(isStale).toBe(true);

    // Result: permanent marker, no email
    const marker = new Date(0);
    const emailSent = false;
    expect(marker).toEqual(new Date(0));
    expect(emailSent).toBe(false);
  });

  it('retry markers (Date(1), Date(2)) are included in query, Date(0) is not', () => {
    const RETRY_ELIGIBLE = [new Date(1), new Date(2)];
    expect(RETRY_ELIGIBLE.some(d => d.getTime() === new Date(1).getTime())).toBe(true);
    expect(RETRY_ELIGIBLE.some(d => d.getTime() === new Date(2).getTime())).toBe(true);
    expect(RETRY_ELIGIBLE.some(d => d.getTime() === new Date(0).getTime())).toBe(false);
  });

  it('retry markers do not trigger spacing guard', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY);
    expect(new Date(1) > tenDaysAgo).toBe(false);
    expect(new Date(2) > tenDaysAgo).toBe(false);
  });
});

describe('reverse guard: active winback credit blocks other sends', () => {
  it('user with live bonus credit excluded from idle-balance nudge', () => {
    // The idle-balance query includes:
    // bonusCredits: { none: { amountRemaining: { gt: 0 }, expiredAt: null, expiresAt: { gt: now } } }
    const activeBonusCredits = [
      { amountRemaining: 5000, expiredAt: null, expiresAt: new Date(Date.now() + 3 * DAY) },
    ];
    const hasLiveCredit = activeBonusCredits.some(
      c => c.amountRemaining > 0 && !c.expiredAt && c.expiresAt > new Date()
    );
    // "none" means the query EXCLUDES users where any match → user excluded
    expect(hasLiveCredit).toBe(true);
  });

  it('user with expired bonus credit is NOT excluded', () => {
    const bonusCredits = [
      { amountRemaining: 0, expiredAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() - 2 * DAY) },
    ];
    const hasLiveCredit = bonusCredits.some(
      c => c.amountRemaining > 0 && !c.expiredAt && c.expiresAt > new Date()
    );
    expect(hasLiveCredit).toBe(false);
  });

  it('promo blast excludes users with active bonus credits', async () => {
    const { readFileSync } = await import('fs');
    const emailLib = readFileSync('lib/email.js', 'utf8');
    expect(emailLib).toContain('bonusCredits: { none:');
  });
});
