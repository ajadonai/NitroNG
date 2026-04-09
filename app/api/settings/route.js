import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';

const PUBLIC_KEYS = [
  'social_whatsapp', 'social_telegram', 'social_instagram',
  'social_twitter', 'social_whatsapp_support',
  'ref_referrer_bonus', 'ref_invitee_bonus',
];

export async function GET() {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return Response.json({ settings });
  } catch (err) {
    log.error('Settings GET', err.message);
    return Response.json({ settings: {} });
  }
}
