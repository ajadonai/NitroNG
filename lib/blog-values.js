import prisma from '@/lib/prisma';

export async function getLiveValues() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_min_deposit', 'min_deposit'] } },
  });
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });

  const platformCount = await prisma.serviceGroup.findMany({
    where: { enabled: true }, distinct: ['platform'], select: { platform: true },
  });

  const fmt = (v, fallback) => {
    const n = Math.round((Number(v) || fallback) / 100);
    return n.toLocaleString('en-NG');
  };

  const referrerBonus = '₦' + fmt(s.ref_referrer_bonus, 50000);
  const inviteeBonus = '₦' + fmt(s.ref_invitee_bonus, 50000);

  return {
    '{{referrer_bonus}}': referrerBonus,
    '{{invitee_bonus}}': inviteeBonus,
    '{{ref_referrer_bonus}}': referrerBonus,
    '{{ref_invitee_bonus}}': inviteeBonus,
    '{{ref_min_deposit}}': '₦' + fmt(s.ref_min_deposit, 0),
    '{{min_deposit}}': '₦' + fmt(s.min_deposit, 50000),
    '{{platform_count}}': String(platformCount.length || 28),
  };
}

export function injectLiveValues(text, values) {
  let result = text;
  for (const [token, val] of Object.entries(values)) {
    result = result.replaceAll(token, val);
  }
  return result;
}
