import { sendEmail, sendWelcomeEmail, sendPasswordResetEmail, walletCreditEmail, accountDeletionEmail, leaderboardRewardEmail, batchPlacementEmail, batchCompletionEmail, sendWinbackEmail, sendNudgeIdleFunds, sendNudgeComeback, sendNudgeLapsed, sendNudgeIdleBalance } from '@/lib/email';

export async function GET() {
  const EMAIL = 'adonaijonathancrypto@gmail.com';
  const NAME = 'Adonai';
  const results = [];

  try {
    await sendWelcomeEmail(NAME, EMAIL);
    results.push('Welcome ✓');
  } catch (e) { results.push(`Welcome ✗ ${e.message}`); }

  try {
    await sendPasswordResetEmail(EMAIL, NAME, 'https://nitro.ng/reset?token=test123');
    results.push('Password reset ✓');
  } catch (e) { results.push(`Password reset ✗ ${e.message}`); }

  try {
    const html = await walletCreditEmail(NAME, 5000, 'Deposit via Flutterwave');
    await sendEmail(EMAIL, '₦5,000 credited to your Nitro wallet', html);
    results.push('Wallet credit ✓');
  } catch (e) { results.push(`Wallet credit ✗ ${e.message}`); }

  try {
    const html = await accountDeletionEmail(NAME, 30);
    await sendEmail(EMAIL, 'Your account is scheduled for deletion', html);
    results.push('Account deletion ✓');
  } catch (e) { results.push(`Account deletion ✗ ${e.message}`); }

  try {
    const html = await leaderboardRewardEmail(NAME, 2500);
    await sendEmail(EMAIL, 'You earned a leaderboard reward!', html);
    results.push('Leaderboard reward ✓');
  } catch (e) { results.push(`Leaderboard ✗ ${e.message}`); }

  try {
    const html = await batchPlacementEmail(NAME, 'BTH-1234', 10, 8, 2, 45000);
    await sendEmail(EMAIL, 'Batch order placed', html);
    results.push('Batch placement ✓');
  } catch (e) { results.push(`Batch placement ✗ ${e.message}`); }

  try {
    const html = await batchCompletionEmail(NAME, 'BTH-1234', 7, 1, 0, 2500);
    await sendEmail(EMAIL, 'Batch order complete', html);
    results.push('Batch completion ✓');
  } catch (e) { results.push(`Batch completion ✗ ${e.message}`); }

  try {
    await sendWinbackEmail(NAME, EMAIL);
    results.push('Winback (no deposit) ✓');
  } catch (e) { results.push(`Winback ✗ ${e.message}`); }

  try {
    await sendNudgeIdleFunds(NAME, EMAIL, 12500);
    results.push('Nudge: idle funds ✓');
  } catch (e) { results.push(`Nudge idle funds ✗ ${e.message}`); }

  try {
    await sendNudgeComeback(NAME, EMAIL);
    results.push('Nudge: comeback ✓');
  } catch (e) { results.push(`Nudge comeback ✗ ${e.message}`); }

  try {
    await sendNudgeLapsed(NAME, EMAIL);
    results.push('Nudge: lapsed ✓');
  } catch (e) { results.push(`Nudge lapsed ✗ ${e.message}`); }

  try {
    await sendNudgeIdleBalance(NAME, EMAIL, 8750);
    results.push('Nudge: idle balance ✓');
  } catch (e) { results.push(`Nudge idle balance ✗ ${e.message}`); }

  return Response.json({ sent: results });
}
