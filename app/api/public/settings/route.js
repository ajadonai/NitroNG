import prisma from '@/lib/prisma';
import { ok, error } from '@/lib/utils';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    const keys = [
      'ref_referrer_bonus', 'ref_invitee_bonus', 'ref_min_deposit', 'ref_enabled',
      'loyalty_tiers', 'loyalty_enabled',
      'leaderboard_announcement',
    ];
    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });

    const serviceCount = await prisma.serviceGroup.count({ where: { enabled: true } });
    const platformCount = await prisma.serviceGroup.findMany({ where: { enabled: true }, distinct: ['platform'], select: { platform: true } });

    return ok({
      ref_referrer_bonus: Math.round((Number(s.ref_referrer_bonus) || 50000) / 100),
      ref_invitee_bonus: Math.round((Number(s.ref_invitee_bonus) || 50000) / 100),
      ref_min_deposit: Math.round((Number(s.ref_min_deposit) || 0) / 100),
      ref_enabled: s.ref_enabled !== 'false',
      loyalty_enabled: s.loyalty_enabled !== 'false',
      loyalty_tiers: (() => { try { return JSON.parse(s.loyalty_tiers || '[]'); } catch { return []; } })(),
      leaderboard_announcement: s.leaderboard_announcement || '',
      service_count: serviceCount,
      platform_count: platformCount.length,
    });
  } catch (err) {
    log.error('Public settings', err.message);
    return error('Failed', 500);
  }
}
