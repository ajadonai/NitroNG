import {
  sendEmail, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail,
  walletCreditEmail, accountDeletionEmail, leaderboardRewardEmail, referralBonusEmail,
  batchPlacementEmail, batchCompletionEmail,
  sendNudgeIdleFunds, sendNudgeIdleBalance,
  sendWinback30Email, sendWinback60Email,
  sendTasksLaunchEmail,
  pitApprovedEmail, pitSuspendedEmail, pitRejectionEmail,
  payoutCompletedEmail, payoutRejectedEmail,
  sendAdActivationDay1, sendAdActivationDay3, sendAdActivationDay6,
  gradualDeliveryAnnouncementEmail,
} from '@/lib/email';
import prisma from '@/lib/prisma';

export async function GET(req) {
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Dev only' }, { status: 403 });
  const url = new URL(req.url);
  const EMAIL = url.searchParams.get('to') || 'adonaijonathancrypto@gmail.com';
  const NAME = 'Trip';
  const only = url.searchParams.get('only');
  const results = [];

  // Full Bright & Bold set — numbering matches Email Copy.md / the preview file
  const ALL = {
    verify:          () => sendVerificationEmail(EMAIL, NAME, '482916'),                                   // 1
    'verify-pit':    () => sendVerificationEmail(EMAIL, NAME, '482916', { pit: true }),                    // 1 (Pit)
    welcome:         () => sendWelcomeEmail(NAME, EMAIL),                                                  // 2
    reset:           () => sendPasswordResetEmail(EMAIL, NAME, 'https://nitro.ng/reset?token=test123'),    // 3
    deletion:        () => sendEmail(EMAIL, 'Your Nitro account is scheduled for deletion', accountDeletionEmail(NAME, 30)), // 4
    'deposit':       () => sendEmail(EMAIL, '₦5,000 is in your wallet', walletCreditEmail(NAME, 5000, null, { kind: 'deposit', bonus: 1200, newBalance: 6200, method: 'Flutterwave' })), // 5 (with bonus)
    'deposit-plain': () => sendEmail(EMAIL, '₦1,000 is in your wallet', walletCreditEmail(NAME, 1000, null, { kind: 'deposit', bonus: 0, newBalance: 1000, method: 'Flutterwave' })),    // 5 (no bonus)
    refund:          () => sendEmail(EMAIL, '₦1,200 refunded to your Nitro wallet', walletCreditEmail(NAME, 1200, null, { kind: 'refund', orderRef: '#48213', failReason: 'Could not deliver', newBalance: 3650 })), // 6
    credit:          () => sendEmail(EMAIL, '₦2,000 credited to your Nitro wallet', walletCreditEmail(NAME, 2000, 'a small thank-you from the team.')), // generic credit
    'batch-place':   () => sendEmail(EMAIL, 'Batch order placed', batchPlacementEmail(NAME, 'BULK-20', 18, 16, 2, 24300)),   // 7
    'batch-done':    () => sendEmail(EMAIL, 'Batch BULK-20, all orders complete', batchCompletionEmail(NAME, 'BULK-20', 16, 1, 1, 1350)), // 8
    'act-day1':      () => sendAdActivationDay1(NAME, EMAIL),                                              // 9
    'act-day3':      () => sendAdActivationDay3(NAME, EMAIL),                                              // 10
    'act-day6':      () => sendAdActivationDay6(NAME, EMAIL),                                              // 11
    leaderboard:     () => sendEmail(EMAIL, 'You earned a leaderboard reward!', leaderboardRewardEmail(NAME, 2500)),          // 13
    referral:        () => sendEmail(EMAIL, 'You received ₦1,000 on Nitro!', referralBonusEmail(NAME, 1000)),                 // 14
    'comeback-30':   () => sendWinback30Email(NAME, EMAIL, 500, 7),                                        // 15
    'comeback-60':   () => sendWinback60Email(NAME, EMAIL, 1000, 7),                                       // 16
    'nudge-funds':   () => sendNudgeIdleFunds(NAME, EMAIL, 3000),                                          // 17
    'nudge-idle':    () => sendNudgeIdleBalance(NAME, EMAIL, 7450),                                        // 18
    'launch-tasks':  () => sendTasksLaunchEmail(NAME, EMAIL),                                              // 25 (manual broadcast)
    'pit-approved':  () => sendEmail(EMAIL, "You're in. Welcome to the Pit", pitApprovedEmail(NAME)),      // 20
    'pit-suspended': () => sendEmail(EMAIL, 'Your Pit account has been paused', pitSuspendedEmail(NAME)),  // 21
    'payout-done':   () => sendEmail(EMAIL, 'Your payout of ₦18,500 has been sent', payoutCompletedEmail(NAME, 18500, 'PIT-8841-XK', 'GTBank ····2841', '11 Jul · 9:40 AM')), // 22
    'payout-reject': () => sendEmail(EMAIL, 'About your payout request', payoutRejectedEmail(NAME, 18500, 'PIT-8841-XK')),    // 23
    'pit-rejected':  () => sendEmail(EMAIL, 'Your Pit application update', pitRejectionEmail(NAME)),
    gradual:         () => sendEmail(EMAIL, "We've upgraded how your orders are delivered", gradualDeliveryAnnouncementEmail(NAME)),
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
