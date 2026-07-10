import { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, walletCreditEmail, accountDeletionEmail, leaderboardRewardEmail, batchPlacementEmail, batchCompletionEmail, sendNudgeIdleFunds, sendNudgeComeback, sendNudgeLapsed, sendNudgeIdleBalance, gradualDeliveryAnnouncementEmail, sendAdActivationDay1, sendAdActivationDay3, sendAdActivationDay6 } from '@/lib/email';
import prisma from '@/lib/prisma';

export async function GET(req) {
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Dev only' }, { status: 403 });
  const url = new URL(req.url);
  const EMAIL = url.searchParams.get('to') || 'adonaijonathancrypto@gmail.com';
  const NAME = 'Trip';
  const only = url.searchParams.get('only');
  const results = [];

  const ALL = {
    welcome:       () => sendWelcomeEmail(NAME, EMAIL),
    reset:         () => sendPasswordResetEmail(EMAIL, NAME, 'https://nitro.ng/reset?token=test123'),
    wallet:        () => sendEmail(EMAIL, '₦5,000 credited to your Nitro wallet', walletCreditEmail(NAME, 5000, 'Deposit via Flutterwave')),
    deletion:      () => sendEmail(EMAIL, 'Your account is scheduled for deletion', accountDeletionEmail(NAME, 30)),
    leaderboard:   () => sendEmail(EMAIL, 'You earned a leaderboard reward!', leaderboardRewardEmail(NAME, 2500)),
    'batch-place': () => sendEmail(EMAIL, 'Batch order placed', batchPlacementEmail(NAME, 'BTH-1234', 10, 8, 2, 45000)),
    'batch-done':  () => sendEmail(EMAIL, 'Batch order complete', batchCompletionEmail(NAME, 'BTH-1234', 7, 1, 0, 2500)),
    'nudge-funds': () => sendNudgeIdleFunds(NAME, EMAIL, 12500),
    'nudge-back':  () => sendNudgeComeback(NAME, EMAIL),
    'nudge-lapsed':() => sendNudgeLapsed(NAME, EMAIL),
    'nudge-idle':  () => sendNudgeIdleBalance(NAME, EMAIL, 8750),
    'gradual':     () => sendEmail(EMAIL, "We've upgraded how your orders are delivered", gradualDeliveryAnnouncementEmail(NAME)),
    'act-day1':    () => sendAdActivationDay1(NAME, EMAIL),
    'act-day3':    () => sendAdActivationDay3(NAME, EMAIL),
    'act-day6':    () => sendAdActivationDay6(NAME, EMAIL),
  };

  const toRun = only ? { [only]: ALL[only] } : ALL;
  for (const [key, fn] of Object.entries(toRun)) {
    if (!fn) { results.push(`${key} ✗ unknown`); continue; }
    try { await fn(); results.push(`${key} ✓`); } catch (e) { results.push(`${key} ✗ ${e.message}`); }
  }

  return Response.json({ sent: results });
}

export async function POST(req) {
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Dev only' }, { status: 403 });
  const { blast } = await req.json();
  if (blast !== 'gradual-delivery') return Response.json({ error: 'Unknown blast template' }, { status: 400 });

  const subject = "We've upgraded how your orders are delivered";
  const users = await prisma.user.findMany({
    where: { status: 'Active', notifEmail: true, emailVerified: true },
    select: { email: true, name: true },
  });

  const template = gradualDeliveryAnnouncementEmail('{{NAME}}');
  let sent = 0, failed = 0;
  for (const u of users) {
    try {
      const html = template.replace('{{NAME}}', u.name || 'there');
      await sendEmail(u.email, subject, html);
      sent++;
    } catch { failed++; }
  }

  return Response.json({ total: users.length, sent, failed });
}
