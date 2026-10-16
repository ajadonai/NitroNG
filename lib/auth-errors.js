/**
 * Where a message from the auth API belongs on the form.
 *
 * The routes answer in sentences, and both sign-in forms used to print the
 * sentence in one box: above everything in the modal, below everything on the
 * hero card. So "This email is already in use" arrived on step 2, next to the
 * password, with nothing pointing back at the email, and the box made the card
 * taller every time. This puts each message on the field it is about.
 *
 * Matched on the exact sentences app/api/auth/{login,signup}/route.js send, and
 * on lib/phone-countries.js and lib/name-filter.js, which signup passes through.
 * Anything unrecognised comes back with field null and is shown on the line
 * under the button, so a new server message can never be lost, only unplaced.
 */

const EMAIL_INVALID = /^(Please enter a valid email|Disposable email)/;
const PHONE_INVALID = /^(Enter a valid .+ number|Enter your WhatsApp number|Choose your country)/;
const NAME_INVALID = /^(First name and last name|Name can only|Name is required|Name must be|This name)/;

export function placeAuthError(message) {
  const m = String(message ?? '').trim();

  const typo = /^Did you mean (\S+@\S+)\?$/.exec(m);
  if (typo) return { field: 'email', code: 'typo', suggestion: typo[1] };

  if (m === 'No account found with this email') return { field: 'email', code: 'no-account' };
  if (m === 'Invalid email or password') return { field: 'password', code: 'wrong-password' };
  if (m === 'This email is already in use') return { field: 'email', code: 'taken' };
  if (m === 'This WhatsApp number is already in use') return { field: 'phone', code: 'taken' };
  if (EMAIL_INVALID.test(m)) return { field: 'email', code: 'invalid' };
  if (PHONE_INVALID.test(m)) return { field: 'phone', code: 'invalid' };
  if (NAME_INVALID.test(m)) return { field: 'name', code: 'invalid' };
  if (/^Password must be/.test(m)) return { field: 'password', code: 'invalid' };

  return { field: null, code: 'other' };
}
