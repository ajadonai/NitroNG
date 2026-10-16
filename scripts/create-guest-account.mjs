#!/usr/bin/env node
/**
 * Create the shared guest account (docs/v2/guest_checkout_brief.md). Run once;
 * running it again changes nothing.
 *
 *   node scripts/create-guest-account.mjs
 *
 * Every email-less guest order lives on this account. Nobody signs in to it:
 * its password is a hash of random bytes nobody has ever seen, and the login,
 * Google and reset routes refuse its email outright. Created verified, with
 * every notification and outreach switched off, and the first-deposit bonus
 * marked paid, so no cron emails it, chases it or rewards it.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { GUEST_ACCOUNT_EMAIL } from '../lib/guest-account.js';

const existing = await prisma.user.findUnique({ where: { email: GUEST_ACCOUNT_EMAIL }, select: { id: true } });
if (existing) {
  console.log(`Guest account already exists: ${existing.id}`);
} else {
  const user = await prisma.user.create({
    data: {
      email: GUEST_ACCOUNT_EMAIL,
      password: await bcrypt.hash(randomBytes(48).toString('base64'), 12),
      name: 'Nitro Guest',
      firstName: 'Nitro',
      lastName: 'Guest',
      country: 'NG',
      emailVerified: true,
      notifOrders: false,
      notifPromo: false,
      notifEmail: false,
      outreachOptedOutAt: new Date(),
      firstDepositBonusPaid: true,
      tourCompleted: true,
      orderTourCompleted: true,
      signupSource: 'system:guest-checkout',
      status: 'Active',
    },
    select: { id: true },
  });
  console.log(`Created guest account: ${user.id}`);
}
await prisma.$disconnect();
