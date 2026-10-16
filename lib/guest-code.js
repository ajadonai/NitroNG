import { randomInt } from 'node:crypto';

/**
 * The guest code: a guest's only way back to their order and its credit, so it
 * must be impossible to guess and hard to misread. Eight characters from an
 * alphabet without 0/O, 1/I/L or U, shown as G7K2-9XQM: 30^8, about 650
 * billion codes, and the lookup routes are rate-limited on top
 * (docs/v2/guest_checkout_brief.md).
 *
 * Never derived from the NTR order number, which runs in sequence and anyone
 * could count through.
 */
export const GUEST_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALLOWED = new Set(GUEST_CODE_ALPHABET);

export function newGuestCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += GUEST_CODE_ALPHABET[randomInt(GUEST_CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** What a visitor typed, as a code we can look up, or null if it cannot be one. */
export function normalizeGuestCode(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== 8 || ![...raw].every((c) => ALLOWED.has(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
