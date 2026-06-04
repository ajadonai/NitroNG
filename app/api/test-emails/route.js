import { sendEmail, sendWelcomeEmail, walletCreditEmail, leaderboardRewardEmail, batchPlacementEmail, batchCompletionEmail, sendWinbackEmail } from '@/lib/email';

export async function GET() {
  const EMAIL = 'addohnine@gmail.com';
  const NAME = 'Adonai';
  const results = [];

  try {
    await sendWelcomeEmail(NAME, EMAIL);
    results.push('Welcome ✓');
  } catch (e) { results.push(`Welcome ✗ ${e.message}`); }

  try {
    const html = await walletCreditEmail(NAME, 5000, 'Deposit via Flutterwave');
    await sendEmail(EMAIL, '₦5,000 credited to your Nitro wallet', html);
    results.push('Wallet credit ✓');
  } catch (e) { results.push(`Wallet credit ✗ ${e.message}`); }

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
    results.push('Winback ✓');
  } catch (e) { results.push(`Winback ✗ ${e.message}`); }

  return Response.json({ sent: results });
}
