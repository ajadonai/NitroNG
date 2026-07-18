import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ──
const mockPrisma = {
  crewMember: { updateMany: vi.fn(), findFirst: vi.fn() },
  crewSession: { deleteMany: vi.fn() },
  activityLog: { create: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const mockSendDM = vi.fn();
vi.mock('@/lib/crew-bot', () => ({ sendDM: (...a) => mockSendDM(...a) }));

const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({
  getCrewSession: (...a) => mockGetCrewSession(...a),
  hashToken: (t) => `hashed_${t}`,
}));

const mockBcrypt = { compare: vi.fn(), hash: vi.fn().mockResolvedValue('$hashed') };
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(() => ({ value: 'tok' })) }),
}));
vi.mock('@/lib/validate', () => ({ validatePassword: vi.fn(() => true) }));

const { PATCH } = await import('@/app/api/pit/settings/route');

function req(body) {
  return new Request('http://localhost/api/pit/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MEMBER = {
  id: 'm1', name: 'Tester', email: 'test@x.com', password: '$old',
  telegramUserId: '999', telegramHandle: 'tester',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCrewSession.mockResolvedValue({ ...MEMBER });
  mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.activityLog.create.mockResolvedValue({});
});

// ── Bank changes ──

describe('Bank detail changes', () => {
  it('requires current password', async () => {
    const res = await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test' }));
    const d = await res.json();
    expect(d.error).toMatch(/password.*required/i);
    expect(res.status).toBe(400);
    expect(mockPrisma.crewMember.updateMany).not.toHaveBeenCalled();
  });

  it('rejects wrong password', async () => {
    mockBcrypt.compare.mockResolvedValue(false);
    const res = await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test', currentPassword: 'wrong' }));
    const d = await res.json();
    expect(d.error).toMatch(/incorrect/i);
    expect(mockPrisma.crewMember.updateMany).not.toHaveBeenCalled();
  });

  it('saves with correct password and sends notification', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockResolvedValue(true);
    const res = await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test', currentPassword: 'correct' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(mockPrisma.crewMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1', status: 'approved', deletedAt: null },
      data: { bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test' },
    });
    expect(mockSendDM).toHaveBeenCalledWith('999', expect.stringContaining('bank details'));
  });

  it('cannot restore bank PII when deletion wins the final write fence', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(req({
      section: 'bank', bankName: 'GTB', bankAccountNo: '123',
      bankAccountName: 'Test', currentPassword: 'correct',
    }));

    expect(res.status).toBe(409);
    expect(mockSendDM).not.toHaveBeenCalled();
    expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
  });

  it('logs activity after bank change', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockResolvedValue(true);
    await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test', currentPassword: 'ok' }));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminName: 'Pit member m1', action: expect.stringContaining('bank'), type: 'pit-self',
      }),
    });
  });

  it('succeeds even when notification fails', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockRejectedValue(new Error('TG down'));
    const res = await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test', currentPassword: 'ok' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
  });

  it('succeeds even when activity log fails', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockResolvedValue(true);
    mockPrisma.activityLog.create.mockRejectedValue(new Error('DB log down'));
    const res = await PATCH(req({ section: 'bank', bankName: 'GTB', bankAccountNo: '123', bankAccountName: 'Test', currentPassword: 'ok' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
  });
});

// ── Password changes ──

describe('Password change notifications', () => {
  it('sends TG notification after password change', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockResolvedValue(true);
    const res = await PATCH(req({ section: 'password', current: 'old', newPassword: 'newpass1' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(mockSendDM).toHaveBeenCalledWith('999', expect.stringContaining('password'));
  });

  it('logs activity after password change', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockResolvedValue(true);
    await PATCH(req({ section: 'password', current: 'old', newPassword: 'newpass1' }));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminName: 'Pit member m1', action: expect.stringContaining('password'), type: 'pit-self',
      }),
    });
  });

  it('succeeds even when notification fails', async () => {
    mockBcrypt.compare.mockResolvedValue(true);
    mockSendDM.mockRejectedValue(new Error('TG down'));
    const res = await PATCH(req({ section: 'password', current: 'old', newPassword: 'newpass1' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
  });
});

// ── Telegram disconnect ──

describe('Telegram disconnect', () => {
  it('logs activity on disconnect', async () => {
    mockSendDM.mockResolvedValue(true);
    await PATCH(req({ section: 'telegram_disconnect' }));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminName: 'Pit member m1', action: expect.stringContaining('Telegram'), type: 'pit-self',
      }),
    });
  });

  it('succeeds even when DM fails', async () => {
    mockSendDM.mockRejectedValue(new Error('TG down'));
    const res = await PATCH(req({ section: 'telegram_disconnect' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
  });

  it('succeeds even when activity log fails', async () => {
    mockSendDM.mockResolvedValue(true);
    mockPrisma.activityLog.create.mockRejectedValue(new Error('DB log down'));
    const res = await PATCH(req({ section: 'telegram_disconnect' }));
    const d = await res.json();
    expect(d.ok).toBe(true);
  });
});
