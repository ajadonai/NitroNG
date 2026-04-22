import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

// POST — create a manual transfer request (returns bank details + creates pending tx)
export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const { amount, couponId } = await req.json();
    const amountNum = Number(amount);
    if (!amountNum || amountNum < 500) return Response.json({ error: 'Minimum deposit is ₦500' }, { status: 400 });

    // Check for existing pending manual transfer
    const existingPending = await prisma.transaction.findFirst({
      where: { userId: user.id, method: 'manual', status: 'Pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      // If older than 24 hours, auto-expire it
      const ageMs = Date.now() - new Date(existingPending.createdAt).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        await prisma.transaction.update({ where: { id: existingPending.id }, data: { status: 'Failed', note: existingPending.note + ' [expired]' } });
      } else {
        return Response.json({ error: 'You already have a pending bank transfer. Please complete or wait for it to expire before creating another.' }, { status: 400 });
      }
    }

    // Get bank details from admin config
    const setting = await prisma.setting.findUnique({ where: { key: 'gateway_manual' } });
    if (!setting) return Response.json({ error: 'Bank transfer not configured' }, { status: 503 });

    let config;
    try { config = JSON.parse(setting.value); } catch { return Response.json({ error: 'Bank transfer not configured' }, { status: 503 }); }

    if (!config.enabled) return Response.json({ error: 'Bank transfer is not available' }, { status: 503 });

    const { bankName, accountNumber, accountName } = config.fields || {};
    if (!bankName || !accountNumber || !accountName) return Response.json({ error: 'Bank details not configured. Contact admin.' }, { status: 503 });

    const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const amountKobo = Math.round(amountNum * 100);

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: amountKobo,
        method: 'manual',
        status: 'Pending',
        reference,
        note: `Manual bank transfer ₦${amountNum.toLocaleString()}${couponId ? ` [coupon:${couponId}]` : ''} [awaiting_confirmation]`,
      },
    });

    return Response.json({
      bankName, accountNumber, accountName,
      amount: amountNum,
      reference,
    });
  } catch (err) {
    log.error('Manual Payment Create', err.message);
    return Response.json({ error: 'Failed to create transfer request' }, { status: 500 });
  }
}

// PUT — user confirms they've sent the money
export async function PUT(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference, senderRef } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const tx = await prisma.transaction.findFirst({
      where: { reference, userId: session.id, method: 'manual', status: 'Pending' },
    });
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        note: tx.note.replace('[awaiting_confirmation]', `[user_confirmed${senderRef ? `:${senderRef}` : ''}]`),
      },
    });

    return Response.json({ success: true });
  } catch (err) {
    log.error('Manual Payment Confirm', err.message);
    return Response.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}
