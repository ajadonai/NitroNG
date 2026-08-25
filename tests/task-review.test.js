import { describe, expect, it, vi, beforeEach } from 'vitest';

const db = {
  taskSubmission: { findUnique: vi.fn(), update: vi.fn() },
  setting: { findUnique: vi.fn() },
  user: { update: vi.fn() },
  bonusCredit: { create: vi.fn() },
  transaction: { create: vi.fn() },
  $transaction: vi.fn().mockResolvedValue([]),
};
vi.mock('@/lib/prisma', () => ({ default: db }));

const { approveSubmission, rejectSubmission } = await import('@/lib/task-review');

const pending = {
  id: 's1', userId: 'u1', status: 'pending',
  task: { reward: 50000, title: 'Follow on X' },
  user: { name: 'Chidi', email: 'c@x.com' },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockResolvedValue([]);
  db.setting.findUnique.mockResolvedValue({ value: '14' });
});

describe('approveSubmission', () => {
  it('pays the reward and reports it back for the Telegram reply', async () => {
    db.taskSubmission.findUnique.mockResolvedValue(pending);
    const res = await approveSubmission('s1', 'Soludo');
    expect(res).toMatchObject({ ok: true, amount: 50000, userName: 'Chidi', taskTitle: 'Follow on X' });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  // Two admins tapping the same card is expected, not an error condition.
  it('reports an already-reviewed submission instead of paying twice', async () => {
    db.taskSubmission.findUnique.mockResolvedValue({ ...pending, status: 'approved', reviewedBy: 'Soludo' });
    const res = await approveSubmission('s1', 'Nitro');
    expect(res).toMatchObject({ ok: false, alreadyReviewed: true, status: 'approved', reviewedBy: 'Soludo' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('does not pay for a submission that no longer exists', async () => {
    db.taskSubmission.findUnique.mockResolvedValue(null);
    expect(await approveSubmission('gone', 'Nitro')).toMatchObject({ ok: false, error: 'Submission not found' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('falls back to the default expiry when the setting is missing', async () => {
    db.taskSubmission.findUnique.mockResolvedValue(pending);
    db.setting.findUnique.mockResolvedValue(null);
    expect((await approveSubmission('s1', 'Nitro')).ok).toBe(true);
  });
});

describe('rejectSubmission', () => {
  it('marks it rejected without touching the wallet', async () => {
    db.taskSubmission.findUnique.mockResolvedValue(pending);
    expect((await rejectSubmission('s1', 'Soludo')).ok).toBe(true);
    expect(db.taskSubmission.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'rejected', reviewedBy: 'Soludo' }),
    }));
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('refuses to re-reject', async () => {
    db.taskSubmission.findUnique.mockResolvedValue({ ...pending, status: 'rejected', reviewedBy: 'Nitro' });
    expect(await rejectSubmission('s1', 'Soludo')).toMatchObject({ ok: false, alreadyReviewed: true });
    expect(db.taskSubmission.update).not.toHaveBeenCalled();
  });
});
