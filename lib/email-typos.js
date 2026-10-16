/**
 * Slips in the big mail domains, and what was meant. One list for the sign up
 * route, which refuses them, and the two sign up forms, which point them out
 * while the address is being typed on step 1 rather than after the password.
 */
const DOMAIN_TYPOS = {
  'gmail.com': ['gmsil.com', 'gmial.com', 'gmal.com', 'gmil.com', 'gmaill.com', 'gamil.com', 'gnail.com', 'gmaul.com', 'gmali.com', 'gmail.co', 'gmaio.com', 'gmqil.com'],
  'yahoo.com': ['yaho.com', 'yahooo.com', 'yaboo.com', 'yhoo.com', 'yahoo.co', 'yaoo.com', 'yahho.com'],
  'hotmail.com': ['hotmal.com', 'hotmial.com', 'hotmai.com', 'hotmil.com', 'hotmaill.com', 'hotmall.com'],
  'outlook.com': ['outlok.com', 'outloo.com', 'outllok.com', 'outlookm.com'],
  'icloud.com': ['iclou.com', 'icoud.com', 'iclould.com', 'icloude.com'],
};
const MEANT = new Map(Object.entries(DOMAIN_TYPOS).flatMap(([meant, slips]) => slips.map(slip => [slip, meant])));

/** "ada@gmial.com" → "ada@gmail.com"; null when the domain is not a known slip. */
export function suggestEmail(email) {
  const at = typeof email === 'string' ? email.indexOf('@') : -1;
  if (at < 1) return null;
  const meant = MEANT.get(email.slice(at + 1).toLowerCase());
  return meant ? `${email.slice(0, at)}@${meant}` : null;
}
