import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  crewMember: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  crewSession: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
};
const mockSendPasswordResetEmail = vi.fn();

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ limited: false, unavailable: false }),
  rateLimitUnavailable: vi.fn(),
  tooManyRequests: vi.fn(),
}));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('$new-hash') } }));

const { POST: forgotPassword } = await import('@/app/api/pit/auth/forgot-password/route');
const { POST: resetPassword } = await import('@/app/api/pit/auth/reset-password/route');

function request(body) {
  return new Request('http://localhost/api/pit/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(work => work(mockPrisma));
  mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.crewSession.deleteMany.mockResolvedValue({ count: 1 });
});

describe('Pit forgot-password deletion fence', () => {
  it('does not issue or send a token when deletion wins the final write', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew-1', name: 'Old Name', email: 'old@example.test',
      status: 'approved', deletedAt: null,
    });
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 0 });

    const response = await forgotPassword(request({ email: 'old@example.test' }));

    expect(response.status).toBe(200);
    expect(mockPrisma.crewMember.updateMany.mock.calls[0][0].where).toEqual({
      id: 'crew-1', status: 'approved', deletedAt: null,
    });
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('Pit reset-password deletion fence', () => {
  it('requires active eligibility during token lookup and the final password write', async () => {
    mockPrisma.crewMember.findFirst.mockResolvedValue({ id: 'crew-1' });

    const response = await resetPassword(request({ token: 'valid-token', password: 'newpass1' }));

    expect(response.status).toBe(200);
    expect(mockPrisma.crewMember.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({
      status: 'approved', deletedAt: null,
    }));
    expect(mockPrisma.crewMember.updateMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: 'crew-1', status: 'approved', deletedAt: null,
    }));
    expect(mockPrisma.crewSession.deleteMany).toHaveBeenCalledWith({ where: { memberId: 'crew-1' } });
  });

  it('does not restore a password or touch sessions when deletion wins the final CAS', async () => {
    mockPrisma.crewMember.findFirst.mockResolvedValue({ id: 'crew-1' });
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 0 });

    const response = await resetPassword(request({ token: 'valid-token', password: 'newpass1' }));

    expect(response.status).toBe(401);
    expect(mockPrisma.crewSession.deleteMany).not.toHaveBeenCalled();
  });
});
