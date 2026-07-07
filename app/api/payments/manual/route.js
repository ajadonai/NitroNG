import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { tgManualPending } from '@/lib/telegram';
import { parseFbCookies } from '@/lib/meta-capi';

// POST — create a manual transfer request (returns bank details + creates pending tx)
export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many transfer requests. Try again in a minute.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const { amount, couponId } = await req.json();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 500 || amountNum > 10000000) return Response.json({ error: 'Invalid amount' }, { status: 400 });

    // Check for existing pending manual transfer
    const existingPending = await prisma.transaction.findFirst({
      where: { userId: user.id, method: 'manual', status: 'Pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      // If older than 10 minutes, auto-expire it (cron also cleans these up)
      const ageMs = Date.now() - new Date(existingPending.createdAt).getTime();
      if (ageMs > 10 * 60 * 1000) {
        await prisma.transaction.update({ where: { id: existingPending.id }, data: { status: 'Failed', note: existingPending.note + ' [expired]' } });
      } else {
        return Response.json({ error: 'You have a pending bank transfer. Cancel it from your wallet history to start a new one.' }, { status: 400 });
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

    const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
    await prisma.user.update({ where: { id: user.id }, data: {
      lastIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
      lastUa: req.headers.get('user-agent') || undefined,
      lastFbp: fbp || undefined, lastFbc: fbc || undefined,
    }});

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

    const body = await req.json();
    const reference = body.reference;
    const senderRef = (body.senderRef || '').replace(/<[^>]*>/g, '').replace(/[^\w\s\-\/\.#]/g, '').trim().slice(0, 100);
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

    const u = await prisma.user.findUnique({ where: { id: session.id }, select: { name: true, email: true } });
    tgManualPending(tx.id, u?.name || 'Unknown', u?.email || '', tx.amount, senderRef);

    return Response.json({ success: true });
  } catch (err) {
    log.error('Manual Payment Confirm', err.message);
    return Response.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}

// DELETE — user cancels before sending money
export async function DELETE(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const tx = await prisma.transaction.findFirst({
      where: { reference, userId: session.id, method: 'manual', status: 'Pending' },
    });
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    await prisma.transaction.delete({ where: { id: tx.id } });

    return Response.json({ success: true });
  } catch (err) {
    log.error('Manual Payment Cancel', err.message);
    return Response.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
