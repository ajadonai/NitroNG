import prisma from '@/lib/prisma';

const ORDER_BASE = 10000;

async function queryAll() {
  return Promise.all([
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
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.groupBy({
      by: ['status'],
      where: { deletedAt: null, status: { in: ['Completed', 'Partial', 'Cancelled'] } },
      _count: true,
    }),
    prisma.serviceGroup.findMany({
      where: { enabled: true, platform: 'Telegram' },
      select: { tiers: { where: { enabled: true }, select: { sellPer1k: true } } },
    }),
  ]);
}

export async function getLiveValues() {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await queryAll();
      const [rows, platformRows, serviceCount, userCount, orderCount, orderStats, tgGroups] = result;
      return buildValues(rows, platformRows, serviceCount, userCount, orderCount, orderStats, tgGroups);
    } catch (err) {
      last = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw last;
}

function buildValues(rows, platformRows, serviceCount, userCount, orderCount, orderStats, tgGroups) {
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });

  const fmt = (v, fallback) => {
    const n = Math.round((Number(v) || fallback) / 100);
    return n.toLocaleString('en-NG');
  };
  const platforms = platformRows.map(p => p.platform).filter(Boolean);
  const platformCount = platforms.length || 28;
  const liveServiceCount = serviceCount || 190;

  const paddedOrders = (orderCount || 0) + ORDER_BASE;
  const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n);
  const totalOrders = fmtK(paddedOrders);
  const totalUsers = fmtK(userCount || 0);

  const statusCounts = {};
  orderStats.forEach(s2 => { statusCounts[s2.status] = s2._count; });
  const denom = (statusCounts.Completed || 0) + (statusCounts.Partial || 0) + (statusCounts.Cancelled || 0);
  const deliveryRate = denom > 0 ? Math.max(90, Math.round((statusCounts.Completed || 0) / denom * 100)) : 91;

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
    '{{order_count}}': totalOrders + '+',
    '{{user_count}}': totalUsers,
    '{{delivery_rate}}': String(deliveryRate),
    '{{telegram_from_price}}': (() => {
      let min = Infinity;
      let count = 0;
      (tgGroups || []).forEach(g => g.tiers.forEach(t => {
        count++;
        const r = Number(t.sellPer1k) / 100;
        if (r > 0 && r < min) min = r;
      }));
      return Math.ceil(min === Infinity ? 158 : min).toLocaleString('en-NG');
    })(),
    '{{telegram_service_count}}': String((tgGroups || []).reduce((n, g) => n + g.tiers.length, 0) || 10),
  };
}

export function injectLiveValues(text, values) {
  let result = text || '';
  for (const [token, val] of Object.entries(values)) {
    result = result.replaceAll(token, val);
  }
  return result.replace(/\{\{[a-zA-Z0-9_.-]+\}\}/g, '');
}
