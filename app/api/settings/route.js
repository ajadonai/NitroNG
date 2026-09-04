import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';

export const revalidate = 300;

const PUBLIC_KEYS = [
  'social_instagram', 'social_twitter', 'social_tiktok',
  'social_whatsapp_support', 'social_whatsapp_reseller', 'social_whatsapp_channel', 'social_telegram_support',
  'site_email_general', 'site_email_support',
  'ref_referrer_bonus', 'ref_invitee_bonus', 'ref_min_deposit',
  // The Discord order steps link these on the user side; without them here the
  // admin-edited bot links never reached customers and the hardcoded fallback ran.
  'discord_bot_url', 'discord_bot_url_premium',
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
