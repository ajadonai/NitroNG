import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
const logActivity = vi.fn();
const prisma = {
  $transaction: vi.fn(arg => typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  order: {
    count: vi.fn(),
  },
  serviceGroup: {
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  serviceTier: {
    findUnique: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('next/cache', () => ({
  unstable_cache: fn => fn,
  revalidateTag,
}));
vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ admin: { name: 'Owner' }, error: null }),
  logActivity,
}));

const { POST } = await import('@/app/api/admin/service-groups/route');

function mutation(body) {
  return POST(new Request('http://localhost/api/admin/service-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(arg => typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
  prisma.serviceGroup.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } });
  prisma.serviceGroup.create.mockResolvedValue({ id: 'new-group', name: 'Test (copy)' });
  prisma.serviceGroup.update.mockResolvedValue({});
  prisma.serviceGroup.delete.mockResolvedValue({});
  prisma.serviceTier.createMany.mockResolvedValue({ count: 0 });
  prisma.serviceTier.update.mockResolvedValue({});
  prisma.serviceTier.updateMany.mockResolvedValue({ count: 1 });
  prisma.serviceTier.delete.mockResolvedValue({});
});

describe('admin service-group deletion safety', () => {
  it('archives a tier that is referenced by an order', async () => {
    prisma.serviceTier.findUnique.mockResolvedValue({
      id: 'tier-1',
      tier: 'Budget',
      group: { name: 'Instagram Followers' },
    });
    prisma.order.count.mockResolvedValue(3);

    const response = await mutation({ action: 'delete-tier', tierIdToDelete: 'tier-1' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, archived: true });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { tierId: 'tier-1' } });
    expect(prisma.serviceTier.update).toHaveBeenCalledWith({
      where: { id: 'tier-1' },
      data: { enabled: false },
    });
    expect(prisma.serviceTier.delete).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(
      'Owner',
      'Archived Budget tier from "Instagram Followers"',
      'service',
    );
    expect(revalidateTag).toHaveBeenCalledWith('service-catalog');
  });

  it('hard-deletes a tier that has never been used', async () => {
    prisma.serviceTier.findUnique.mockResolvedValue({
      id: 'tier-2',
      tier: 'Premium',
      group: { name: 'Instagram Followers' },
    });
    prisma.order.count.mockResolvedValue(0);

    const response = await mutation({ action: 'delete-tier', tierIdToDelete: 'tier-2' });

    await expect(response.json()).resolves.toMatchObject({ success: true, archived: false });
    expect(prisma.serviceTier.delete).toHaveBeenCalledWith({ where: { id: 'tier-2' } });
    expect(prisma.serviceTier.update).not.toHaveBeenCalled();
  });

  it('archives a group and all its tiers when any tier is referenced', async () => {
    prisma.serviceGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      name: 'TikTok Views',
      tiers: [{ id: 'tier-3' }, { id: 'tier-4' }],
    });
    prisma.order.count.mockResolvedValue(1);

    const response = await mutation({ action: 'delete-group', groupId: 'group-1' });

    await expect(response.json()).resolves.toMatchObject({ success: true, archived: true });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { tierId: { in: ['tier-3', 'tier-4'] } },
    });
    expect(prisma.serviceGroup.update).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      data: { enabled: false },
    });
    expect(prisma.serviceTier.updateMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      data: { enabled: false },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.serviceGroup.delete).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(
      'Owner',
      'Archived service group "TikTok Views"',
      'service',
    );
  });

  it('hard-deletes a group when none of its tiers are referenced', async () => {
    prisma.serviceGroup.findUnique.mockResolvedValue({
      id: 'group-2',
      name: 'YouTube Likes',
      tiers: [{ id: 'tier-5' }],
    });
    prisma.order.count.mockResolvedValue(0);

    const response = await mutation({ action: 'delete-group', groupId: 'group-2' });

    await expect(response.json()).resolves.toMatchObject({ success: true, archived: false });
    expect(prisma.serviceGroup.delete).toHaveBeenCalledWith({ where: { id: 'group-2' } });
    expect(prisma.serviceGroup.update).not.toHaveBeenCalled();
    expect(prisma.serviceTier.updateMany).not.toHaveBeenCalled();
  });
});

describe('admin duplicate-group', () => {
  it('duplicates a group with its tiers as disabled', async () => {
    prisma.serviceGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      name: 'Instagram Followers',
      platform: 'instagram',
      type: 'Standard',
      nigerian: false,
      description: 'Best IG followers',
      tags: ['popular'],
      tiers: [
        { serviceId: 'svc-1', tier: 'Budget', sellPer1k: 500n, refill: false, refillDays: 0, speed: '0-2 hrs', sortOrder: 1, enabled: true },
        { serviceId: 'svc-2', tier: 'Premium', sellPer1k: 1200n, refill: true, refillDays: 30, speed: '0-1 hrs', sortOrder: 2, enabled: true },
      ],
    });
    prisma.serviceGroup.create.mockResolvedValue({
      id: 'new-group',
      name: 'Instagram Followers (copy)',
      enabled: false,
    });

    const response = await mutation({ action: 'duplicate-group', groupId: 'group-1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, group: { id: 'new-group', enabled: false } });
    expect(prisma.serviceGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Instagram Followers (copy)',
        platform: 'instagram',
        enabled: false,
        sortOrder: 6,
      }),
    });
    expect(prisma.serviceTier.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ tier: 'Budget', serviceId: 'svc-1' }),
        expect.objectContaining({ tier: 'Premium', serviceId: 'svc-2' }),
      ]),
    });
    expect(logActivity).toHaveBeenCalledWith('Owner', 'Duplicated group "Instagram Followers"', 'service');
    expect(revalidateTag).toHaveBeenCalledWith('service-catalog');
  });

  it('returns 404 for a nonexistent group', async () => {
    prisma.serviceGroup.findUnique.mockResolvedValue(null);

    const response = await mutation({ action: 'duplicate-group', groupId: 'ghost' });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'Group not found' });
  });

  it('returns 400 when groupId is missing', async () => {
    const response = await mutation({ action: 'duplicate-group' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Group ID required' });
  });

  it('duplicates a group with no tiers', async () => {
    prisma.serviceGroup.findUnique.mockResolvedValue({
      id: 'group-3',
      name: 'Empty Group',
      platform: 'tiktok',
      type: 'Standard',
      nigerian: true,
      description: null,
      tags: [],
      tiers: [],
    });
    prisma.serviceGroup.create.mockResolvedValue({
      id: 'new-empty',
      name: 'Empty Group (copy)',
      enabled: false,
    });

    const response = await mutation({ action: 'duplicate-group', groupId: 'group-3' });

    expect(response.status).toBe(200);
    expect(prisma.serviceTier.createMany).not.toHaveBeenCalled();
  });
});
