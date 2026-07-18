import { describe, expect, it } from 'vitest';

const { decorateUserWithRewardsStatus } = await import('@/components/dashboard');

describe('dashboard Nitro Status projection', () => {
  it('decorates the dashboard user from the canonical rewards status', () => {
    const user = { id: 'user-1', name: 'Test User' };
    const rewards = { status: { key: 'surge', name: 'Surge', nextName: 'Apex' } };

    expect(decorateUserWithRewardsStatus(user, rewards)).toEqual({
      ...user,
      badge: 'Surge',
      badgeColor: '#f472b6',
      nextTier: { name: 'Apex', color: '#fb923c' },
    });
  });

  it('does not mislabel the user as Spark when rewards are unavailable', () => {
    const user = { id: 'user-1', name: 'Test User', badge: 'Legend', badgeColor: '#fbbf24' };

    expect(decorateUserWithRewardsStatus(user, null)).toEqual({
      ...user,
      badge: 'Status unavailable',
      badgeColor: null,
      nextTier: null,
    });
  });

  it('does not trust an unknown status key', () => {
    const user = { id: 'user-1', name: 'Test User' };
    const rewards = { status: { key: 'retired-tier', name: 'Legend' } };

    expect(decorateUserWithRewardsStatus(user, rewards)).toEqual({
      ...user,
      badge: 'Status unavailable',
      badgeColor: null,
      nextTier: null,
    });
  });
});
