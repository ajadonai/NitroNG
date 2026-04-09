import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';

async function getGatewayKeys(gatewayId) {
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try { const data = JSON.parse(setting.value); if (data.fields) return data.fields; } catch {}
  }
  if (gatewayId === 'paystack') return { secretKey: process.env.PAYSTACK_SECRET_KEY || '' };
  if (gatewayId === 'flutterwave') return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '' };
  return {};
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const existing = await prisma.transaction.findFirst({
      where: { reference, userId: session.id },
    });

    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 });
    if (existing.status === 'Completed') {
      return Response.json({ success: true, message: 'Already credited', amount: existing.amount / 100 });
    }

    const gateway = existing.method || 'paystack';
    const keys = await getGatewayKeys(gateway);

    if (!keys.secretKey) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    let verified = false;
    let paidAmount = existing.amount; // fallback

    // ═══ PAYSTACK VERIFY ═══
    if (gateway === 'paystack') {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${keys.secretKey}` },
      });
      const data = await res.json();
      if (data.status && data.data.status === 'success') {
        verified = true;
        paidAmount = data.data.amount; // kobo
      }
    }

    // ═══ FLUTTERWAVE VERIFY ═══
    if (gateway === 'flutterwave') {
      // Flutterwave verifies by tx_ref
      const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${keys.secretKey}` },
      });
      const data = await res.json();
      if (data.status === 'success' && data.data.status === 'successful') {
        verified = true;
        paidAmount = Math.round(data.data.amount * 100); // convert to kobo
      }
    }

    if (!verified) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Failed', note: `Payment verification failed via ${gateway}` },
      });
      return Response.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Credit user wallet + mark complete
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

    console.log(`[${gateway}] ₦${paidAmount / 100} credited to user ${session.id} (ref: ${reference})`);

    return Response.json({
      success: true,
      message: 'Payment successful',
      amount: paidAmount / 100,
    });
  } catch (err) {
    log.error('Payments Verify', err.message);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
