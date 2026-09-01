import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { cashReferralSettings, summarizeEarnings } from '@/lib/referral-cash';
import { log } from '@/lib/logger';

// The cash referral programme's own surface. While cash_referrals_enabled is
// off, GET answers { enabled: false } and nothing else — the classic referrals
// page stays up and this one stays invisible.

const firstName = (name, email) => (name || '').trim().split(/\s+/)[0] || (email || '').split('@')[0] || 'Friend';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const settings = await cashReferralSettings(prisma);
  if (!settings.enabled) return Response.json({ enabled: false });

  const me = await prisma.user.findUnique({ where: { id: session.id }, select: { referralCode: true } });
  const [earnings, payouts] = await Promise.all([
    prisma.referralEarning.findMany({ where: { referrerId: session.id }, orderBy: { createdAt: 'desc' } }),
    prisma.referralPayout.findMany({ where: { userId: session.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const earnedIds = earnings.map(e => e.referredId);
  const [friends, waiting] = await Promise.all([
    earnedIds.length ? prisma.user.findMany({ where: { id: { in: earnedIds } }, select: { id: true, name: true, email: true } }) : [],
    me?.referralCode ? prisma.user.findMany({
      where: { referredBy: me.referralCode, id: { notIn: earnedIds } },
      select: { name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }) : [],
  ]);
  const nameOf = Object.fromEntries(friends.map(f => [f.id, firstName(f.name, f.email)]));

  return Response.json({
    enabled: true,
    refCode: me?.referralCode || null,
    amount: settings.amount,
    walletAmount: settings.walletAmount,
    minPayout: settings.minPayout,
    holdDays: settings.holdDays,
    summary: summarizeEarnings(earnings),
    earnings: earnings.map(e => ({
      id: e.id,
      friend: nameOf[e.referredId] || 'Friend',
      amount: e.amount,
      status: e.status === 'held' && new Date(e.releasesAt) <= new Date() ? 'available' : e.status,
      releasesAt: e.releasesAt,
      createdAt: e.createdAt,
    })),
    waiting: waiting.map(w => ({ friend: firstName(w.name, w.email), signedUp: w.createdAt })),
    payouts: payouts.map(p => ({ id: p.id, amount: p.amount, status: p.status, reference: p.reference, bank: p.bankName, accountNo: p.bankAccountNo ? `•••${p.bankAccountNo.slice(-4)}` : null, createdAt: p.createdAt })),
  });
}

export async function POST(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const settings = await cashReferralSettings(prisma);
  if (!settings.enabled) return Response.json({ error: 'Cash referrals are not available' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const { action } = body || {};
  const now = new Date();

  if (action === 'payout') {
    const bankName = String(body.bankName || '').trim().slice(0, 60);
    const bankAccountNo = String(body.bankAccountNo || '').replace(/\D/g, '');
    const bankAccountName = String(body.bankAccountName || '').trim().slice(0, 80);
    if (!bankName || bankAccountNo.length !== 10 || !bankAccountName) {
      return Response.json({ error: 'Bank name, the 10-digit account number and the account name are all required' }, { status: 400 });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const ready = await tx.referralEarning.findMany({
          where: { referrerId: session.id, status: 'held', releasesAt: { lte: now } },
          select: { id: true, amount: true },
        });
        const total = ready.reduce((s, e) => s + e.amount, 0);
        if (total < settings.minPayout) {
          return { error: `Cash-outs start at ₦${(settings.minPayout / 100).toLocaleString()}. You have ₦${(total / 100).toLocaleString()} available.` };
        }
        const payout = await tx.referralPayout.create({
          data: { userId: session.id, amount: total, bankName, bankAccountNo, bankAccountName },
        });
        const locked = await tx.referralEarning.updateMany({
          where: { id: { in: ready.map(e => e.id) }, status: 'held' },
          data: { status: 'requested', payoutId: payout.id },
        });
        if (locked.count !== ready.length) throw new Error('earnings changed while requesting');
        return { payoutId: payout.id, amount: total };
      });
      if (result.error) return Response.json({ error: result.error }, { status: 400 });
      log.info('ReferralCash', `Payout requested: ${session.id} ₦${result.amount / 100}`);
      return Response.json({ success: true, ...result, message: `₦${(result.amount / 100).toLocaleString()} requested — it arrives within 2 working days.` });
    } catch (err) {
      log.warn('ReferralCash', `Payout request failed for ${session.id}: ${err.message}`);
      return Response.json({ error: 'Could not request the payout — try again' }, { status: 409 });
    }
  }

  if (action === 'credit-wallet') {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ready = await tx.referralEarning.findMany({
          where: { referrerId: session.id, status: 'held', releasesAt: { lte: now } },
          select: { id: true, amount: true },
        });
        const total = ready.reduce((s, e) => s + e.amount, 0);
        if (total <= 0) return { error: 'Nothing is available to convert yet' };
        // The wallet option pays a premium: each ₦amount earning converts at
        // the walletAmount rate.
        const credit = Math.round(total * settings.walletAmount / settings.amount);
        const locked = await tx.referralEarning.updateMany({
          where: { id: { in: ready.map(e => e.id) }, status: 'held' },
          data: { status: 'credited' },
        });
        if (locked.count !== ready.length) throw new Error('earnings changed while converting');
        await tx.user.update({ where: { id: session.id }, data: { balance: { increment: credit } } });
        await tx.transaction.create({
          data: { userId: session.id, type: 'referral', amount: credit, status: 'Completed', note: `Referral cash taken as wallet credit (${ready.length} friend${ready.length === 1 ? '' : 's'})` },
        });
        return { credit };
      });
      if (result.error) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ success: true, ...result, message: `₦${(result.credit / 100).toLocaleString()} added to your wallet.` });
    } catch (err) {
      log.warn('ReferralCash', `Wallet conversion failed for ${session.id}: ${err.message}`);
      return Response.json({ error: 'Could not convert — try again' }, { status: 409 });
    }
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
