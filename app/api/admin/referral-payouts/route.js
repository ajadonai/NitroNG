import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';

// Processing side of cash referral payouts. No page of its own yet — the
// launch checklist adds one; until then this API is the whole admin surface.

export async function GET() {
  const { error } = await requireAdmin('payments');
  if (error) return error;

  const payouts = await prisma.referralPayout.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(payouts.map(p => p.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = Object.fromEntries(users.map(u => [u.id, u]));
  return Response.json({
    payouts: payouts.map(p => ({
      id: p.id, amount: p.amount, status: p.status, reference: p.reference,
      bankName: p.bankName, bankAccountNo: p.bankAccountNo, bankAccountName: p.bankAccountName,
      createdAt: p.createdAt, processedAt: p.processedAt,
      user: byId[p.userId] ? { name: byId[p.userId].name, email: byId[p.userId].email } : null,
    })),
  });
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('payments');
  if (error) return error;

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const { action, id, reference } = body || {};
  if (!id) return Response.json({ error: 'Payout ID required' }, { status: 400 });

  const payout = await prisma.referralPayout.findUnique({ where: { id } });
  if (!payout) return Response.json({ error: 'Payout not found' }, { status: 404 });
  if (payout.status !== 'pending') return Response.json({ error: `Payout is already ${payout.status}` }, { status: 400 });

  if (action === 'complete') {
    await prisma.$transaction([
      prisma.referralPayout.update({ where: { id }, data: { status: 'completed', reference: String(reference || '').slice(0, 60) || null, processedAt: new Date() } }),
      prisma.referralEarning.updateMany({ where: { payoutId: id, status: 'requested' }, data: { status: 'paid' } }),
    ]);
    await logActivity(admin.name, `Paid referral cash-out ₦${(payout.amount / 100).toLocaleString()} (${payout.bankName} •••${(payout.bankAccountNo || '').slice(-4)})`, 'payment');
    return Response.json({ success: true });
  }

  if (action === 'reject') {
    await prisma.$transaction([
      prisma.referralPayout.update({ where: { id }, data: { status: 'rejected', processedAt: new Date() } }),
      // The earnings go back to available, not into a void: a rejected
      // transfer (wrong account, bank bounce) is the user's money still.
      prisma.referralEarning.updateMany({ where: { payoutId: id, status: 'requested' }, data: { status: 'held', payoutId: null } }),
    ]);
    await logActivity(admin.name, `Rejected referral cash-out ₦${(payout.amount / 100).toLocaleString()} — earnings returned to available`, 'payment');
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
