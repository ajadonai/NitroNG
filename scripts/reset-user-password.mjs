/**
 * Set a customer's password by hand.
 *
 *   node scripts/reset-user-password.mjs <email> <new-password>
 *
 * For when the self-serve route is not available — the reset link at
 * /api/auth/forgot-password is the normal answer, and it is the better one,
 * because it proves whoever uses it can read that mailbox. This script proves
 * nothing of the sort: it trusts whoever runs it. Use it when you have
 * satisfied yourself some other way that the person asking owns the account.
 *
 * The password is an argument rather than a constant so it never lands in the
 * repository. Shell history still catches it — prefix the command with a space
 * if your shell is set to skip those, and have the customer change it after.
 *
 * Mirrors app/api/auth/change-password/route.js: bcrypt at cost 12, and every
 * existing session revoked. The session wipe matters most in the case you least
 * want — if the request did not really come from the account owner, whoever is
 * signed in is signed out.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/reset-user-password.mjs <email> <new-password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Refusing: password is shorter than 8 characters.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, createdAt: true, deletedAt: true },
  });

  if (!user) {
    console.error(`No account found for ${email}. Nothing changed.`);
    process.exit(1);
  }
  if (user.deletedAt) {
    console.error(`${email} is deleted or pending deletion. Refusing to touch it.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  const revoked = await prisma.session.deleteMany({ where: { userId: user.id } });

  // Read it back and check the new password actually authenticates, rather
  // than trusting that the write did what it said.
  const stored = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  const works = await bcrypt.compare(password, stored.password);

  console.log({
    account: user.name,
    email: user.email,
    joined: user.createdAt.toISOString().slice(0, 10),
    newPasswordVerified: works,
    sessionsRevoked: revoked.count,
  });
  if (!works) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
