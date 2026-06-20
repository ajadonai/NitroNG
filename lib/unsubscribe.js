import { createHmac } from 'crypto';

const SECRET = process.env.JWT_SECRET || 'nitro-dev-secret-change-me';

export function signUnsubToken(email) {
  return Buffer.from(email).toString('base64url') + '.' + createHmac('sha256', SECRET).update(email).digest('hex').slice(0, 32);
}

export function verifyUnsubToken(token) {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const emailB64 = token.slice(0, dot);
  let email;
  try { email = Buffer.from(emailB64, 'base64url').toString(); } catch { return null; }
  if (token !== signUnsubToken(email)) return null;
  return email;
}
