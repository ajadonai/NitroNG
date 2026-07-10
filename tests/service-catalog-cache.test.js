import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
const prisma = {
  serviceGroup: {
    aggregate: vi.fn(),
    create: vi.fn(),
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
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('@/app/api/admin/service-groups/route');

beforeEach(() => {
  vi.clearAllMocks();
  prisma.serviceGroup.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  prisma.serviceGroup.create.mockResolvedValue({
    id: 'group-1',
    name: 'Instagram Likes',
    platform: 'instagram',
    type: 'likes',
  });
});

describe('service catalogue cache invalidation', () => {
  it('invalidates the catalogue after a successful menu mutation', async () => {
    const response = await POST(new Request('http://localhost/api/admin/service-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-group',
        name: 'Instagram Likes',
        platform: 'instagram',
        type: 'likes',
      }),
    }));

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('service-catalog');
  });
});
