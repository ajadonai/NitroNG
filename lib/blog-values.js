import prisma from '@/lib/prisma';

export async function getLiveValues() {
  const [rows, platformRows, serviceCount] = await Promise.all([
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            'ref_referrer_bonus',
            'ref_invitee_bonus',
            'ref_min_deposit',
            'min_deposit',
            'leaderboard_reward_announcement',
            'loyalty_tiers',
          ],
        },
      },
    }),
    prisma.serviceGroup.findMany({
      where: { enabled: true },
      distinct: ['platform'],
      select: { platform: true },
      orderBy: { platform: 'asc' },
    }),
    prisma.serviceGroup.count({ where: { enabled: true } }),
  ]);
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });

  const fmt = (v, fallback) => {
    const n = Math.round((Number(v) || fallback) / 100);
    return n.toLocaleString('en-NG');
  };
  const platforms = platformRows.map(p => p.platform).filter(Boolean);
  const platformCount = platforms.length || 28;
  const liveServiceCount = serviceCount || 190;

  const referrerBonus = '₦' + fmt(s.ref_referrer_bonus, 50000);
  const inviteeBonus = '₦' + fmt(s.ref_invitee_bonus, 50000);
  const leaderboardAnnouncement = s.leaderboard_reward_announcement || 'Monthly leaderboard rewards for top Nitro users';
  let loyaltyTiers = 'Starter, Regular, Power User, Elite, and Legend';
  try {
    const tiers = JSON.parse(s.loyalty_tiers || '[]');
    if (Array.isArray(tiers) && tiers.length > 0) {
      loyaltyTiers = tiers
        .map(t => {
          const threshold = '₦' + fmt(t.threshold, 0);
          const discount = Number(t.discount || 0);
          const perk = t.perks ? ` — ${t.perks}` : '';
          return `${t.name} (${threshold}+${discount > 0 ? `, ${discount}% off` : ''})${perk}`;
        })
        .join('; ');
    }
  } catch {}

  return {
    '{{referrer_bonus}}': referrerBonus,
    '{{invitee_bonus}}': inviteeBonus,
    '{{ref_referrer_bonus}}': referrerBonus,
    '{{ref_invitee_bonus}}': inviteeBonus,
    '{{ref_min_deposit}}': '₦' + fmt(s.ref_min_deposit, 0),
    '{{min_deposit}}': '₦' + fmt(s.min_deposit, 100000),
    '{{platform_count}}': String(platformCount),
    '{{service_count}}': String(liveServiceCount),
    '{{service_list}}': platforms.join(', '),
    '{{leaderboard_announcement}}': leaderboardAnnouncement,
    '{{loyalty_tiers}}': loyaltyTiers,
  };
}

export function injectLiveValues(text, values) {
  let result = text || '';
  for (const [token, val] of Object.entries(values)) {
    result = result.replaceAll(token, val);
  }
  return result.replace(/\{\{[a-zA-Z0-9_.-]+\}\}/g, '');
}
