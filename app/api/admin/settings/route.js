import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction, canSeeSensitive } from '@/lib/admin';
import { TIER_RATE_KEYS, validateAffiliateSettings } from '@/lib/affiliate-settings';

const ALLOWED_KEYS = new Set([
  'markup_brackets', 'markup_margin_floor', 'markup_floor_ceiling', 'markup_ng_bonus',
  'markup_usd_rate', 'markup_usd_buffer', 'markup_usd_market', 'markup_fx_threshold',
  'markup_tier_multipliers',
  'min_deposit', 'min_order',
  'ref_enabled', 'ref_referrer_bonus', 'ref_invitee_bonus', 'ref_min_deposit',
  'loyalty_enabled', 'loyalty_tiers',
  'leaderboard_auto_reward', 'leaderboard_reward_announcement',
  'gateway_manual', 'coupons',
  'tos_version', 'maintenance',
  'social_instagram', 'social_twitter',
  'social_whatsapp_support', 'social_whatsapp_channel', 'social_telegram_support',
  'site_email_general', 'site_email_support',
  'notification_history',
  'winback30_pct', 'winback30_min_naira', 'winback30_cap_naira',
  'winback60_pct', 'winback60_min_naira', 'winback60_cap_naira',
  'winback_credit_expiry_days',
  'affiliate_enabled', 'affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate',
  'affiliate_lead_split', 'affiliate_growth_threshold', 'affiliate_pro_threshold',
  'affiliate_hold_days', 'affiliate_min_payout', 'affiliate_min_order', 'affiliate_max_links',
  'crew_telegram_group_link',
]);

export async function GET() {
  const { admin, error } = await requireAdmin('settings');
  if (error) return error;

  try {
    const rows = await prisma.setting.findMany();
    const sensitive = canSeeSensitive(admin);
    const settings = {};
    rows.forEach(r => {
      if (!sensitive && r.key.startsWith('gateway_')) return;
      settings[r.key] = r.value;
    });

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

    const validationErrors = validateAffiliateSettings(entries);
    if (validationErrors.length > 0) {
      return Response.json({ error: validationErrors.join('; ') }, { status: 400 });
    }

    const ops = entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value).slice(0, 10000) },
        create: { key, value: String(value).slice(0, 10000) },
      })
    );

    await prisma.$transaction(ops);

    const tierKeys = Object.values(TIER_RATE_KEYS);
    if (entries.some(([key]) => tierKeys.includes(key))) {
      const rates = Object.fromEntries(entries.filter(([k]) => tierKeys.includes(k)).map(([k, v]) => [k, parseInt(v)]));
      for (const [tier, key] of Object.entries(TIER_RATE_KEYS)) {
        if (rates[key]) {
          await prisma.crewMember.updateMany({ where: { tier, status: { not: 'rejected' }, deletedAt: null }, data: { commissionRate: rates[key] } });
        }
      }
      if (rates.affiliate_pro_rate) {
        await prisma.crewMember.updateMany({ where: { role: 'chief', status: { not: 'rejected' }, deletedAt: null }, data: { commissionRate: rates.affiliate_pro_rate } });
      }
    }

    const AFFILIATE_KEYS = new Set([
      'affiliate_enabled', 'affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate',
      'affiliate_lead_split', 'affiliate_growth_threshold', 'affiliate_pro_threshold',
      'affiliate_hold_days', 'affiliate_min_payout', 'affiliate_min_order', 'affiliate_max_links',
      'crew_telegram_group_link',
    ]);
    const affChanges = entries.filter(([k]) => AFFILIATE_KEYS.has(k));
    const otherChanges = entries.filter(([k]) => !AFFILIATE_KEYS.has(k));

    if (affChanges.length > 0) {
      const detail = affChanges.map(([k, v]) => `${k}=${v}`).join(', ');
      await logActivity(admin.name, `Updated affiliate settings: ${detail}`, 'crew');
    }
    if (otherChanges.length > 0) {
      await logActivity(admin.name, `Updated site settings (${otherChanges.length} keys)`, 'settings');
    }

    return Response.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    log.error('Admin Settings POST', err.message);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
