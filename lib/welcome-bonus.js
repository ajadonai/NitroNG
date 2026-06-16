const TIERS = [
  { min: 1000000, bonus: 300000 }, // ₦10,000+ → ₦3,000
  { min:  500000, bonus: 120000 }, // ₦5,000+  → ₦1,200
  { min:  250000, bonus:  50000 }, // ₦2,500+  → ₦500
];

function bonusForAmount(kobo) {
  for (const t of TIERS) {
    if (kobo >= t.min) return t.bonus;
  }
  return 0;
}

export async function applyWelcomeBonus(db, userId, depositAmount) {
  const bonus = bonusForAmount(depositAmount);
  if (bonus === 0) return 0;
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstDepositBonusPaid: true, referredBy: true } });
  if (!user || user.firstDepositBonusPaid) return 0;
  // Atomic claim: only one concurrent transaction can flip false→true
  const claimed = await db.user.updateMany({ where: { id: userId, firstDepositBonusPaid: false }, data: { firstDepositBonusPaid: true } });
  if (claimed.count === 0) return 0;
  if (user.referredBy) return 0;
  await db.user.update({ where: { id: userId }, data: { balance: { increment: bonus } } });
  await db.transaction.create({ data: { userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Welcome bonus: ₦${bonus / 100} on first deposit` } });
  return bonus;
}

export { TIERS, bonusForAmount };
