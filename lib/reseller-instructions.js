// What a buyer must know before ordering, in our words. The providers never
// send this (their APIs carry ten fields and no text), so it is composed from
// what the site already knows: the group note, the Discord setup steps, and
// the extra parameters a tier needs (traffic targeting, comment lists).

const TYPE_BY_API = {
  'Custom Comments': 'Custom Comments',
  'Custom Comments Package': 'Custom Comments',
  'Comment Likes': 'Default',
  'SEO': 'SEO',
  'Package': 'Package',
  'Web Traffic': 'Default',
};

/** The standard panel `type`, which tells a panel what extra fields to ask for. */
export function standardType(apiType, { customComments = false } = {}) {
  if (customComments) return 'Custom Comments';
  return TYPE_BY_API[apiType] || 'Default';
}

export const DISCORD_STEPS = (botUrl) => [
  `Add the bot to your server: ${botUrl}`,
  'Set verification level to None or Low (Server Settings → Safety Setup)',
  'Disable any anti-raid bots',
  'Do not ban or kick members while the order is running',
  'Use a permanent invite link (set to never expire)',
];

const TRAFFIC_NOTE = 'Traffic targeting: send country (2-letter code, WW for worldwide, or a continent: AFR, ASI, EUR, NAM, SAM, MEA), device (all, mobile or desktop), and either keyword=... for search traffic, referrer=... for referral traffic, or neither for direct visits.';
const COMMENTS_NOTE = 'Send comments=... with one comment per line; quantity is the number of comments.';
const SEO_NOTE = 'Send keywords=... with the search terms, one per line.';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Instruction text for a curated tier. Empty when there is nothing to say. */
export function describeTier(group, tier, { botUrl = 'https://nowon.tools' } = {}) {
  const parts = [];
  if (group?.description) parts.push(clean(group.description));
  const discord = String(group?.platform || '').toLowerCase() === 'discord' && ['followers', 'engagement'].includes(group?.type);
  if (discord) parts.push('Required setup before ordering: ' + DISCORD_STEPS(botUrl).map((s, i) => `${i + 1}. ${s}`).join(' '));
  if (tier?.trafficTargeting) parts.push(TRAFFIC_NOTE);
  // A comments tier is one flagged on the tier or one whose upstream type says so.
  if (tier?.customComments || standardType(tier?.apiType) === 'Custom Comments') parts.push(COMMENTS_NOTE);
  else if (tier?.apiType === 'SEO') parts.push(SEO_NOTE);
  return parts.join(' ');
}

/** Instruction text for a full-catalogue service, from what its type implies. */
export function describeService(service) {
  const parts = [];
  const type = standardType(service?.apiType);
  if (type === 'Custom Comments') parts.push(COMMENTS_NOTE);
  if (type === 'SEO') parts.push(SEO_NOTE);
  if (service?.apiType === 'Web Traffic') parts.push(TRAFFIC_NOTE);
  if (service?.dripfeed) parts.push('Supports drip-feed.');
  return parts.join(' ');
}

/** The extra `add` parameters a panel sends, folded into the web order body. */
export function extraOrderFields(p) {
  const body = {};
  const text = p.comments ?? p.usernames ?? p.keywords ?? p.answer_number;
  if (text != null && String(text).trim()) body.comments = String(text);
  const hasTraffic = [p.country, p.device, p.keyword, p.referrer].some(v => v != null && String(v).trim());
  if (hasTraffic) {
    const keyword = p.keyword != null ? String(p.keyword).trim() : '';
    const referrer = p.referrer != null ? String(p.referrer).trim() : '';
    body.trafficConfig = {
      country: p.country != null ? String(p.country).trim() : '',
      device: p.device != null && String(p.device).trim() ? String(p.device).trim().toLowerCase() : 'all',
      trafficType: keyword ? 'keyword' : referrer ? 'referrer' : 'blank',
      keyword,
      referrer,
    };
  }
  return body;
}
