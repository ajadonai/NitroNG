import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  claimSameLinkRetryOrder,
  findOpenSameLinkOrder,
  findSameLinkDispatchBlocker,
  findSameLinkDispatchBlockers,
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
      { dripDispatches: { some: { status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } } } },
    ]));
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('resolves blockers for a retry batch with one database query', async () => {
    const createdAt = new Date('2026-07-28T08:00:00Z');
    const queryRawUnsafe = vi.fn().mockResolvedValue([
      { candidateId: 'order-b', blockerOrderId: 'NTR-A' },
      { candidateId: 'order-c', blockerOrderId: 'NTR-LATER' },
    ]);
    const candidates = [
      { id: 'order-a', serviceId: 'svc-1', link: 'https://x.test/post', createdAt },
      {
        id: 'order-b', serviceId: 'svc-1', link: 'https://x.test/post',
        createdAt: new Date(createdAt.getTime() + 1000),
      },
      { id: 'order-c', serviceId: 'svc-2', link: 'https://x.test/other', createdAt },
    ];

    const blockers = await findSameLinkDispatchBlockers(
      { $queryRawUnsafe: queryRawUnsafe },
      candidates,
    );

    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('JOIN LATERAL');
    expect(sql).toContain('LIMIT 1');
    expect(sql).toContain('o."createdAt" = c.created_at AND o.id < c.id');
    expect(sql).toContain("d.status IN ('dispatching', 'processing', 'verifying', 'cancelling')");
    expect(params).toEqual([
      'order-a', 'svc-1', 'https://x.test/post', createdAt,
      'order-b', 'svc-1', 'https://x.test/post', new Date(createdAt.getTime() + 1000),
      'order-c', 'svc-2', 'https://x.test/other', createdAt,
    ]);
    expect(blockers.get('order-a')).toBeUndefined();
    expect(blockers.get('order-b')).toEqual({ orderId: 'NTR-A' });
    expect(blockers.get('order-c')).toEqual({ orderId: 'NTR-LATER' });
  });

  it('does not query when a retry batch has no usable queue keys', async () => {
    const queryRawUnsafe = vi.fn();
    const blockers = await findSameLinkDispatchBlockers(
      { $queryRawUnsafe: queryRawUnsafe },
      [{ id: 'missing-service', link: 'https://x.test/post' }],
    );

    expect(blockers.size).toBe(0);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('atomically checks the live blocker set while claiming a retry', async () => {
    const claimedAt = new Date('2026-07-28T08:05:00Z');
    const observedAt = new Date('2026-07-28T08:04:00Z');
    const queryRawUnsafe = vi.fn().mockResolvedValue([{ id: 'order-a' }]);

    const claimed = await claimSameLinkRetryOrder(
      { $queryRawUnsafe: queryRawUnsafe },
      { id: 'order-a', queuedBehind: null, updatedAt: observedAt },
      claimedAt,
    );

    expect(claimed).toBe(true);
    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("candidate.status = 'Pending'");
    expect(sql).toContain('candidate."apiOrderId" IS NULL');
    expect(sql).toContain('candidate."deletedAt" IS NULL');
    expect(sql).toContain('candidate."queuedBehind" IS NOT DISTINCT FROM $3::text');
    expect(sql).toContain('candidate."updatedAt" = $4::timestamp(3)');
    expect(sql).toContain('AND NOT EXISTS (');
    expect(sql).toContain('blocker."serviceId" = candidate."serviceId"');
    expect(sql).toContain("in_flight.status IN ('dispatching', 'processing', 'verifying', 'cancelling')");
    expect(params).toEqual(['order-a', claimedAt, null, observedAt]);
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
