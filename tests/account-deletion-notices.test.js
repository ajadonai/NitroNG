import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isAccountDeletionGraceActive } from '@/lib/account-deletion';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  clearUserCookie: vi.fn(),
  rateLimit: vi.fn(),
  compare: vi.fn(),
  sendEmail: vi.fn(),
  telegramDeletion: vi.fn(),
  userFindUnique: vi.fn(),
  outerOrderFindMany: vi.fn(),
  orderCount: vi.fn(),
  transactionAggregate: vi.fn(),
  txOrderFindMany: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txTransactionCreate: vi.fn(),
  txUserUpdate: vi.fn(),
  txSessionDeleteMany: vi.fn(),
  txDripDispatchUpdateMany: vi.fn(),
  txQueryRaw: vi.fn(),
  logError: vi.fn(),
}));

const tx = {
  $queryRaw: (...args) => mocks.txQueryRaw(...args),
  order: {
    findMany: (...args) => mocks.txOrderFindMany(...args),
    updateMany: (...args) => mocks.txOrderUpdateMany(...args),
  },
  transaction: { create: (...args) => mocks.txTransactionCreate(...args) },
  user: { update: (...args) => mocks.txUserUpdate(...args) },
  session: { deleteMany: (...args) => mocks.txSessionDeleteMany(...args) },
  dripDispatch: { updateMany: (...args) => mocks.txDripDispatchUpdateMany(...args) },
};

const mockPrisma = {
  user: { findUnique: (...args) => mocks.userFindUnique(...args) },
  order: {
    findMany: (...args) => mocks.outerOrderFindMany(...args),
    count: (...args) => mocks.orderCount(...args),
  },
  transaction: { aggregate: (...args) => mocks.transactionAggregate(...args) },
  $transaction: vi.fn(async work => work(tx)),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args) => mocks.getCurrentUser(...args),
  clearUserCookie: (...args) => mocks.clearUserCookie(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: () => Response.json({ error: 'Unavailable' }, { status: 503 }),
  tooManyRequests: () => Response.json({ error: 'Limited' }, { status: 429 }),
}));
vi.mock('bcryptjs', () => ({ default: { compare: (...args) => mocks.compare(...args) } }));
vi.mock('@/lib/email', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: (...args) => mocks.sendEmail(...args) };
});
vi.mock('@/lib/telegram', () => ({
  tgUserDeletionRequested: (...args) => mocks.telegramDeletion(...args),
}));
vi.mock('@/lib/smm', () => ({ cancelOrder: vi.fn(), isProviderConfigured: vi.fn(() => false) }));
vi.mock('@/lib/nitro-rewards', () => ({
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: vi.fn(() => ({ walletRefund: 0 })),
}));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: (...args) => mocks.logError(...args) },
}));

const { POST } = await import('@/app/api/auth/delete-account/route.js');
const { accountDeletionEmail } = await import('@/lib/email');

const customer = {
  id: 'user-internal-123',
  name: 'Privacy Canary',
  firstName: 'Privacy',
  email: 'privacy-canary@example.test',
  referralCode: 'REFERRAL-CANARY',
  password: 'hashed-password',
  status: 'Active',
  balance: 125000,
  createdAt: new Date('2025-01-02T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: customer.id });
  mocks.rateLimit.mockResolvedValue({ unavailable: false, limited: false, retryAfter: 60 });
  mocks.compare.mockResolvedValue(true);
  mocks.userFindUnique.mockResolvedValue(customer);
  mocks.outerOrderFindMany.mockResolvedValue([]);
  mocks.txOrderFindMany.mockResolvedValue([]);
  mocks.txQueryRaw.mockResolvedValue([{ id: customer.id, status: 'Active' }]);
  mocks.txUserUpdate.mockResolvedValue({});
  mocks.txSessionDeleteMany.mockResolvedValue({ count: 1 });
  mocks.orderCount.mockResolvedValueOnce(7).mockResolvedValueOnce(0);
  mocks.transactionAggregate.mockResolvedValue({ _sum: { amount: 987600 } });
  mocks.sendEmail.mockResolvedValue({ success: true });
});

