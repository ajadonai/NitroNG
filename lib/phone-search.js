// Numbers are stored with their country code (+2348012345678, +447911123456)
// but nobody types them that way. Turn what an admin typed into the digits that
// appear inside a stored number, so 0706…, +234706… and a bare 706… all find
// the same account — and the same for a UK 07911…, +447911… or 7911…. Fewer
// than four digits is too broad to be a search, so it is ignored.
import { COUNTRIES } from './phone-countries';

export const PHONE_SEARCH_MIN_DIGITS = 4;

const DIALS_LONGEST_FIRST = COUNTRIES.map((c) => c.dial).sort((a, b) => b.length - a.length);

export function phoneSearchDigits(input) {
  let digits = String(input || '').replace(/\D/g, '');
  // Strip whichever supported dial code was typed, longest first so +234 is
  // never read as +2. Numbers are stored with the code, so an admin who types
  // a local number still needs to match the digits inside a stored one.
  for (const dial of DIALS_LONGEST_FIRST) {
    if (digits.startsWith(dial)) { digits = digits.slice(dial.length); break; }
  }
  digits = digits.replace(/^0+/, '');
  return digits.length >= PHONE_SEARCH_MIN_DIGITS ? digits : null;
}
