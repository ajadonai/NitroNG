import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── env setup ──
process.env.CRON_SECRET = 'test-secret';

// ── Prisma mock ──
const mockPrisma = {
  crewMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  crewSession: { create: vi.fn(), deleteMany: vi.fn() },
  activityLog: { create: vi.fn().mockResolvedValue({}) },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

// ── crew-bot mock ──
const mockSendDM = vi.fn().mockResolvedValue(true);
const mockCrewWelcome = vi.fn();
const mockCrewDmChiefNewLink = vi.fn();
vi.mock('@/lib/crew-bot', () => ({
  sendDM: (...a) => mockSendDM(...a),
  crewWelcome: (...a) => mockCrewWelcome(...a),
  crewDmChiefNewLink: (...a) => mockCrewDmChiefNewLink(...a),
  replyInGroup: vi.fn(),
  kickFromGroup: vi.fn(),
}));

// ── commissions mock ──
vi.mock('@/lib/commissions', () => ({
  getMemberEarnings: vi.fn(),
  getMemberHeld: vi.fn(),
}));

// ── crew session mock ──
const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({
  getCrewSession: (...a) => mockGetCrewSession(...a),
  hashToken: (t) => `hashed_${t}`,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn() }),
}));
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));
vi.mock('@/lib/validate', () => ({ validatePassword: vi.fn(() => true) }));

const { PATCH: settingsPATCH } = await import('@/app/api/pit/settings/route');
const { POST: webhookPOST } = await import('@/app/api/telegram/crew-webhook/route');

function makeSettingsReq(body) {
  return new Request('http://localhost/api/pit/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeWebhookReq(update) {
  return new Request('http://localhost/api/telegram/crew-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': 'test-secret',
    },
    body: JSON.stringify(update),
  });
}

