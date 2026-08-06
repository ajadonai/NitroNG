import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('app/api/admin/orders/route.js', 'utf8');

function blockBetween(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('admin order settlement lock protocol', () => {
  it('renews the cancellation lease under the account lock before each provider cancellation', () => {
    const helper = blockBetween('async function renewAdminCancellationLease', 'async function nextOrderId');
    const helperLock = helper.indexOf('lockOrderSettlementAccount(tx, userId)');
    const helperRenewal = helper.indexOf('tx.order.updateMany');

    expect(helperLock).toBeGreaterThanOrEqual(0);
    expect(helperRenewal).toBeGreaterThan(helperLock);
    expect(helper).toContain("status: 'Cancelling'");
    expect(helper).toContain('data: { updatedAt: new Date() }');

    const block = blockBetween("if (action === 'cancel')", "if (action === 'refill')");
    const renewals = [...block.matchAll(/renewAdminCancellationLease\(order\.id, order\.userId\)/g)].map(match => match.index);
    const providerCalls = [...block.matchAll(/cancelOrder\(provider,/g)].map(match => match.index);

    expect(renewals).toHaveLength(2);
    expect(providerCalls).toHaveLength(2);
    expect(renewals[0]).toBeLessThan(providerCalls[0]);
    expect(renewals[1]).toBeLessThan(providerCalls[1]);
  });

  it('locks the account before both cancellation parent locks and before provider cancellation', () => {
    const block = blockBetween("if (action === 'cancel')", "if (action === 'refill')");
    const accountLocks = [...block.matchAll(/lockOrderSettlementAccount\(tx, order\.userId\)/g)].map(match => match.index);
    const parentLocks = [...block.matchAll(/FROM "orders"/g)].map(match => match.index);

    expect(accountLocks).toHaveLength(2);
    expect(parentLocks).toHaveLength(2);
    expect(accountLocks[0]).toBeLessThan(parentLocks[0]);
    expect(accountLocks[1]).toBeLessThan(parentLocks[1]);

    const phaseOneAccepted = block.indexOf('if (!phase1.ok)');
    const providerCancellation = block.indexOf('cancelOrder(provider, phase1.fresh.apiOrderId)');
    expect(providerCancellation).toBeGreaterThan(phaseOneAccepted);
    expect(block).toContain("data: { status: 'Cancelling' }");
    expect(block.indexOf("data: { status: 'Cancelling' }")).toBeLessThan(phaseOneAccepted);
  });

  it('locks the account before provider-result refunds and fences the observed order snapshot', () => {
    const block = blockBetween("if (action === 'check')", "if (action === 'refund')");
    const locks = [...block.matchAll(/lockOrderSettlementAccount\(tx, order\.userId\)/g)].map(match => match.index);
    const claims = [...block.matchAll(/const claimed = await tx\.order\.updateMany/g)].map(match => match.index);

    expect(locks).toHaveLength(2);
    expect(claims).toHaveLength(2);
    expect(locks[0]).toBeLessThan(claims[0]);
    expect(locks[1]).toBeLessThan(claims[1]);
    expect(block).toContain('status: order.status');
    expect(block).toContain('apiOrderId: order.apiOrderId');
    expect(block).not.toContain("status: { not: 'Cancelled' }");
  });

  it('locks before recomputing a manual refund and does not use a stale pre-transaction total', () => {
    const block = blockBetween("if (action === 'refund')", "if (action === 'retry')");
    const lock = block.indexOf('lockOrderSettlementAccount(tx, order.userId)');
    const refundedTotal = block.indexOf('getTotalRefundedKobo(tx');

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(refundedTotal).toBeGreaterThan(lock);
    expect(block).not.toContain('getTotalRefundedKobo(prisma');
  });
});
