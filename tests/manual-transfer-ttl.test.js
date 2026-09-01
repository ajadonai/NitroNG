import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANUAL_UNCONFIRMED_TTL_MS } from '../lib/transaction-history.js';

const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('unconfirmed bank transfers', () => {
  it('gives the customer a full day to press "I\'ve sent it"', () => {
    expect(MANUAL_UNCONFIRMED_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('retires the row instead of deleting it, so the money stays traceable', () => {
    // Deleting the transaction took the "I've sent it" button with it while the
    // customer was still at their bank, and left support nothing to match a
    // payment against. Both sweepers must mark, never delete.
    const dashboard = read('app/api/dashboard/route.js');
    expect(dashboard).toContain('MANUAL_UNCONFIRMED_TTL_MS');
    expect(dashboard).toContain("[expired_unconfirmed]");
    expect(dashboard).not.toMatch(/transaction\.deleteMany\([^)]*awaiting_confirmation/s);

    const cleanup = read('app/api/cron/cleanup/route.js');
    expect(cleanup).toContain('MANUAL_UNCONFIRMED_TTL_MS');
    expect(cleanup).toMatch(/updateMany\(\{[\s\S]*awaiting_confirmation[\s\S]*status: 'Expired'/);
    expect(cleanup).not.toMatch(/deleteMany\([\s\S]{0,400}?awaiting_confirmation/);
    // A confirmed transfer the admin has not processed is a backlog item, not
    // litter: it must never be swept away.
    expect(cleanup).not.toMatch(/deleteMany\([\s\S]{0,400}?user_confirmed/);
  });

  it('keeps the confirm sheet on the one modal layer, above the mobile dock', () => {
    const sheet = read('components/manual-transfer-sheet.jsx');
    expect(sheet).toContain('aria-label="Bank transfer"');
    expect(sheet).toMatch(/fixed inset-0 z-\[200\][^"]*items-end md:items-center/);
  });

  it('holds its height when the action row stacks on a small phone', () => {
    // flex-1 in a stacked column zeroes the flex-basis and eats the button's
    // height — it measured 20px at 360px wide before this guard.
    const sheet = read('components/manual-transfer-sheet.jsx');
    const stacked = sheet.match(/max-\[380px\]:flex-col/g) || [];
    const pinned = sheet.match(/max-\[380px\]:flex-none/g) || [];
    expect(stacked.length).toBeGreaterThan(0);
    expect(pinned.length).toBeGreaterThanOrEqual(stacked.length * 2);
  });
});
