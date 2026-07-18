import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import {
  getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit,
} from '@/lib/flutterwave-payment';

function acknowledge() {
  return Response.json({ received: true });
}

export async function POST(req) {
  try {
    // Verify Flutterwave webhook signature
    const body = await req.text();
    const signature = req.headers.get('verif-hash');
    const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH;

    if (!hash) {
      log.error('Webhook', 'FLUTTERWAVE_WEBHOOK_HASH not set — refusing unsigned webhook');
      return Response.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    if (signature !== hash) {
      log.warn('Webhook', 'Invalid Flutterwave signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event !== 'charge.completed') return acknowledge();

    const reference = event.data?.tx_ref;
    if (!reference || typeof reference !== 'string') {
      log.warn('Webhook', 'Signed charge.completed event has no tx_ref');
      return acknowledge();
    }

    const transaction = await prisma.transaction.findUnique({ where: { reference } });
    if (!transaction || transaction.type !== 'deposit' || (transaction.method && transaction.method !== 'flutterwave')) {
      log.info('Webhook', `No Flutterwave deposit for ref: ${reference}`);
      return acknowledge();
    }

    const secretKey = await getFlutterwaveSecretKey();
    if (!secretKey) {
      log.error('Webhook', 'Flutterwave verification key is not configured');
    }

    // The signed callback is a prompt to reconcile, not proof of payment. Always
    // re-query Flutterwave and let the shared reconciler own durable state.
    const result = await reconcileFlutterwaveDeposit({
      transaction,
      secretKey: secretKey || '',
      recoveredBy: 'webhook',
    });

    if (result.newlyFinalized && result.finalization) {
      log.info('Webhook', `Flutterwave deposit credited (ref: ${reference})`);
      try {
        await notifyDepositFinalized(result.finalization, { channel: 'Flutterwave' });
      } catch (notifyError) {
        log.warn('Webhook notifications', notifyError.message);
      }
    }

    return acknowledge();
  } catch (err) {
    log.error('Webhook', err.message);
    return acknowledge();
  }
}
