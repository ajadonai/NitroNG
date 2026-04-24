import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';

export const revalidate = 300;

const PUBLIC_KEYS = [
  'social_instagram', 'social_twitter',
  'social_whatsapp_support', 'social_telegram_support',
  'site_email_general', 'site_email_support',
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
