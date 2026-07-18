import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
const logActivity = vi.fn();
const prisma = {
  $transaction: vi.fn(operations => Promise.all(operations)),
  order: {
    count: vi.fn(),
  },
  serviceGroup: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  serviceTier: {
    findUnique: vi.fn(),
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
  prisma.$transaction.mockImplementation(operations => Promise.all(operations));
  prisma.serviceGroup.update.mockResolvedValue({});
  prisma.serviceGroup.delete.mockResolvedValue({});
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
