const WELCOME_BONUS = 50000; // ₦500 in kobo
const MIN_DEPOSIT = 250000; // ₦2,500 in kobo

export async function applyWelcomeBonus(db, userId, depositAmount) {
  if (depositAmount < MIN_DEPOSIT) return 0;
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstDepositBonusPaid: true, referredBy: true } });
  if (!user || user.firstDepositBonusPaid) return 0;
  if (user.referredBy) {
    await db.user.update({ where: { id: userId }, data: { firstDepositBonusPaid: true } });
    return 0;
  }
  await db.user.update({ where: { id: userId }, data: { firstDepositBonusPaid: true, balance: { increment: WELCOME_BONUS } } });
  await db.transaction.create({ data: { userId, type: 'bonus', amount: WELCOME_BONUS, status: 'Completed', note: 'Welcome bonus: first deposit of ₦2,500+' } });
  return WELCOME_BONUS;
}