function makeTgUpdate(code, userId = '12345', username = 'testuser') {
  return {
    message: {
      message_id: 1,
      from: { id: Number(userId), username },
      chat: { id: Number(userId), type: 'private' },
      text: `/start ${code}`,
      date: Math.floor(Date.now() / 1000),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Code generation ──

describe('Telegram code generation (settings)', () => {
  it('uses crypto-secure random, not Math.random', async () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');
    mockGetCrewSession.mockResolvedValue({ id: 'mem1', name: 'Test' });
    mockPrisma.crewMember.findFirst.mockResolvedValue(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await settingsPATCH(makeSettingsReq({ section: 'telegram' }));
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.code).toHaveLength(6);
    expect(mathRandomSpy).not.toHaveBeenCalled();
    mathRandomSpy.mockRestore();
  });

  it('sets 10-minute expiry on generated code', async () => {
    mockGetCrewSession.mockResolvedValue({ id: 'mem1', name: 'Test' });
    mockPrisma.crewMember.findFirst.mockResolvedValue(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    await settingsPATCH(makeSettingsReq({ section: 'telegram' }));

    const updateCall = mockPrisma.crewMember.updateMany.mock.calls[0][0];
    expect(updateCall.data.telegramLinkCodeExpiresAt).toBeInstanceOf(Date);
    const diffMs = updateCall.data.telegramLinkCodeExpiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(9 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('retries on code collision', async () => {
    mockGetCrewSession.mockResolvedValue({ id: 'mem1', name: 'Test' });
    mockPrisma.crewMember.findFirst
      .mockResolvedValueOnce({ id: 'other' })
      .mockResolvedValueOnce(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await settingsPATCH(makeSettingsReq({ section: 'telegram' }));
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(mockPrisma.crewMember.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ── Webhook /start linking ──

describe('Telegram webhook /start linking', () => {
  it('rejects expired code', async () => {
    const expired = new Date(Date.now() - 60 * 1000);
    mockPrisma.crewMember.findFirst.mockResolvedValueOnce({
      id: 'mem1', name: 'Test', status: 'approved',
      telegramLinkCode: 'ABC123',
      telegramLinkCodeExpiresAt: expired,
      lead: null,
    });
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('ABC123')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('expired'),
    );
    expect(mockPrisma.crewMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'mem1', telegramLinkCode: 'ABC123', status: 'approved', deletedAt: null },
      data: { telegramLinkCode: null, telegramLinkCodeExpiresAt: null },
    });
  });

  it('rejects code with null expiry (pre-migration legacy code)', async () => {
    mockPrisma.crewMember.findFirst.mockResolvedValueOnce({
      id: 'mem1', name: 'Test', status: 'approved',
      telegramLinkCode: 'OLD123',
      telegramLinkCodeExpiresAt: null,
      lead: null,
    });
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('OLD123')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('expired'),
    );
    expect(mockPrisma.crewMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'mem1', telegramLinkCode: 'OLD123', status: 'approved', deletedAt: null },
      data: { telegramLinkCode: null, telegramLinkCodeExpiresAt: null },
    });
  });

  it('rejects when Telegram ID is already linked to another member', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    mockPrisma.crewMember.findFirst
      .mockResolvedValueOnce({
        id: 'mem1', name: 'Test', status: 'approved',
        telegramLinkCode: 'ABC123',
        telegramLinkCodeExpiresAt: future,
        lead: null,
      })
      .mockResolvedValueOnce({ id: 'mem2' });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('ABC123', '12345')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('already linked'),
    );
    expect(mockPrisma.crewMember.updateMany).not.toHaveBeenCalled();
  });

  it('uses conditional updateMany for the final link (TOCTOU safe)', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    mockPrisma.crewMember.findFirst
      .mockResolvedValueOnce({
        id: 'mem1', name: 'Test', status: 'approved',
        telegramLinkCode: 'XYZ789',
        telegramLinkCodeExpiresAt: future,
        lead: null,
      })
      .mockResolvedValueOnce(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('XYZ789', '99999', 'gooduser')));
    expect(res.status).toBe(200);

    const call = mockPrisma.crewMember.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      id: 'mem1',
      telegramLinkCode: 'XYZ789',
      status: 'approved',
      deletedAt: null,
    });
    expect(call.data).toEqual({
      telegramUserId: '99999',
      telegramHandle: 'gooduser',
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
    });
  });

  it('rejects if conditional updateMany finds 0 rows (code consumed by race)', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    mockPrisma.crewMember.findFirst
      .mockResolvedValueOnce({
        id: 'mem1', name: 'Test', status: 'approved',
        telegramLinkCode: 'RACE1',
        telegramLinkCodeExpiresAt: future,
        lead: null,
      })
      .mockResolvedValueOnce(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 0 });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('RACE1', '55555', 'racer')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('no longer valid'),
    );
  });

  it('findFirst includes deletedAt: null to exclude soft-deleted members', async () => {
    mockPrisma.crewMember.findFirst.mockResolvedValueOnce(null);

    await webhookPOST(makeWebhookReq(makeTgUpdate('DEL123')));

    const call = mockPrisma.crewMember.findFirst.mock.calls[0][0];
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.status).toBe('approved');
  });

  it('rejects invalid code (no matching member)', async () => {
    mockPrisma.crewMember.findFirst.mockResolvedValueOnce(null);

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('BADCODE')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('Invalid or expired'),
    );
  });

  it('allows valid code within expiry window and notifies chief', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    mockPrisma.crewMember.findFirst
      .mockResolvedValueOnce({
        id: 'mem1', name: 'Test', status: 'approved',
        telegramLinkCode: 'VALID1',
        telegramLinkCodeExpiresAt: future,
        lead: { name: 'Boss', telegramUserId: '111' },
      })
      .mockResolvedValueOnce(null);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await webhookPOST(makeWebhookReq(makeTgUpdate('VALID1', '55555', 'linker')));
    expect(res.status).toBe(200);

    expect(mockSendDM).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('Linked as'),
    );
    expect(mockCrewWelcome).toHaveBeenCalledWith('Test', 'Boss');
    expect(mockCrewDmChiefNewLink).toHaveBeenCalledWith('111', 'Test');
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: {
        adminName: 'Pit member mem1',
        action: 'Pit member linked Telegram',
        type: 'pit-self',
      },
    });
  });
});
