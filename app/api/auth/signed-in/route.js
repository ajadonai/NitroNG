import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The public pages are cached for everybody, so their nav cannot know who is
// looking. It asks this to choose between Log in and Get started or one
// Dashboard button. The same check the proxy uses to send a signed-in visitor
// from the landing page to their dashboard: the token's signature and type,
// no database. The dashboard does the full session check when it opens.
// Always 200, so an anonymous visitor's page logs no failed request.
export async function GET() {
  const token = (await cookies()).get('nitro_token')?.value;
  const signedIn = !!(token && verifyUserToken(token));
  return Response.json({ signedIn }, { headers: { 'Cache-Control': 'no-store' } });
}
