import { fetchWithRetry } from '@/lib/fetch';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const { amount } = await req.json();
    const amountNum = Number(amount);

    if (!amountNum || amountNum < 500) {
      return Response.json({ error: 'Minimum deposit is ₦500' }, { status: 400 });
    }
    if (amountNum > 10000000) {
      return Response.json({ error: 'Maximum deposit is ₦10,000,000' }, { status: 400 });
    }

    if (!PAYSTACK_SECRET) {
      return Response.json({ error: 'Payment not configured' }, { status: 503 });
    }

    const amountKobo = Math.round(amountNum * 100);
    const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create pending transaction in DB
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: amountKobo,
        method: 'paystack',
        status: 'Pending',
        reference,
        note: `Paystack deposit ₦${amountNum.toLocaleString()}`,
      },
    });

    // Initialize Paystack transaction
    const res = await fetchWithRetry('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        reference,
        callback_url: `${origin}/dashboard?verify=${reference}`,
        customer: {
          email: user.email,
          first_name: user.firstName || user.name.split(' ')[0],
          last_name: user.lastName || user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0],
        },
        metadata: {
          userId: user.id,
          userName: user.name,
        },
      }),
    });

    const data = await res.json();

    if (!data.status) {
      console.error('[Paystack Init]', data.message);
      return Response.json({ error: data.message || 'Payment initialization failed' }, { status: 400 });
    }

    return Response.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
    });
  } catch (err) {
    console.error('[Payments Initialize]', err.message);
    return Response.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
