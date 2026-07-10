import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/logger';
import {
  serializeTransaction,
  transactionHistoryCutoff,
  TRANSACTION_HISTORY_DAYS,
} from '@/lib/transaction-history';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(10, Number(url.searchParams.get('perPage')) || 25));
    const type = url.searchParams.get('type')?.trim();
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const cutoff = transactionHistoryCutoff();

    const createdAt = { gte: cutoff };
    if (start) {
      const parsed = new Date(start);
      if (!Number.isNaN(parsed.getTime()) && parsed > cutoff) createdAt.gte = parsed;
    }
    if (end) {
      const parsed = new Date(end);
      if (!Number.isNaN(parsed.getTime())) createdAt.lte = parsed;
    }

    const where = {
      userId: session.id,
      createdAt,
      ...(type && type !== 'all' ? { type } : {}),
    };

    const [transactions, total, typeGroups] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { userId: session.id, createdAt: { gte: cutoff } },
        orderBy: { type: 'asc' },
      }),
    ]);

    return Response.json({
      transactions: transactions.map(serializeTransaction),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      types: typeGroups.map(group => group.type),
      historyDays: TRANSACTION_HISTORY_DAYS,
    });
  } catch (err) {
    log.error('Transactions GET', err.message);
    return Response.json({ error: 'Failed to load transactions' }, { status: 500 });
  }
}
