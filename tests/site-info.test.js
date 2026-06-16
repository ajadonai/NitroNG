import { describe, it, expect } from 'vitest';

function calcDeliveryRate(counts) {
  const denom = (counts.Completed || 0) + (counts.Partial || 0) + (counts.Cancelled || 0);
  if (denom === 0) return undefined;
  return Math.max(90, Math.round(((counts.Completed || 0) / denom) * 100));
}

function calcProcessing(liveCount, base) {
  return liveCount + base;
}

describe('deliveryRate', () => {
  it('computes rate from terminal statuses', () => {
    expect(calcDeliveryRate({ Completed: 90, Partial: 5, Cancelled: 5 })).toBe(90);
  });

  it('rounds to nearest integer', () => {
    expect(calcDeliveryRate({ Completed: 97, Partial: 1, Cancelled: 2 })).toBe(97);
  });

  it('floors at 90% minimum', () => {
    expect(calcDeliveryRate({ Completed: 2, Partial: 0, Cancelled: 1 })).toBe(90);
    expect(calcDeliveryRate({ Completed: 0, Partial: 0, Cancelled: 10 })).toBe(90);
  });

  it('returns undefined when denominator is zero', () => {
    expect(calcDeliveryRate({})).toBeUndefined();
    expect(calcDeliveryRate({ Completed: 0, Partial: 0, Cancelled: 0 })).toBeUndefined();
  });

  it('handles 100% delivery', () => {
    expect(calcDeliveryRate({ Completed: 500, Partial: 0, Cancelled: 0 })).toBe(100);
  });

});

describe('processing count', () => {
  it('adds baseline to live count', () => {
    expect(calcProcessing(42, 20)).toBe(62);
  });

  it('returns baseline when live count is zero', () => {
    expect(calcProcessing(0, 20)).toBe(20);
  });
});
