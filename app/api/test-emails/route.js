import { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, walletCreditEmail, accountDeletionEmail, leaderboardRewardEmail, batchPlacementEmail, batchCompletionEmail, sendWinbackEmail, sendNudgeIdleFunds, sendNudgeComeback, sendNudgeLapsed, sendNudgeIdleBalance, gradualDeliveryAnnouncementEmail, sendAdActivationDay1, sendAdActivationDay3, sendAdActivationDay6 } from '@/lib/email';
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
    wallet:        () => walletCreditEmail(NAME, 5000, 'Deposit via Flutterwave').then(h => sendEmail(EMAIL, '₦5,000 credited to your Nitro wallet', h)),
    deletion:      () => accountDeletionEmail(NAME, 30).then(h => sendEmail(EMAIL, 'Your account is scheduled for deletion', h)),
    leaderboard:   () => leaderboardRewardEmail(NAME, 2500).then(h => sendEmail(EMAIL, 'You earned a leaderboard reward!', h)),
    'batch-place': () => batchPlacementEmail(NAME, 'BTH-1234', 10, 8, 2, 45000).then(h => sendEmail(EMAIL, 'Batch order placed', h)),
    'batch-done':  () => batchCompletionEmail(NAME, 'BTH-1234', 7, 1, 0, 2500).then(h => sendEmail(EMAIL, 'Batch order complete', h)),
    'nudge-funds': () => sendNudgeIdleFunds(NAME, EMAIL, 12500),
    'nudge-back':  () => sendNudgeComeback(NAME, EMAIL),
    'nudge-lapsed':() => sendNudgeLapsed(NAME, EMAIL),
    'nudge-idle':  () => sendNudgeIdleBalance(NAME, EMAIL, 8750),
    'gradual':     () => gradualDeliveryAnnouncementEmail(NAME).then(h => sendEmail(EMAIL, "We've upgraded how your orders are delivered", h)),
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

  const template = await gradualDeliveryAnnouncementEmail('{{NAME}}');
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
