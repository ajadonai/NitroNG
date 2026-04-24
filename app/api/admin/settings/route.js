import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

const ALLOWED_KEYS = new Set([
  'markup_usd_rate', 'min_deposit', 'min_order',
  'ref_enabled', 'ref_referrer_bonus', 'ref_invitee_bonus', 'ref_min_deposit',
  'loyalty_enabled', 'loyalty_tiers',
  'leaderboard_auto_reward', 'leaderboard_reward_announcement',
  'gateway_manual', 'coupons',
  'tos_version', 'maintenance',
  'social_instagram', 'social_twitter',
  'social_whatsapp_support', 'social_telegram_support',
  'notification_history',
]);

export async function GET() {
  const { admin, error } = await requireAdmin('settings');
  if (error) return error;

  try {
    const rows = await prisma.setting.findMany();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    return Response.json({ settings });
  } catch (err) {
    log.error('Admin Settings GET', err.message);
    return Response.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('settings', true);
  if (error) return error;

  if (!canPerformAction(admin, 'settings.save')) {
    return Response.json({ error: 'Not authorized to change settings' }, { status: 403 });
  }

  try {
    const { settings } = await req.json();
    if (!settings || typeof settings !== 'object') {
      return Response.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    const entries = Object.entries(settings).filter(([key]) => ALLOWED_KEYS.has(key));
    if (entries.length === 0) return Response.json({ error: 'No valid settings provided' }, { status: 400 });

    const ops = entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value).slice(0, 10000) },
        create: { key, value: String(value).slice(0, 10000) },
      })
    );

    await prisma.$transaction(ops);
    await logActivity(admin.name, 'Updated site settings', 'settings');

    return Response.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    log.error('Admin Settings POST', err.message);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
