/**
 * Each platform in its own colour, so a bar or a chip reads without a legend.
 * Keys are the platform strings the catalogue uses, lower-cased. Black brands
 * (TikTok, X, Threads, Tidal) get a light neutral on dark surfaces and ink on
 * light ones, since their real colour would vanish.
 */
const BRAND = {
  instagram: '#E1306C', tiktok: 'ink', youtube: '#FF0000', facebook: '#1877F2', 'twitter/x': 'ink', twitter: 'ink', x: 'ink',
  telegram: '#229ED9', threads: 'ink', whatsapp: '#25D366', snapchat: '#E8C400', linkedin: '#0A66C2', discord: '#5865F2',
  twitch: '#9146FF', kick: '#3FBF12', clubhouse: '#D9A400', vimeo: '#1AB7EA', bluesky: '#1185FE', pinterest: '#E60023', reddit: '#FF4500',
  spotify: '#1DB954', audiomack: '#FFA200', boomplay: '#F0A500', 'apple music': '#FA243C', soundcloud: '#FF5500', deezer: '#A238FF',
  tidal: 'ink', shazam: '#0088FF', mixcloud: '#5000FF',
  google: '#4285F4', trustpilot: '#00B67A', website: '#C47D8E', 'web traffic': '#C47D8E', 'google play': '#01875F', 'play store': '#01875F', 'app store': '#0D96F6',
};
const FALLBACK = ['#c47d8e', '#7aa2f7', '#e0a458', '#34d399', '#f472b6', '#a78bfa'];

export function platformBrand(name, { dark = true, index = 0 } = {}) {
  const key = String(name || '').trim().toLowerCase();
  const hex = BRAND[key];
  if (hex === 'ink') return dark ? '#e4e2dd' : '#1c1b19';
  return hex || FALLBACK[index % FALLBACK.length];
}
