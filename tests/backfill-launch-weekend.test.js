import { describe, it, expect } from 'vitest';
import { getNitroStatus, computePointsEarnedKobo } from '../lib/nitro-rewards-core.js';
import {
  makeDedupeKey,
  computeEligibleCharge,
  isInWindow,
  isEligibleStatus,
  WINDOW_START,
  WINDOW_END,
} from '../scripts/backfill-nitro-launch-weekend-points.mjs';

describe('launch weekend backfill — eligible charge calculation', () => {
  it('completed weekend order earns points', () => {
    const eligible = computeEligibleCharge(500000, 0, 0, 0);
    expect(eligible).toBe(500000);
    const tier = getNitroStatus(0); // Spark, 0.5%
    expect(computePointsEarnedKobo(eligible, tier)).toBe(2500);
  });

  it('partial weekend order earns points', () => {
    const eligible = computeEligibleCharge(300000, 0, 0, 0);
    const tier = getNitroStatus(100000); // Pulse, 1%
    expect(computePointsEarnedKobo(eligible, tier)).toBe(3000);
  });

  it('refunded value is excluded', () => {
    const eligible = computeEligibleCharge(500000, 200000, 0, 0);
    expect(eligible).toBe(300000);
    expect(computePointsEarnedKobo(eligible, getNitroStatus(0))).toBe(1500);
  });

  it('bonus credit value is excluded', () => {
    const eligible = computeEligibleCharge(500000, 0, 150000, 0);
    expect(eligible).toBe(350000);
    expect(computePointsEarnedKobo(eligible, getNitroStatus(0))).toBe(1750);
  });

  it('redeemed points value is excluded', () => {
    const eligible = computeEligibleCharge(500000, 0, 0, 100000);
    expect(eligible).toBe(400000);
  });

  it('all deductions combined', () => {
    const eligible = computeEligibleCharge(500000, 100000, 50000, 30000);
    expect(eligible).toBe(320000);
  });

  it('clamps to zero when deductions exceed charge', () => {
    const eligible = computeEligibleCharge(100000, 200000, 0, 0);
    expect(eligible).toBe(0);
    expect(computePointsEarnedKobo(eligible, getNitroStatus(0))).toBe(0);
  });
});

describe('launch weekend backfill — window boundaries', () => {
  it('window starts at Sat Jul 11 00:00 WAT', () => {
    expect(WINDOW_START.toISOString()).toBe('2026-07-10T23:00:00.000Z');
  });

  it('window ends at deploy timestamp', () => {
    expect(WINDOW_END.toISOString()).toBe('2026-07-13T12:12:40.000Z');
  });

  it('order inside window is eligible', () => {
    expect(isInWindow(new Date('2026-07-11T10:00:00.000Z'))).toBe(true);
    expect(isInWindow(new Date('2026-07-12T23:59:59.000Z'))).toBe(true);
    expect(isInWindow(WINDOW_START)).toBe(true);
  });

  it('order outside window is skipped', () => {
    expect(isInWindow(new Date('2026-07-10T22:59:59.000Z'))).toBe(false);
    expect(isInWindow(WINDOW_END)).toBe(false);
    expect(isInWindow(new Date('2026-07-14T00:00:00.000Z'))).toBe(false);
  });
});

describe('launch weekend backfill — status eligibility', () => {
  it('cancelled/pending/processing orders are skipped', () => {
    expect(isEligibleStatus('Cancelled')).toBe(false);
    expect(isEligibleStatus('Pending')).toBe(false);
    expect(isEligibleStatus('Processing')).toBe(false);
  });

  it('completed and partial orders are eligible', () => {
    expect(isEligibleStatus('Completed')).toBe(true);
    expect(isEligibleStatus('Partial')).toBe(true);
  });
});

describe('launch weekend backfill — idempotency', () => {
  it('dedupeKey is deterministic', () => {
    expect(makeDedupeKey('clxyz123')).toBe('launch_weekend_points:clxyz123');
    expect(makeDedupeKey('clxyz123')).toBe(makeDedupeKey('clxyz123'));
  });

  it('different orders produce different dedupeKeys', () => {
    expect(makeDedupeKey('order-a')).not.toBe(makeDedupeKey('order-b'));
  });
});
