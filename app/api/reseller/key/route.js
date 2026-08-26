import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms } from '@/lib/reseller';
import { log } from '@/lib/logger';

// Every verified account has an API key. Wholesale is a property of the
// account (reseller terms, granted by approval), not of the key: the same key
// starts returning lower rates the day the account is switched on.
async function own() {
  const session = await getCurrentUser();
  if (!session) return { error: Response.json({ error: 'Not authenticated' }, { status: 401 }) };
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, email: true, apiKey: true, emailVerified: true } });
  if (!user) return { error: Response.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!user.emailVerified) return { error: Response.json({ error: 'Verify your email to get an API key' }, { status: 403 }) };
  return { user };
}
const mint = () => `ntr_live_${randomBytes(20).toString('hex')}`;
async function terms(userId) { const t = await getResellerTerms(userId); return { catalog: t?.catalog || 'curated', wholesale: !!t }; }

/** Read the key, minting it the first time. */
export async function GET() {
  const { error, user } = await own();
  if (error) return error;
  let apiKey = user.apiKey;
  if (!apiKey) {
    apiKey = mint();
    await prisma.user.update({ where: { id: user.id }, data: { apiKey } });
  }
  return Response.json({ apiKey, ...(await terms(user.id)) });
}

/** Rotate: the old key stops answering the moment this returns. */
export async function POST() {
  const { error, user } = await own();
  if (error) return error;
  const apiKey = mint();
  await prisma.user.update({ where: { id: user.id }, data: { apiKey } });
  log.info('API key rotated', user.email || user.id);
  return Response.json({ apiKey, ...(await terms(user.id)) });
}
