import prisma from './prisma.js';

const FALLBACK_WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q';

let cache = null;
let cacheTs = 0;
const TTL = 5 * 60 * 1000;

export async function getPublicSettings() {
  if (cache && Date.now() - cacheTs < TTL) return cache;
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'social_whatsapp_support', 'social_whatsapp_channel',
          'social_telegram_support', 'social_instagram', 'social_twitter',
          'site_email_general', 'site_email_support',
        ],
      },
    },
  });
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  cache = settings;
  cacheTs = Date.now();
  return settings;
}

export async function getWhatsAppChannelUrl() {
  try {
    const s = await getPublicSettings();
    return s.social_whatsapp_channel || FALLBACK_WA_CHANNEL;
  } catch {
    return FALLBACK_WA_CHANNEL;
  }
}
