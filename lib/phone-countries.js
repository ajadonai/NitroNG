/**
 * Phone numbers, by country.
 *
 * One module because the Nigeria-only rule used to live in six places — the
 * signup route, check-phone, the notifications route, the auth modal twice and
 * the dashboard's "add your WhatsApp number" prompt — and they could drift
 * apart silently: a signup that succeeds while check-phone says the number is
 * free, or a customer who can register but can never edit their own number.
 *
 * The invariant everything downstream depends on: a stored phone is ALWAYS
 * `+` + country dial code + local digits, e.g. `+2348012345678`. Every WhatsApp
 * link in the product (admin, the Telegram bot, the AI assistant, outreach)
 * strips non-digits from that string and hands it to wa.me, which only works
 * because the country code is already in it. A bare local number stored here is
 * a message sent to a stranger.
 *
 * Five countries only, matching the currencies the switcher offers. Nigeria
 * keeps a strict check because we know the shape and most signups are Nigerian;
 * the rest get a length check, which catches a typo without rejecting a real
 * number whose shape we have not seen. Adding a country is one entry here.
 */

export const COUNTRIES = [
  {
    code: 'NG',
    name: 'Nigeria',
    // `adj` exists because the error copy needs an adjective, not the name:
    // "a valid Nigeria number" reads as broken English.
    adj: 'Nigerian',
    flag: '🇳🇬',
    dial: '234',
    example: '8012345678',
    maxLocal: 11,
    test: (d) => /^[789]\d{9}$/.test(d),
  },
  { code: 'US', name: 'United States',  adj: 'US',       flag: '🇺🇸', dial: '1',   example: '4155552671', maxLocal: 10, test: (d) => /^\d{10}$/.test(d) },
  { code: 'GB', name: 'United Kingdom', adj: 'UK',       flag: '🇬🇧', dial: '44',  example: '7911123456', maxLocal: 10, test: (d) => /^7\d{9}$/.test(d) },
  { code: 'GH', name: 'Ghana',          adj: 'Ghanaian', flag: '🇬🇭', dial: '233', example: '241234567',  maxLocal: 9,  test: (d) => /^\d{9}$/.test(d) },
  { code: 'KE', name: 'Kenya',          adj: 'Kenyan',   flag: '🇰🇪', dial: '254', example: '712345678',  maxLocal: 9,  test: (d) => /^\d{9}$/.test(d) },
];

export const DEFAULT_COUNTRY = 'NG';
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

/** Longest dial code first, so `+234…` is never read as `+2…`. */
const BY_DIAL_DESC = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || null;
}

export function isSupportedCountry(code) {
  return !!getCountry(code);
}

/**
 * What the customer typed → the local part, ready to validate.
 *
 * Strips punctuation and the leading zero people type at home (07911… → 7911…),
 * and tolerates someone pasting the full international number by dropping a
 * leading country code when what remains still looks like a real local number.
 * That last step is conditional on purpose: a Ghanaian local number can begin
 * with the digits "233", and stripping it unconditionally would silently eat
 * three real digits.
 */
export function normalizeLocal(countryCode, raw) {
  const country = getCountry(countryCode);
  if (!country) return '';
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith(country.dial)) {
    const withoutDial = digits.slice(country.dial.length).replace(/^0+/, '');
    if (country.test(withoutDial)) return withoutDial;
  }
  return digits.replace(/^0+/, '');
}

/**
 * Validate a typed number for a country.
 * Returns `{ ok, local, e164, error }` — `error` is customer-facing copy.
 */
export function validatePhone(countryCode, raw) {
  const country = getCountry(countryCode);
  if (!country) return { ok: false, local: '', e164: null, error: 'Choose your country' };
  const local = normalizeLocal(countryCode, raw);
  if (!local) return { ok: false, local: '', e164: null, error: 'Enter your WhatsApp number' };
  if (!country.test(local)) {
    return { ok: false, local, e164: null, error: `Enter a valid ${country.adj} number (e.g. ${country.example})` };
  }
  return { ok: true, local, e164: `+${country.dial}${local}`, error: null };
}

/** Country + local digits → the stored form. Null if the pair is not valid. */
export function toE164(countryCode, raw) {
  return validatePhone(countryCode, raw).e164;
}

/**
 * Best-effort normalise where there is no country picker to ask — the crew
 * portal, where someone types whatever they have. Recognises a number that
 * already carries a supported country code, otherwise reads it as local to
 * `fallback`. Returns null when it cannot be made into a real number, and the
 * caller should reject rather than store something wa.me cannot dial: a crew
 * phone saved as `08012345678` produces `wa.me/08012345678`, which is not an
 * address, which is exactly the bug this exists to stop.
 */
export function normalizeAnyPhone(raw, fallback = DEFAULT_COUNTRY) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const placed = splitE164(digits);
  if (placed.country) return `+${getCountry(placed.country).dial}${placed.local}`;
  return toE164(fallback, digits);
}

/**
 * A stored `+2348012345678` → `{ country, local }`, so admin and the account
 * screens can show a number the way its owner would recognise it, and edit it
 * without retyping the country code. Unknown or legacy shapes return a null
 * country and the bare digits, which callers render as-is rather than guessing.
 */
export function splitE164(stored) {
  const digits = String(stored ?? '').replace(/\D/g, '');
  if (!digits) return { country: null, local: '' };
  for (const c of BY_DIAL_DESC) {
    if (digits.startsWith(c.dial)) {
      const local = digits.slice(c.dial.length);
      if (c.test(local)) return { country: c.code, local };
    }
  }
  return { country: null, local: digits };
}
