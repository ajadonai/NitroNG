import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { tgTaskSubmission } from '@/lib/telegram';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error('Unauthorized', 401);

  const [tasks, submissions, budgetRow, creditMonth] = await Promise.all([
    prisma.task.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.taskSubmission.findMany({
      where: { userId: user.id },
      select: { taskId: true, status: true, createdAt: true, creditedAmount: true, rejectionReason: true },
    }),
    prisma.setting.findUnique({ where: { key: 'task_monthly_budget' } }),
    prisma.taskSubmission.aggregate({
      where: {
        status: 'approved',
        reviewedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { creditedAmount: true },
    }),
  ]);

  const budget = budgetRow ? parseInt(budgetRow.value, 10) : 15000000;
  const spent = creditMonth._sum.creditedAmount || 0;
  const poolExhausted = spent >= budget;

  const subMap = {};
  for (const s of submissions) {
    if (!subMap[s.taskId] || s.createdAt > subMap[s.taskId].createdAt) {
      subMap[s.taskId] = s;
    }
  }

  const userEarned = submissions
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + (s.creditedAmount || 0), 0);
  const userPending = submissions.filter(s => s.status === 'pending').length;

  const expiryRow = await prisma.setting.findUnique({ where: { key: 'task_credit_expiry_days' } });
  const expiryDays = expiryRow ? parseInt(expiryRow.value, 10) || 30 : 30;

  const expiring = await prisma.bonusCredit.aggregate({
    where: {
      userId: user.id,
      source: 'task',
      amountRemaining: { gt: 0 },
      expiresAt: { lte: new Date(Date.now() + 7 * 86400000) },
    },
    _sum: { amountRemaining: true },
  });

  const mapped = tasks.map(t => {
    const sub = subMap[t.id];
    let userStatus = 'open';
    if (sub) {
      if (sub.status === 'approved') userStatus = 'done';
      else if (sub.status === 'rejected') userStatus = 'rejected';
      else if (sub.status === 'pending') userStatus = 'pending';
    }
    if (userStatus === 'open' && poolExhausted) userStatus = 'exhausted';

    return {
      id: t.id,
      platform: t.platform,
      title: t.title,
      instructions: t.instructions,
      category: t.category,
      proofType: t.proofType,
      reward: t.reward,
      frequency: t.frequency,
      userStatus,
      rejectionReason: sub?.rejectionReason || null,
    };
  });

  return ok({
    tasks: mapped,
    stats: {
      earned: userEarned,
      pending: userPending,
      expiringSoon: expiring._sum.amountRemaining || 0,
      expiryDays,
    },
  });
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return error('Unauthorized', 401);

  const { taskId, proof } = await req.json();
  if (!taskId || !proof?.trim()) return error('Task ID and proof are required');

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.active) return error('Task not found or inactive', 404);

  const normalizedProof = proof.trim().toLowerCase().replace(/^@/, '');

  if (task.frequency === 'one_time') {
    const existing = await prisma.taskSubmission.findFirst({
      where: { taskId, userId: user.id, status: { in: ['pending', 'approved'] } },
    });
    if (existing) return error('You have already submitted this task');
  }

  const duplicateProof = await prisma.taskSubmission.findFirst({
    where: {
      taskId,
      userId: { not: user.id },
      proof: { equals: normalizedProof, mode: 'insensitive' },
      status: { in: ['pending', 'approved'] },
    },
  });
  if (duplicateProof) return error('This handle or proof has already been submitted by another account');

  const budgetRow = await prisma.setting.findUnique({ where: { key: 'task_monthly_budget' } });
  const budget = budgetRow ? parseInt(budgetRow.value, 10) : 15000000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const creditMonth = await prisma.taskSubmission.aggregate({
    where: { status: 'approved', reviewedAt: { gte: monthStart } },
    _sum: { creditedAmount: true },
  });
  if ((creditMonth._sum.creditedAmount || 0) >= budget) {
    return error('Task rewards pool is currently exhausted. Check back next month.');
  }

  const submission = await prisma.taskSubmission.create({
    data: {
      id: crypto.randomBytes(12).toString('base64url'),
      taskId,
      userId: user.id,
      proof: normalizedProof,
    },
  });

  tgTaskSubmission(user.name, user.email, task.title, normalizedProof, task.platform, submission.id, task.reward).catch(() => {});

  return ok({ ok: true, submissionId: submission.id });
}
