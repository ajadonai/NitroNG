// Numbers are stored as +234XXXXXXXXXX but nobody types them that way. Turn what
// an admin typed into the digits that appear inside a stored number, so 0706…,
// +234706… and a bare 706… all find the same account. Fewer than four digits is
// too broad to be a search, so it is ignored.
export const PHONE_SEARCH_MIN_DIGITS = 4;

export function phoneSearchDigits(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^234/, '').replace(/^0+/, '');
  return digits.length >= PHONE_SEARCH_MIN_DIGITS ? digits : null;
}
