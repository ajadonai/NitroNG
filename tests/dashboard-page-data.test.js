import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDashboard = vi.fn();
const getRewards = vi.fn();

vi.mock('@/app/api/dashboard/route', () => ({ GET: getDashboard }));
vi.mock('@/app/api/rewards/route', () => ({ GET: getRewards }));
vi.mock('@/components/dashboard', () => ({ default: () => null }));

const { default: DashboardPage } = await import('@/app/dashboard/page');

beforeEach(() => {
  vi.clearAllMocks();
  getDashboard.mockResolvedValue(Response.json({ user: { id: 'user-1' }, orders: [] }));
  getRewards.mockResolvedValue(Response.json({ status: { key: 'boost', name: 'Boost' } }));
});

describe('dashboard initial data', () => {
  it('loads canonical rewards once alongside the bounded dashboard payload', async () => {
    const page = await DashboardPage();

    expect(getDashboard).toHaveBeenCalledTimes(1);
    expect(getRewards).toHaveBeenCalledTimes(1);
    expect(page.props.initialData).toEqual({
      user: { id: 'user-1' },
      orders: [],
      rewards: { status: { key: 'boost', name: 'Boost' } },
    });
  });

  it('keeps the dashboard usable when rewards are unavailable', async () => {
    getRewards.mockRejectedValue(new Error('rewards unavailable'));

    const page = await DashboardPage();

    expect(page.props.initialData).toEqual({ user: { id: 'user-1' }, orders: [] });
  });

  it('keeps the dashboard usable when rewards returns a non-OK response', async () => {
    getRewards.mockResolvedValue(Response.json({ error: 'temporarily unavailable' }, { status: 503 }));

    const page = await DashboardPage();

    expect(page.props.initialData).toEqual({ user: { id: 'user-1' }, orders: [] });
  });
});
