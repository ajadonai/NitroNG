import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CLEARED_PAYOUT_BANK_FIELDS,
  crewLinkDeletionTombstones,
  crewMemberDeletionTombstones,
  permanentlyDeleteCrewMember,
} from '@/lib/crew-account-deletion';

function member(overrides = {}) {
  return {
    id: 'crew-1',
    name: 'Ada Marketer',
    email: 'ada@example.test',
    password: 'bcrypt-hash',
    phone: '08012345678',
    xHandle: '@ada',
    telegramHandle: '@ada-tg',
    telegramUserId: '998877',
    whyApply: 'I know the market',
    bankName: 'Nitro Bank',
    bankAccountNo: '0123456789',
    bankAccountName: 'Ada Marketer',
    teamName: 'Ada Team',
    commissionRate: 40,
    totalEarned: 900000,
    totalPaid: 250000,
    ...overrides,
  };
}

function transactionMock(memberRow = member()) {
  return {
    crewMember: {
      findUnique: vi.fn().mockResolvedValue(memberRow),
      updateMany: vi.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 2 }),
    },
    crewSession: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    affiliatePayout: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'pending-1', bankName: null, bankAccountNo: 'saved-no', bankAccountName: null },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    affiliateCommission: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    acquisitionLink: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'link-1', name: 'Ada campaign', affiliateId: 'crew-1', archivedAt: null },
        {
          id: 'link-2', name: 'Second Ada campaign', affiliateId: 'crew-1',
          archivedAt: new Date('2026-01-01T00:00:00Z'),
        },
        { id: 'link-3', name: 'Ada Marketer handoff', affiliateId: 'active-crew', archivedAt: null },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
    activityLog: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'activity-1', action: 'Approved Ada Marketer at ada@example.test',
          adminName: 'Real Admin', type: 'crew',
        },
        {
          id: 'activity-2', action: 'Pit member changed password',
          adminName: 'Ada Marketer', type: 'pit-self',
        },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
    linkLog: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'log-1', detail: 'Assigned to Ada Marketer via @ada' },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('Pit Crew privacy tombstones', () => {
  it('is deterministic and unique without retaining the old identity', () => {
    expect(crewMemberDeletionTombstones('crew-1')).toEqual(crewMemberDeletionTombstones('crew-1'));
    expect(crewMemberDeletionTombstones('crew-1')).not.toEqual(crewMemberDeletionTombstones('crew-2'));
    expect(crewMemberDeletionTombstones('crew-1')).toEqual({
      name: 'Deleted Pit member crew-1',
      email: 'deleted-crew-1@pit.invalid',
      password: '!deleted:crew-1',
    });
    expect(crewLinkDeletionTombstones('link-1')).toEqual(expect.objectContaining({
      name: 'Deleted Pit link link-1',
      slug: expect.stringMatching(/^pit-deleted-link-1-[a-f0-9]{32}$/),
    }));
    expect(crewLinkDeletionTombstones('cm1234567890123456789012345').slug.length).toBeGreaterThan(30);
  });

  it('erases member PII while preserving financial and rate fields by omission', async () => {
    const tx = transactionMock();
    const deletedAt = new Date('2026-07-17T12:00:00Z');

    const result = await permanentlyDeleteCrewMember(tx, 'crew-1', deletedAt);

    expect(result).toEqual({ telegramUserId: '998877' });
    const memberWrite = tx.crewMember.updateMany.mock.calls[0][0];
    expect(memberWrite.where).toEqual({ id: 'crew-1', deletedAt: null });
    expect(memberWrite.data).toEqual(expect.objectContaining({
      status: 'deleted',
      deletedAt,
      name: 'Deleted Pit member crew-1',
      email: 'deleted-crew-1@pit.invalid',
      password: '!deleted:crew-1',
      phone: null,
      xHandle: null,
      telegramHandle: null,
      telegramUserId: null,
      whyApply: null,
      bankName: null,
      bankAccountNo: null,
      bankAccountName: null,
      userId: null,
      teamName: null,
      leadId: null,
    }));
    expect(memberWrite.data).not.toHaveProperty('commissionRate');
    expect(memberWrite.data).not.toHaveProperty('totalEarned');
    expect(memberWrite.data).not.toHaveProperty('totalPaid');
    expect(memberWrite.data).not.toHaveProperty('approvedAt');
    expect(memberWrite.data).not.toHaveProperty('createdAt');
  });

  it('retains bank data only on unsettled payout snapshots and redacts links and logs', async () => {
    const tx = transactionMock();
    const deletedAt = new Date('2026-07-17T12:00:00Z');

    await permanentlyDeleteCrewMember(tx, 'crew-1', deletedAt);

    expect(tx.affiliatePayout.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'pending-1', status: { in: ['pending', 'processing'] } },
      data: {
        bankName: 'Nitro Bank',
        bankAccountNo: 'saved-no',
        bankAccountName: 'Ada Marketer',
      },
    });
    expect(tx.affiliatePayout.updateMany.mock.calls[1][0]).toEqual({
      where: { memberId: 'crew-1', status: { in: ['completed', 'rejected'] } },
      data: CLEARED_PAYOUT_BANK_FIELDS,
    });
    expect(tx.affiliateCommission.updateMany).toHaveBeenNthCalledWith(1, {
      where: { memberId: 'crew-1', status: 'held' },
      data: { status: 'voided', voidedAt: deletedAt, voidReason: 'member_deleted' },
    });
    expect(tx.affiliateCommission.updateMany).toHaveBeenNthCalledWith(2, {
      where: { leadId: 'crew-1', memberId: { not: 'crew-1' }, status: 'held' },
      data: {
        leadAmount: 0,
        leadForfeitedAt: deletedAt,
        leadForfeitReason: 'lead_deleted',
      },
    });

    expect(tx.acquisitionLink.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'link-1' },
      data: {
        ...crewLinkDeletionTombstones('link-1'),
        enabled: false,
        archivedAt: deletedAt,
      },
    });
    expect(tx.acquisitionLink.update.mock.calls[1][0].data.archivedAt)
      .toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(tx.acquisitionLink.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'link-3' },
      data: { name: 'Deleted Pit member handoff' },
    });
    expect(tx.acquisitionLink.update.mock.calls[2][0].data).not.toHaveProperty('enabled');
    expect(tx.acquisitionLink.update.mock.calls[2][0].data).not.toHaveProperty('archivedAt');

    const activity = tx.activityLog.update.mock.calls[0][0].data.action;
    const pitSelf = tx.activityLog.update.mock.calls[1][0].data;
    const linkDetail = tx.linkLog.update.mock.calls[0][0].data.detail;
    expect(activity).toBe('Approved Deleted Pit member at Deleted Pit member');
    expect(tx.activityLog.update.mock.calls[0][0].data.adminName).toBe('Real Admin');
    expect(pitSelf).toEqual({
      action: 'Pit member changed password',
      adminName: 'Deleted Pit member crew-1',
    });
    expect(linkDetail).toBe('Assigned to Deleted Pit member via Deleted Pit member');
    expect(`${activity} ${linkDetail}`).not.toMatch(/Ada|ada@example|@ada/);
  });

  it('rejects a second permanent deletion without changing related records', async () => {
    const tx = transactionMock(member({ deletedAt: new Date() }));
    tx.crewMember.updateMany.mockReset().mockResolvedValue({ count: 0 });

    await expect(permanentlyDeleteCrewMember(tx, 'crew-1')).rejects.toMatchObject({ _status: 409 });
    expect(tx.affiliatePayout.findMany).not.toHaveBeenCalled();
    expect(tx.acquisitionLink.update).not.toHaveBeenCalled();
  });

  it('ships a status-aware legacy cleanup and database privacy guards', () => {
    const sql = readFileSync(
      'prisma/migrations/20260717020500_anonymize_deleted_crew_members/migration.sql',
      'utf8',
    );
    expect(sql).toContain("payout.status IN ('pending', 'processing')");
    expect(sql).toContain("WHERE status NOT IN ('pending', 'processing')");
    expect(sql).toContain('"voidReason" = \'member_deleted\'');
    expect(sql).toContain('"leadForfeitReason" = \'lead_deleted\'');
    expect(sql).toContain("name = 'Deleted Pit member ' || id");
    expect(sql).toContain('"crew_members_deleted_identity_anonymized"');
    expect(sql).toContain('"affiliate_payout_terminal_bank_cleared"');
    expect(sql).toContain('"affiliate_payout_status_known"');
    expect(sql).toContain('AND "telegramLinkCode" IS NULL');
    expect(sql).toContain('AND "inviteToken" IS NULL');
    expect(sql).toContain('AND "resetToken" IS NULL');
  });
});
