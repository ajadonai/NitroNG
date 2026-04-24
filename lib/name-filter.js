// Reserved and inappropriate name filtering

const RESERVED_NAMES = [
  'admin', 'administrator', 'nitro', 'nitrong', 'thenitro', 'thenitrong',
  'support', 'help', 'helpdesk', 'moderator', 'mod', 'staff',
  'system', 'root', 'superadmin', 'owner', 'official',
  'customer', 'service', 'services', 'billing', 'finance',
  'ceo', 'cto', 'coo', 'founder', 'cofounder',
  'bot', 'robot', 'ai', 'chatbot', 'autobot',
  'test', 'demo', 'example', 'null', 'undefined', 'void',
  'paystack', 'flutterwave', 'alatpay', 'brevo',
  'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'telegram',
];

const OFFENSIVE_PATTERNS = [
  /n+[i1]+g+[e3]*[r]+/i,
  /f+[u]+c+k+/i,
  /s+h+[i1]+t+/i,
  /a+s+s+h+o+l+e/i,
  /b+[i1]+t+c+h/i,
  /d+[i1]+c+k+/i,
  /p+[u]+s+s+y+/i,
  /w+h+o+r+e/i,
  /c+u+n+t+/i,
  /r+a+p+[i1]+s+t/i,
  /p+e+d+o/i,
  /k+[i1]+l+l/i,
  /s+u+[i1]+c+[i1]+d+e/i,
];

/**
 * Check if a name is blacklisted
 * @param {string} name
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function checkName(name) {
  if (!name || typeof name !== 'string') return { blocked: true, reason: 'Name is required' };

  const clean = name.trim();
  if (clean.length < 2) return { blocked: true, reason: 'Name must be at least 2 characters' };

  const lower = clean.toLowerCase().replace(/[\s._-]/g, '');

  // Check reserved names — exact match on full collapsed name
  if (RESERVED_NAMES.includes(lower)) {
    return { blocked: true, reason: 'This name is reserved' };
  }

  // Check each word individually against reserved
  const words = clean.toLowerCase().split(/[\s._-]+/);
  for (const word of words) {
    if (RESERVED_NAMES.includes(word)) {
      return { blocked: true, reason: 'This name contains a reserved word' };
    }
  }

  // Check offensive patterns
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(lower)) {
      return { blocked: true, reason: 'This name is not allowed' };
    }
  }

  return { blocked: false };
}
