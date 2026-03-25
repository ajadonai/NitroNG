import { fetchWithRetry } from '@/lib/fetch';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    // Check if already processed
    const existing = await prisma.transaction.findFirst({
      where: { reference, userId: session.id },
    });

    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 });
    if (existing.status === 'Completed') {
      return Response.json({ success: true, message: 'Already credited', amount: existing.amount / 100 });
    }

    if (!PAYSTACK_SECRET) {
      return Response.json({ error: 'Payment not configured' }, { status: 503 });
    }

    // Verify with Paystack
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
    });

    const data = await res.json();

    if (!data.status || data.data.status !== 'success') {
      // Update transaction as failed
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Failed', note: `Payment ${data.data?.status || 'failed'}` },
      });
      return Response.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Verify amount matches
    const paidAmount = data.data.amount; // in kobo
    if (paidAmount !== existing.amount) {
      console.warn(`[Paystack Verify] Amount mismatch: expected ${existing.amount}, got ${paidAmount} for ${reference}`);
    }

    // Credit user wallet + mark transaction complete
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.id },
        data: { balance: { increment: paidAmount } },
      }),
      prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Completed', amount: paidAmount },
      }),
    ]);

    console.log(`[Paystack] ₦${paidAmount / 100} credited to user ${session.id} (ref: ${reference})`);

    return Response.json({
      success: true,
      message: 'Payment successful',
      amount: paidAmount / 100,
    });
  } catch (err) {
    console.error('[Payments Verify]', err.message);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
