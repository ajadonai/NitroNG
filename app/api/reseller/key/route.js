import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/logger';

// A reseller's own API key: read it, or rotate it. Nobody else gets a key from
// here — approval happens in Reseller HQ on the admin side, which mints the key.
async function ownProfile() {
  const session = await getCurrentUser();
  if (!session) return { error: Response.json({ error: 'Not authenticated' }, { status: 401 }) };
  const profile = await prisma.resellerProfile.findUnique({
    where: { userId: session.id },
    select: { id: true, apiKey: true, catalog: true, enabled: true },
  });
  if (!profile || !profile.enabled) return { error: Response.json({ error: 'Reseller access required' }, { status: 403 }) };
  return { session, profile };
}

export async function GET() {
  const { error, profile } = await ownProfile();
  if (error) return error;
  return Response.json({ apiKey: profile.apiKey, catalog: profile.catalog });
}

/** Rotate: the old key stops answering the moment this returns. */
export async function POST() {
  const { error, session, profile } = await ownProfile();
  if (error) return error;
  const apiKey = randomBytes(24).toString('hex');
  await prisma.resellerProfile.update({ where: { id: profile.id }, data: { apiKey } });
  log.info('Reseller key rotated', session.email || session.id);
  return Response.json({ apiKey, catalog: profile.catalog });
}
