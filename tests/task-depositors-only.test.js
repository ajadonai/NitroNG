import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const prisma = {
  task: { findUnique: vi.fn() },
  transaction: { findFirst: vi.fn() },
  taskSubmission: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  setting: { findUnique: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'A', email: 'a@b.c' }) }));
vi.mock('@/lib/telegram', () => ({ tgTaskSubmission: vi.fn().mockResolvedValue(undefined) }));

const { POST } = await import('@/app/api/tasks/route');
const submit = () => POST(new Request('http://localhost/api/tasks', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ taskId: 't1', proof: '@someone' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.taskSubmission.findFirst.mockResolvedValue(null);
  prisma.taskSubmission.aggregate.mockResolvedValue({ _sum: { creditedAmount: 0 } });
  prisma.taskSubmission.create.mockResolvedValue({ id: 's1' });
  prisma.setting.findUnique.mockResolvedValue({ value: '15000000' });
});

describe('a task limited to paying customers', () => {
  it('turns away an account that has never funded a wallet', async () => {
    // The switch was stored and read by nothing, so turning it off changed
    // nothing at all: anyone could still submit.
    prisma.task.findUnique.mockResolvedValue({ id: 't1', active: true, allowNonDepositors: false, frequency: 'one_time' });
    prisma.transaction.findFirst.mockResolvedValue(null);

    const res = await submit();
    expect(res.status).toBe(403);
    expect(prisma.taskSubmission.create).not.toHaveBeenCalled();
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1', type: 'deposit', status: 'Completed' }),
    }));
  });

  it('lets a customer who has deposited through', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', active: true, allowNonDepositors: false, frequency: 'one_time' });
    prisma.transaction.findFirst.mockResolvedValue({ id: 'dep1' });

    const res = await submit();
    expect(res.status).toBe(200);
    expect(prisma.taskSubmission.create).toHaveBeenCalled();
  });

  it('does not ask about deposits when the task is open to everyone', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 't1', active: true, allowNonDepositors: true, frequency: 'one_time' });

    const res = await submit();
    expect(res.status).toBe(200);
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
  });

  it('says so on the card instead of only failing at submit', () => {
    expect(read('app/api/tasks/route.js')).toContain("userStatus = 'depositors_only'");
    expect(read('components/tasks-page.jsx')).toContain("task.userStatus === 'depositors_only'");
  });
});

describe('admin task actions', () => {
  it('only moves the switch once the server agrees, and speaks up when it refuses', () => {
    const src = read('components/admin-tasks.jsx');
    const toggle = src.slice(src.indexOf('const toggleTask'), src.indexOf('// ── Submission review'));
    expect(toggle).toMatch(/if \(!res\.ok \|\| !d\.ok\)[\s\S]{0,220}toast\?\.error/);
    // The optimistic write must come after the check, never before it.
    expect(toggle.indexOf('toast?.error')).toBeLessThan(toggle.indexOf('setTasks(prev'));
    expect(toggle).not.toContain('/* ignore */');
  });

  it('records who did what — logActivity takes a name, not the admin object', () => {
    for (const f of ['app/api/admin/tasks/route.js', 'app/api/admin/earn/route.js']) {
      expect(read(f)).not.toMatch(/logActivity\(admin,/);
    }
  });
});
