import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  findOpenSameLinkOrder,
  findSameLinkDispatchBlocker,
  isActiveOrderConflict,
} from '@/lib/order-queue';

describe('order queue primitives', () => {
  it('classifies provider same-link conflicts as retryable queue waits', () => {
    expect(isActiveOrderConflict('You have active order with this link.')).toBe(true);
    expect(isActiveOrderConflict(new Error('Please wait until order being completed.'))).toBe(true);
    expect(isActiveOrderConflict(new Error('socket timed out'))).toBe(false);
    expect(isActiveOrderConflict(new Error('incorrect service'))).toBe(false);
  });

  it('finds the oldest open same-link order, including Dispatching orders', async () => {
    const findFirst = vi.fn().mockResolvedValue({ orderId: 'NTR-2890' });
    const result = await findOpenSameLinkOrder({ order: { findFirst } }, {
      serviceId: 'service-8871',
      link: 'https://youtube.com/@thewargenerals',
      excludeOrderId: 'source-order',
    });

    expect(result).toEqual({ orderId: 'NTR-2890' });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        serviceId: 'service-8871',
        link: 'https://youtube.com/@thewargenerals',
        deletedAt: null,
        status: { in: ['Pending', 'Processing', 'Dispatching', 'In progress'] },
        id: { not: 'source-order' },
      },
      select: { orderId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('preserves FIFO while also recognizing direct and drip requests already in flight', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const createdAt = new Date('2026-07-17T17:05:07Z');
    await findSameLinkDispatchBlocker({ order: { findFirst } }, {
      id: 'child-order',
      serviceId: 'service-8871',
      link: 'https://youtube.com/@thewargenerals',
      createdAt,
    });

    const query = findFirst.mock.calls[0][0];
    expect(query.where.status.in).toContain('Dispatching');
    expect(query.where.OR).toEqual(expect.arrayContaining([
      { createdAt: { lt: createdAt } },
      { apiOrderId: { not: null } },
      { status: 'Dispatching' },
      { dripDispatches: { some: { status: { in: ['dispatching', 'processing'] } } } },
    ]));
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('fences every regular and reorder provider claim on a clear queue pointer', () => {
    const code = fs.readFileSync(new URL('../app/api/orders/route.js', import.meta.url), 'utf8');
    const directClaims = [...code.matchAll(/const directClaim = await prisma\.order\.updateMany\(\{([\s\S]*?)\n\s*\}\);/g)];
    const dripClaims = [...code.matchAll(/const (?:batchClaim|firstClaim) = await prisma\.dripDispatch\.updateMany\(\{([\s\S]*?)\n\s*\}\);/g)];

    expect(directClaims).toHaveLength(2);
    expect(dripClaims).toHaveLength(2);
    for (const claim of [...directClaims, ...dripClaims]) {
      expect(claim[1]).toContain('queuedBehind: null');
    }
  });

  it('returns definitive reorder failures to Pending while preserving ambiguous timeouts', () => {
    const code = fs.readFileSync(new URL('../app/api/orders/route.js', import.meta.url), 'utf8');
    expect(code).toContain("status: rIsTimeout2 ? 'Dispatching' : 'Pending'");
    expect(code).toContain('dispatchedAt: rIsTimeout2 ? undefined : null');
  });
});
