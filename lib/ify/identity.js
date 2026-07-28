// lib/ify/identity.js
// Resolve a WhatsApp sender to a Nitro account (lean v1 = lookup only, no actions).
// WhatsApp sends the number without a leading "+", usually full country code (e.g. 2348012345678).
// Nitro's User.phone may be stored in a few shapes, so we try sensible variants.

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

function phoneVariants(waNumber) {
  const digits = (waNumber || '').replace(/\D/g, '');
  const set = new Set();
  if (!digits) return [];
  set.add(digits);
  set.add(`+${digits}`);
  set.add(waNumber);
  // Nigeria: 234XXXXXXXXXX  <->  0XXXXXXXXXX
  if (digits.startsWith('234') && digits.length >= 13) {
    set.add('0' + digits.slice(3));
  } else if (digits.startsWith('0')) {
    set.add('234' + digits.slice(1));
    set.add('+234' + digits.slice(1));
  }
  return [...set].filter(Boolean);
}

// Returns the matching active user, or null for an unknown number.
export async function resolveUser(waNumber) {
  try {
    const phones = phoneVariants(waNumber);
    if (!phones.length) return null;
    const user = await prisma.user.findFirst({
      where: { phone: { in: phones }, status: 'Active' },
      select: { id: true, name: true, firstName: true, email: true, phone: true, balance: true },
    });
    return user || null;
  } catch (e) {
    log.warn('Ify', `identity lookup failed: ${e.message}`);
    return null; // fail open as a non-user; never block a reply on a lookup error
  }
}