describe('account-deletion notices', () => {
  it('keeps PII and referral codes out of the admin email and Telegram notice', async () => {
    const response = await POST(new Request('https://nitro.test/api/auth/delete-account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'correct password' }),
    }));

    expect(response.status, JSON.stringify(mocks.logError.mock.calls)).toBe(200);
    const adminCall = mocks.sendEmail.mock.calls.find(([to]) => to === 'accounts@nitro.ng');
    expect(adminCall).toBeDefined();
    const adminNotice = adminCall.join('\n');
    for (const personalValue of [customer.name, customer.firstName, customer.email, customer.referralCode]) {
      expect(adminNotice).not.toContain(personalValue);
    }
    expect(adminNotice).toContain(customer.id);
    expect(adminNotice).toContain('required financial records remain linked only to the internal user ID');
    expect(adminNotice).toContain('customer contact details are removed');
    expect(adminNotice).toContain('After that deadline, the account cannot be restored');

    expect(mocks.telegramDeletion).toHaveBeenCalledWith(customer.id, 7, 987600);
    const telegramArgs = JSON.stringify(mocks.telegramDeletion.mock.calls[0]);
    for (const personalValue of [customer.name, customer.email, customer.referralCode]) {
      expect(telegramArgs).not.toContain(personalValue);
    }
  });

  it('describes retained financial records without claiming all history is erased', () => {
    const html = accountDeletionEmail('Customer', 30);
    expect(html).toContain('cannot be undone after 30 days');
    expect(html).toContain('Financial records we must retain');
    expect(html).toContain('stripped of your contact details');
    expect(html).toContain('before the 30-day deadline');
    expect(html).not.toContain('Everything goes with it');

    const settings = readFileSync('components/settings-page.jsx', 'utf8');
    expect(settings).toContain('Financial records required for legal and accounting purposes are retained without your contact details.');
    expect(settings).toContain('After 30 days, your personal details will be permanently removed and the account cannot be restored.');
  });

  it('passes only non-contact identifiers and aggregates into the Telegram helper', () => {
    const source = readFileSync('lib/telegram.js', 'utf8');
    const body = source.match(/export function tgUserDeletionRequested[\s\S]*?\n}\n/)?.[0] || '';
    expect(body).toContain('userId');
    expect(body).toContain("line('User ID', id(userId))");
    expect(body).not.toMatch(/\bname\b/i);
    expect(body).not.toMatch(/\bemail\b/i);
    expect(body).not.toMatch(/referral/i);
  });
});

describe('deletion-grace entrypoints', () => {
  const now = new Date('2026-07-17T12:00:00.000Z');

  it('closes restoration at the exact deadline', () => {
    expect(isAccountDeletionGraceActive({ status: 'PendingDeletion', deletedAt: new Date(now.getTime() + 1) }, now)).toBe(true);
    expect(isAccountDeletionGraceActive({ status: 'PendingDeletion', deletedAt: now }, now)).toBe(false);
    expect(isAccountDeletionGraceActive({ status: 'PendingDeletion', deletedAt: new Date(now.getTime() - 1) }, now)).toBe(false);
    expect(isAccountDeletionGraceActive({ status: 'Deleted', deletedAt: new Date(now.getTime() + 1) }, now)).toBe(false);
  });

  it('uses the deadline-aware guard in login, signup, and Google entrypoints', () => {
    const login = readFileSync('app/api/auth/login/route.js', 'utf8');
    const signup = readFileSync('app/api/auth/signup/route.js', 'utf8');
    const google = readFileSync('app/api/auth/google/callback/route.js', 'utf8');
    const landing = readFileSync('components/landing-page.jsx', 'utf8');

    for (const source of [login, signup, google]) {
      expect(source).toContain('isAccountDeletionGraceActive');
    }
    expect(login).toContain('deletion deadline has passed and it cannot be restored');
    expect(signup).toContain('deletion deadline has passed and it cannot be restored');
    expect(google).toMatch(/isAccountDeletionGraceActive\(user\).*account_pending_deletion.*google_account_deleted/);
    expect(landing).toContain('Contact support@nitro.ng before the deletion deadline to cancel.');
  });
});
