const PLATFORM_URLS = {
  x: (h) => `https://x.com/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  facebook: (h) => `https://facebook.com/${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
  telegram: (h) => `https://t.me/${h}`,
  nairaland: (h) => `https://nairaland.com/${h}`,
  reddit: (h) => `https://reddit.com/u/${h}`,
};

const PLATFORM_LABELS = {
  x: 'X', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', whatsapp: 'WhatsApp', telegram: 'Telegram',
  nairaland: 'Nairaland', reddit: 'Reddit', google: 'Google',
  trustpilot: 'Trustpilot', blog: 'Blog',
};

export function proofToLink(proof, platform) {
  if (!proof) return null;
  if (proof.startsWith('http')) {
    return { url: proof, label: PLATFORM_LABELS[platform] || 'Link' };
  }
  const fn = PLATFORM_URLS[platform];
  if (fn) return { url: fn(proof), label: PLATFORM_LABELS[platform] || platform };
  return null;
}
