import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('tasks');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get('tab') || 'tasks';

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [tasks, pendingCount, approvedMonth, creditMonth] = await Promise.all([
      prisma.task.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { submissions: true } } },
      }),
      prisma.taskSubmission.count({ where: { status: 'pending' } }),
      prisma.taskSubmission.count({ where: { status: 'approved', reviewedAt: { gte: monthStart } } }),
      prisma.taskSubmission.aggregate({ where: { status: 'approved', reviewedAt: { gte: monthStart } }, _sum: { creditedAmount: true } }),
    ]);

    const taskDoneCounts = await prisma.taskSubmission.groupBy({
      by: ['taskId'],
      where: { status: 'approved' },
      _count: true,
    });
    const doneMap = Object.fromEntries(taskDoneCounts.map(r => [r.taskId, r._count]));

    const budgetRow = await prisma.setting.findUnique({ where: { key: 'task_monthly_budget' } });
    const budget = budgetRow ? parseInt(budgetRow.value, 10) : 15000000;

    const result = {
      tasks: tasks.map(t => ({ ...t, doneCount: doneMap[t.id] || 0 })),
      stats: {
        pending: pendingCount,
        approvedMonth,
        creditMonth: creditMonth._sum.creditedAmount || 0,
        budget,
        activeTasks: tasks.filter(t => t.active).length,
      },
    };

    if (tab === 'subs') {
      const status = url.searchParams.get('status') || 'all';
      const platform = url.searchParams.get('platform') || 'all';
      const q = url.searchParams.get('q') || '';
      const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
      const per = Math.min(50, Math.max(10, parseInt(url.searchParams.get('per')) || 10));
      const sort = url.searchParams.get('sort') || 'date';
      const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

      const where = {};
      if (status !== 'all') where.status = status;
      if (platform !== 'all') where.task = { platform };
      if (q) where.user = { name: { contains: q, mode: 'insensitive' } };

      const [subs, total, countByStatus] = await Promise.all([
        prisma.taskSubmission.findMany({
          where,
          include: {
            task: { select: { platform: true, title: true, reward: true, minViews: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: sort === 'reward' ? { task: { reward: dir } } : sort === 'views' ? { views: dir } : { createdAt: dir },
          skip: (page - 1) * per,
          take: per,
        }),
        prisma.taskSubmission.count({ where }),
        prisma.taskSubmission.groupBy({ by: ['status'], _count: true }),
      ]);

      const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
      countByStatus.forEach(r => { counts[r.status] = r._count; counts.all += r._count; });

      result.submissions = { rows: subs, total, page, per, counts };
    }

    return Response.json(result);
  } catch (err) {
    log.error('Admin Tasks GET', err.message);
    return Response.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('tasks', true);
  if (error) return error;

  try {
    const { action, ...params } = await req.json();

    if (action === 'create_task') {
      const task = await prisma.task.create({
        data: {
          platform: params.platform,
          title: params.title,
          instructions: params.instructions || '',
          category: params.category,
          proofType: params.proofType,
          reward: parseInt(params.reward) || 0,
          frequency: params.frequency || 'one_time',
          maxPerMonth: parseInt(params.maxPerMonth) || 0,
          minViews: parseInt(params.minViews) || 0,
          minFollowers: parseInt(params.minFollowers) || 0,
          keepDays: parseInt(params.keepDays) || 0,
          monthlyCap: parseInt(params.monthlyCap) || 0,
          viralBonus: !!params.viralBonus,
          viralThreshold: parseInt(params.viralThreshold) || 0,
          viralAmount: parseInt(params.viralAmount) || 0,
          allowNonDepositors: params.allowNonDepositors !== false,
          active: params.active !== false,
        },
      });
      await logActivity(admin, `Created task: ${task.title}`, 'tasks');
      return Response.json({ ok: true, task });
    }

    if (action === 'update_task') {
      const { id, ...data } = params;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updates = {};
      for (const key of ['platform', 'title', 'instructions', 'category', 'proofType', 'frequency']) {
        if (data[key] !== undefined) updates[key] = data[key];
      }
      for (const key of ['reward', 'maxPerMonth', 'minViews', 'minFollowers', 'keepDays', 'monthlyCap', 'viralThreshold', 'viralAmount', 'sortOrder']) {
        if (data[key] !== undefined) updates[key] = parseInt(data[key]) || 0;
      }
      for (const key of ['viralBonus', 'allowNonDepositors', 'active']) {
        if (data[key] !== undefined) updates[key] = !!data[key];
      }
      const task = await prisma.task.update({ where: { id }, data: updates });
      await logActivity(admin, `Updated task: ${task.title}`, 'tasks');
      return Response.json({ ok: true, task });
    }

    if (action === 'delete_task') {
      const { id } = params;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const subCount = await prisma.taskSubmission.count({ where: { taskId: id } });
      if (subCount > 0) {
        await prisma.task.update({ where: { id }, data: { active: false } });
        await logActivity(admin, `Deactivated task (has ${subCount} submissions)`, 'tasks');
        return Response.json({ ok: true, deactivated: true });
      }
      await prisma.task.delete({ where: { id } });
      await logActivity(admin, 'Deleted task', 'tasks');
      return Response.json({ ok: true });
    }

    if (action === 'toggle_task') {
      const { id, active } = params;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      await prisma.task.update({ where: { id }, data: { active: !!active } });
      return Response.json({ ok: true });
    }

    if (action === 'approve') {
      const { id } = params;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const sub = await prisma.taskSubmission.findUnique({ where: { id }, include: { task: true } });
      if (!sub) return Response.json({ error: 'Submission not found' }, { status: 404 });
      if (sub.status !== 'pending') return Response.json({ error: 'Already reviewed' }, { status: 400 });

      const amount = sub.task.reward;
      const expiryRow = await prisma.setting.findUnique({ where: { key: 'task_credit_expiry_days' } });
      const expiryDays = expiryRow ? parseInt(expiryRow.value, 10) || 14 : 14;
      const expiresAt = new Date(Date.now() + expiryDays * 86400000);

      const ops = [
        prisma.taskSubmission.update({
          where: { id },
          data: { status: 'approved', creditedAmount: amount, reviewedAt: new Date(), reviewedBy: admin.name || admin.email },
        }),
        prisma.user.update({ where: { id: sub.userId }, data: { balance: { increment: amount } } }),
        prisma.bonusCredit.create({
          data: { userId: sub.userId, source: 'task', amountGranted: amount, amountRemaining: amount, expiresAt },
        }),
        prisma.transaction.create({
          data: { userId: sub.userId, type: 'bonus', amount, status: 'Completed', note: `Task reward: ₦${(amount / 100).toLocaleString()}` },
        }),
      ];
      await prisma.$transaction(ops);
      return Response.json({ ok: true });
    }

    if (action === 'reject') {
      const { id, reason } = params;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const sub = await prisma.taskSubmission.findUnique({ where: { id } });
      if (!sub) return Response.json({ error: 'Submission not found' }, { status: 404 });
      if (sub.status !== 'pending') return Response.json({ error: 'Already reviewed' }, { status: 400 });
      await prisma.taskSubmission.update({
        where: { id },
        data: { status: 'rejected', rejectionReason: reason || null, reviewedAt: new Date(), reviewedBy: admin.name || admin.email },
      });
      return Response.json({ ok: true });
    }

    if (action === 'bulk_approve') {
      const { ids } = params;
      if (!ids?.length) return Response.json({ error: 'ids required' }, { status: 400 });
      const subs = await prisma.taskSubmission.findMany({ where: { id: { in: ids }, status: 'pending' }, include: { task: true } });
      if (!subs.length) return Response.json({ error: 'No pending submissions found' }, { status: 400 });

      const expiryRow = await prisma.setting.findUnique({ where: { key: 'task_credit_expiry_days' } });
      const expiryDays = expiryRow ? parseInt(expiryRow.value, 10) || 14 : 14;
      const expiresAt = new Date(Date.now() + expiryDays * 86400000);

      const ops = [];
      for (const sub of subs) {
        const amount = sub.task.reward;
        ops.push(
          prisma.taskSubmission.update({ where: { id: sub.id }, data: { status: 'approved', creditedAmount: amount, reviewedAt: new Date(), reviewedBy: admin.name || admin.email } }),
          prisma.user.update({ where: { id: sub.userId }, data: { balance: { increment: amount } } }),
          prisma.bonusCredit.create({ data: { userId: sub.userId, source: 'task', amountGranted: amount, amountRemaining: amount, expiresAt } }),
          prisma.transaction.create({ data: { userId: sub.userId, type: 'bonus', amount, status: 'Completed', note: `Task reward: ₦${(amount / 100).toLocaleString()}` } }),
        );
      }
      await prisma.$transaction(ops);
      await logActivity(admin, `Bulk approved ${subs.length} task submissions`, 'tasks');
      return Response.json({ ok: true, count: subs.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Tasks POST', err.message);
    return Response.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
