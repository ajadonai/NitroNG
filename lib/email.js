import { fetchWithRetry } from '@/lib/fetch';
import prisma from '@/lib/prisma';
import { SITE } from '@/lib/site';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'Ify from Nitro';

async function getSocials() {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['social_instagram', 'social_twitter', 'social_whatsapp_support', 'social_telegram_support'] } },
    });
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    return s;
  } catch { return {}; }
}

function normalizeIG(v) { return (v || SITE.social.instagram).replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i, '').replace(/^@/, '').replace(/\/$/, ''); }
function normalizeX(v) { return (v || SITE.social.twitter).replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, '').replace(/^@/, '').replace(/\/$/, ''); }
function normalizeTG(v) { return v ? v.replace(/^(https?:\/\/)?(t\.me\/)?@?/, '') : null; }
function normalizeWA(v) { return v ? v.replace(/\D/g, '') : null; }

const SOCIAL_ICONS = {
  instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  x:         'https://cdn.simpleicons.org/x/A0A0A0',
  whatsapp:  'https://cdn.simpleicons.org/whatsapp/25D366',
  telegram:  'https://cdn.simpleicons.org/telegram/26A5E4',
};

function socialIcon(href, iconName, alt) {
  const src = SOCIAL_ICONS[iconName];
  if (!src) return '';
  return `<td style="padding:0 6px;">
    <a href="${href}" style="text-decoration:none;" target="_blank">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="em-sb" style="width:36px;height:36px;background:#f5f0ec;border-radius:10px;" align="center" valign="middle">
          <img src="${src}" width="16" height="16" alt="${alt}" style="display:block;" />
        </td>
      </tr></table>
    </a>
  </td>`;
}

function socialFooter(s) {
  const ig = normalizeIG(s.social_instagram);
  const x = normalizeX(s.social_twitter);
  const wa = normalizeWA(s.social_whatsapp_support);
  const tg = normalizeTG(s.social_telegram_support);

  let icons = '';
  icons += socialIcon(`https://instagram.com/${ig}`, 'instagram', 'Instagram');
  icons += socialIcon(`https://x.com/${x}`, 'x', 'X');
  if (wa) icons += socialIcon(`https://wa.me/${wa}`, 'whatsapp', 'WhatsApp');
  if (tg) icons += socialIcon(`https://t.me/${tg}`, 'telegram', 'Telegram');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="center" style="padding:24px 32px 8px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>${icons}</tr></table>
    </td>
  </tr></table>`;
}

// ═══ EMAIL LAYOUT HELPERS ═══

export function emailRow(label, value, valueColor = '#333') {
  return `<tr>
    <td class="em-m em-dbb" style="padding:8px 0;font-size:13px;color:#918b85;border-bottom:1px solid #f0ece6;">${label}</td>
    <td class="em-dbb" align="right" style="padding:8px 0;font-size:13px;font-weight:600;color:${valueColor};border-bottom:1px solid #f0ece6;">${value}</td>
  </tr>`;
}

export function emailDataBox(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
    <tr><td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" class="em-db" style="background:#faf8f5;border-radius:14px;border-left:3px solid #c47d8e;">
        <tr><td style="padding:4px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

export function emailCTA(href, text) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:8px 0;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background-color:#c47d8e;background:linear-gradient(135deg,#c47d8e,#a3586b);border-radius:12px;padding:14px 36px;">
          <a href="${href}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:.3px;">${text}</a>
        </td>
      </tr></table>
    </td></tr>
  </table>`;
}

// ═══ BRANDED EMAIL WRAPPER ═══
export async function emailWrap({ label, labelBg, labelColor, title, body, footer }) {
  const socials = await getSocials();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark}
@media(prefers-color-scheme:dark){
.em-body{background:#1a1a2e!important}
.em-card{background:#222240!important;border-color:#3a3a50!important}
.em-h{color:#f0ece6!important}
.em-t{color:#e0dcd6!important}
.em-m{color:#a09b95!important}
.em-db{background:#2a2a44!important}
.em-dbb{border-color:#3a3a50!important}
.em-sb{background:#2a2a44!important}
.em-div{background:#3a3a50!important}
}
</style>
</head>
<body class="em-body" style="margin:0;padding:0;background:#f6f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="em-body" style="background:#f6f3ef;">
<tr><td align="center" style="padding:40px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" class="em-card" style="max-width:520px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ebe6df;">

    <!-- Header: Logomark + Wordmark -->
    <tr><td align="center" style="padding:36px 32px 0;">
      <img src="https://nitro.ng/icon-192.png" width="44" height="44" alt="Nitro" style="display:block;border-radius:13px;" />
      <p style="margin:10px 0 0;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c47d8e;">NITRO</p>
    </td></tr>

    <!-- Accent line -->
    <tr><td style="padding:20px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="height:3px;background:#c47d8e;font-size:1px;line-height:1px;">&nbsp;</td>
      </tr></table>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:28px 32px 36px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:6px;background:${labelBg};color:${labelColor};">${label}</td>
      </tr></table>
      <h1 class="em-h" style="font-size:24px;font-weight:700;color:#1a1a1a;margin:16px 0 10px;line-height:1.3;">${title}</h1>
      ${body}
    </td></tr>

    <!-- Footer divider -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 32px;"><div class="em-div" style="height:1px;background:#ece7e0;"></div></td>
      </tr></table>

      <!-- Social icons -->
      ${footer || socialFooter(socials)}

      <!-- Tagline -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="padding:4px 32px 28px;">
          <p style="font-size:12px;font-weight:500;color:#b0a9a2;margin:0;">Your growth, simplified</p>
        </td>
      </tr></table>
    </td></tr>

  </table>

  <!-- Outside-card notice -->
  <table cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;"><tr>
    <td align="center" style="padding:20px 0 0;">
      <p style="font-size:11px;color:#b5b0aa;margin:0;">You received this because you have a Nitro account.<br/><a href="https://nitro.ng/dashboard?page=settings#set-notifications" style="color:#c47d8e;text-decoration:underline;">Manage preferences</a></p>
    </td>
  </tr></table>

</td></tr>
</table>
</body></html>`;
}

// ═══ SEND EMAIL VIA BREVO ═══
export async function sendEmail(to, subject, html, text = '') {
  if (!BREVO_KEY) {
    console.warn('[Email] BREVO_API_KEY not set — logging email instead');
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }
  try {
    const res = await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || subject,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Email] Sent: ${subject} (messageId: ${data.messageId})`);
      return { success: true, messageId: data.messageId };
    } else {
      const err = await res.text();
      console.error(`[Email] Failed (${res.status}):`, err);
      return { success: false, reason: err };
    }
  } catch (err) {
    console.error('[Email] Send error:', err.message);
    return { success: false, reason: err.message };
  }
}

// ═══ WELCOME EMAIL ═══
export async function sendWelcomeEmail(name, to) {
  const subject = "You're in, welcome to Nitro";
  const html = await emailWrap({
    label: 'Welcome', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: 'Welcome to Nitro 🚀',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">Good to have you here.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">Thousands of Nigerian creators and businesses use Nitro to grow their content. Now you've got the same tools they do.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">Fund your wallet, pick what you need, and you're off. Most orders start delivering within seconds.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Go to your dashboard')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px;"><tr><td class="em-db" style="padding:16px 18px;background:#faf8f5;border-radius:12px;">
        <p class="em-t" style="font-size:14px;line-height:1.7;color:#555;margin:0;">💡 <strong>Got a friend building their brand?</strong> Share your referral link from your dashboard. You both earn a bonus when they make their first deposit.</p>
      </td></tr></table>
      <p class="em-m" style="font-size:13px;color:#999;margin:0;">Questions? We're at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a> — real people, fast replies.</p>
    `,
  });
  return sendEmail(to, subject, html, `Welcome to Nitro, ${name}! Head to your dashboard: https://nitro.ng/dashboard`);
}

// ═══ PASSWORD RESET ═══
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = await emailWrap({
    label: 'Security', labelBg: '#fef2f2', labelColor: '#dc2626',
    title: 'Reset your password',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">Someone requested a password reset for your account. If that was you, tap the button below to choose a new one.</p>
      ${emailCTA(resetUrl, 'Reset password')}
      <p class="em-m" style="font-size:13px;color:#999;text-align:center;margin:20px 0 8px;">This link expires in 30 minutes.</p>
      <p class="em-m" style="font-size:13px;color:#bbb;text-align:center;margin:0;">If you didn't request this, just ignore this email. Your password won't change.</p>
    `,
  });
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

// ═══ WALLET CREDIT ═══
export async function walletCreditEmail(name, amount, reason) {
  return await emailWrap({
    label: 'Wallet', labelBg: '#ecfdf5', labelColor: '#059669',
    title: reason || 'Balance credited',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Your Nitro wallet just got a top up.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td align="center" style="padding:20px 24px;background:#ecfdf5;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#059669;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#059669;margin-top:6px;">Added to your wallet</div>
      </td></tr></table>
      ${emailCTA('https://nitro.ng/dashboard', 'Check your balance')}
    `,
  });
}

// ═══ ACCOUNT DELETION ═══
export async function accountDeletionEmail(name, daysLeft) {
  return await emailWrap({
    label: 'Account', labelBg: '#fef2f2', labelColor: '#dc2626',
    title: 'Your account is scheduled for deletion',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">Your Nitro account has been scheduled for permanent deletion in <strong>${daysLeft} days</strong>.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">All your data, order history, and wallet balance will be removed permanently after this period.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">If this was a mistake or you changed your mind, reach out to us at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a> and we'll cancel it right away.</p>
    `,
  });
}

// ═══ LEADERBOARD REWARD ═══
export async function leaderboardRewardEmail(name, amount) {
  return await emailWrap({
    label: 'Reward', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'You earned a reward 🏆',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Nice one. You made it to the Nitro leaderboard this month and the reward is already in your wallet.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td align="center" style="padding:20px 24px;background:#fef3c7;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#b45309;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#b45309;margin-top:6px;">Leaderboard reward</div>
      </td></tr></table>
      ${emailCTA('https://nitro.ng/dashboard', 'View your wallet')}
      <p class="em-m" style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Keep it going. The leaderboard resets every month.</p>
    `,
  });
}

// ═══ BULK ORDER PLACEMENT ═══
export async function batchPlacementEmail(name, batchId, total, placed, failed, totalCharge) {
  let rows = emailRow('Batch', batchId) + emailRow('Total orders', total) + emailRow('Processing', placed, '#059669');
  if (failed > 0) rows += emailRow('Pending retry', failed, '#d97706');
  rows += `<tr><td colspan="2" style="padding:0;"><div style="height:1px;background:#ede8e1;margin:4px 0;"></div></td></tr>`;
  rows += emailRow('Total charged', `₦${totalCharge.toLocaleString()}`, '#1a1a1a');

  return await emailWrap({
    label: 'Bulk Order', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: `${total} orders placed`,
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Your bulk order has been submitted and is now processing.</p>
      ${emailDataBox(rows)}
      ${failed > 0 ? '<p class="em-m" style="font-size:13px;color:#888;margin:0 0 24px;">Orders that couldn\'t be placed immediately will be retried automatically. If they still don\'t go through, you\'ll be refunded.</p>' : ''}
      ${emailCTA('https://nitro.ng/dashboard', 'View orders')}
    `,
  });
}

// ═══ PROMOTIONAL CAMPAIGN ═══

const EMAIL_THEMES = {
  christmas: {
    deco: '🎄✨🎁✨🎄',
    accent: '#c0392b',
    bg: '#fdf2f2',
    border: '#c0392b',
    topBar: 'linear-gradient(90deg,#c0392b,#27ae60,#c0392b)',
    badge: '🎅 ',
    ctaText: 'Unwrap your discount',
    subjectPrefix: '🎄 ',
  },
  newyear: {
    deco: '🎆✨🥂✨🎆',
    accent: '#d4a017',
    bg: '#fefce8',
    border: '#d4a017',
    topBar: 'linear-gradient(90deg,#d4a017,#f59e0b,#d4a017)',
    badge: '🎆 ',
    ctaText: 'Start the year right',
    subjectPrefix: '🎆 ',
  },
  valentine: {
    deco: '💕❤️💕❤️💕',
    accent: '#e91e63',
    bg: '#fce4ec',
    border: '#e91e63',
    topBar: 'linear-gradient(90deg,#e91e63,#f48fb1,#e91e63)',
    badge: '💝 ',
    ctaText: 'Treat yourself',
    subjectPrefix: '💕 ',
  },
  independence: {
    deco: '🇳🇬💚🤍💚🇳🇬',
    accent: '#008751',
    bg: '#ecfdf5',
    border: '#008751',
    topBar: 'linear-gradient(90deg,#008751,#ffffff,#008751)',
    badge: '🇳🇬 ',
    ctaText: 'Celebrate with savings',
    subjectPrefix: '🇳🇬 ',
  },
  eid: {
    deco: '🌙✨☪️✨🌙',
    accent: '#1b5e20',
    bg: '#e8f5e9',
    border: '#1b5e20',
    topBar: 'linear-gradient(90deg,#1b5e20,#c8a951,#1b5e20)',
    badge: '🌙 ',
    ctaText: 'Eid Mubarak — order now',
    subjectPrefix: '🌙 ',
  },
  easter: {
    deco: '🐣🌷🥚🌷🐣',
    accent: '#7c3aed',
    bg: '#f5f3ff',
    border: '#7c3aed',
    topBar: 'linear-gradient(90deg,#7c3aed,#a78bfa,#7c3aed)',
    badge: '🐣 ',
    ctaText: 'Hop on this deal',
    subjectPrefix: '🐣 ',
  },
  blackfriday: {
    deco: '🖤🔥💰🔥🖤',
    accent: '#1a1a1a',
    bg: '#f5f5f5',
    border: '#1a1a1a',
    topBar: 'linear-gradient(90deg,#1a1a1a,#d4a017,#1a1a1a)',
    badge: '🔥 ',
    ctaText: 'Grab the deal',
    subjectPrefix: '🔥 ',
  },
  sallah: {
    deco: '🐏✨🌙✨🐏',
    accent: '#6d4c1d',
    bg: '#fef3c7',
    border: '#6d4c1d',
    topBar: 'linear-gradient(90deg,#6d4c1d,#c8a951,#6d4c1d)',
    badge: '🐏 ',
    ctaText: 'Sallah savings await',
    subjectPrefix: '🐏 ',
  },
};

export async function sendPromotionBlast(campaign) {
  const { name: promotionName, discountPercent, bannerCopy, bannerColor, maxDiscountPerOrder, endAt, emailTheme } = campaign;
  const users = await prisma.user.findMany({
    where: { status: 'Active', notifPromo: true, emailVerified: true },
    select: { email: true, name: true },
  });
  if (!users.length) return 0;

  const theme = EMAIL_THEMES[emailTheme] || null;
  const color = theme?.accent || bannerColor || '#c47d8e';
  const bgColor = theme?.bg || (color + '18');
  const endsStr = endAt ? new Date(endAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  const capStr = maxDiscountPerOrder ? `Up to ₦${(maxDiscountPerOrder / 100).toLocaleString()} off per order.` : '';
  const decoRow = theme ? `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 16px;font-size:24px;letter-spacing:8px;">${theme.deco}</td></tr></table>` : '';
  const topBarStyle = theme?.topBar || color;

  const subjectPrefix = theme?.subjectPrefix || '';
  const subject = `${subjectPrefix}${promotionName} is live | ${discountPercent}% off all orders`;

  const htmlTemplate = await promoEmailWrap({
    label: `${theme?.badge || ''}Promotion`,
    labelBg: bgColor,
    labelColor: color,
    topBar: topBarStyle,
    title: promotionName,
    body: `
      ${decoRow}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" style="padding:20px 24px;background:${bgColor};border-radius:14px;border:1px solid ${color}20;">
        <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:${color};">${discountPercent}% OFF</div>
        <div style="font-size:14px;color:${color};margin-top:6px;">${bannerCopy || 'All services, limited time'}</div>
      </td></tr></table>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Place an order now and the discount is applied automatically at checkout. No codes needed.${capStr ? ' ' + capStr : ''}${endsStr ? ` Ends ${endsStr}.` : ''}</p>
      ${emailCTA('https://nitro.ng/dashboard', theme?.ctaText || 'Order now')}
      ${decoRow ? `<div style="margin-top:16px;">${decoRow}</div>` : ''}
    `,
  });

  let sent = 0;
  for (const user of users) {
    const personalised = htmlTemplate.replace('</h1>', `</h1>\n      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 4px;">Hi ${user.name || 'there'},</p>`);
    try {
      await sendEmail(user.email, subject, personalised, `${promotionName} — ${discountPercent}% off all orders at Nitro. Order now: https://nitro.ng/dashboard`);
      sent++;
    } catch {}
  }
  console.log(`[Email] Promotion blast: ${sent}/${users.length} sent for "${promotionName}"`);
  return sent;
}

async function promoEmailWrap({ label, labelBg, labelColor, topBar, title, body }) {
  const socials = await getSocials();
  const barCss = topBar.startsWith('linear') ? `background:${topBar}` : `background-color:${topBar}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark}
@media(prefers-color-scheme:dark){
.em-body{background:#1a1a2e!important}
.em-card{background:#222240!important;border-color:#3a3a50!important}
.em-h{color:#f0ece6!important}
.em-t{color:#e0dcd6!important}
.em-m{color:#a09b95!important}
.em-db{background:#2a2a44!important}
.em-dbb{border-color:#3a3a50!important}
.em-sb{background:#2a2a44!important}
.em-div{background:#3a3a50!important}
}
</style>
</head>
<body class="em-body" style="margin:0;padding:0;background:#f6f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="em-body" style="background:#f6f3ef;">
<tr><td align="center" style="padding:40px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" class="em-card" style="max-width:520px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ebe6df;">

    <!-- Header: Logomark + Wordmark -->
    <tr><td align="center" style="padding:36px 32px 0;">
      <img src="https://nitro.ng/icon-192.png" width="44" height="44" alt="Nitro" style="display:block;border-radius:13px;" />
      <p style="margin:10px 0 0;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c47d8e;">NITRO</p>
    </td></tr>

    <!-- Themed accent bar -->
    <tr><td style="padding:20px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="height:4px;${barCss};font-size:1px;line-height:1px;">&nbsp;</td>
      </tr></table>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:28px 32px 36px;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:6px;background:${labelBg};color:${labelColor};">${label}</td>
      </tr></table>
      <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:16px 0 10px;line-height:1.3;">${title}</h1>
      ${body}
    </td></tr>

    <!-- Footer divider -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 32px;"><div style="height:1px;background:#ece7e0;"></div></td>
      </tr></table>
      ${socialFooter(socials)}
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="padding:4px 32px 28px;">
          <p style="font-size:12px;font-weight:500;color:#b0a9a2;margin:0;">Your growth, simplified</p>
        </td>
      </tr></table>
    </td></tr>

  </table>

  <table cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;"><tr>
    <td align="center" style="padding:20px 0 0;">
      <p style="font-size:11px;color:#b5b0aa;margin:0;">You received this because you have a Nitro account.<br/><a href="https://nitro.ng/dashboard?page=settings#set-notifications" style="color:#c47d8e;text-decoration:underline;">Manage preferences</a></p>
    </td>
  </tr></table>

</td></tr>
</table>
</body></html>`;
}

// ═══ WIN-BACK EMAIL (new users who haven't deposited) ═══
export async function sendWinbackEmail(name, to) {
  const subject = "We're giving you ₦500. For real.";
  const html = await emailWrap({
    label: 'Special Offer', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'Your ₦500 is waiting',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hey ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">You signed up for Nitro but haven't made your first move yet.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 26px;">So here's a little push: <strong>₦500 free</strong> when you make your first deposit of ₦2,000 or more.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:16px;border:2px dashed #b45309;">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin:0 0 10px;">Your Code</div>
          <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;color:#92400e;letter-spacing:5px;">NITRO500</div>
          <div style="font-size:14px;color:#b45309;margin-top:10px;">₦500 added to your wallet instantly</div>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td class="em-db" style="padding:18px 20px;background:#faf8f5;border-radius:12px;">
          <p class="em-t" style="font-size:14px;line-height:2;color:#555;margin:0;">
            1. Go to your dashboard<br/>
            2. Fund your wallet (₦2,000 minimum)<br/>
            3. Enter code <strong style="color:#92400e;">NITRO500</strong><br/>
            4. Get ₦500 added on the spot
          </p>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td align="center" style="padding:14px 20px;background:#fef2f2;border-radius:12px;">
          <p style="font-size:14px;font-weight:700;color:#dc2626;margin:0;">This offer expires in 72 hours</p>
        </td></tr>
      </table>

      ${emailCTA('https://nitro.ng/dashboard?page=wallet', 'Claim your ₦500')}
      <p class="em-m" style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Thousands of creators already use Nitro to grow. Your turn.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hey ${name}, we're giving you ₦500 free. Use code NITRO500 on your first deposit of ₦2,000+ at nitro.ng/dashboard`);
}

// ═══ BULK ORDER COMPLETION ═══
export async function batchCompletionEmail(name, batchId, completed, partial, cancelled, refunded) {
  let rows = emailRow('Completed', completed, '#059669');
  if (partial > 0) rows += emailRow('Partial', partial, '#d97706');
  if (cancelled > 0) rows += emailRow('Cancelled', cancelled, '#dc2626');
  if (refunded > 0) rows += emailRow('Refunded', `₦${refunded.toLocaleString()}`, '#059669');

  return await emailWrap({
    label: 'Batch Complete', labelBg: 'rgba(34,197,94,.1)', labelColor: '#22c55e',
    title: `Batch ${batchId} complete`,
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">All orders in your batch have finished processing. Here's how it went:</p>
      ${emailDataBox(rows)}
      ${emailCTA('https://nitro.ng/dashboard', 'View orders')}
    `,
  });
}

// ═══ RETENTION: funded wallet, no orders ═══
export async function sendNudgeIdleFunds(name, to, balance) {
  const subject = "Your wallet is funded. Ready to go?";
  const html = await emailWrap({
    label: 'Reminder', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: 'You have funds waiting',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">You added money to your Nitro wallet a little while back, but you haven't placed your first order yet.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td align="center" style="padding:20px 24px;background:#ecfdf5;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#059669;">₦${balance.toLocaleString()}</div>
        <div style="font-size:13px;color:#059669;margin-top:6px;">Available in your wallet</div>
      </td></tr></table>

      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">That's more than enough to get started. Pick a platform, choose what you need, and Nitro handles the rest. Most orders start delivering within a minute.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Place your first order')}
      <p class="em-m" style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Not sure where to start? Instagram followers and TikTok views are the most popular picks.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ₦${balance.toLocaleString()} in your Nitro wallet. Place your first order: https://nitro.ng/dashboard`);
}

// ═══ RETENTION: ordered once, quiet 7+ days ═══
export async function sendNudgeComeback(name, to) {
  const subject = "Ready for round 2?";
  const html = await emailWrap({
    label: 'Check In', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: 'Your last order landed',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">Your last Nitro order was delivered successfully. But you haven't been back since.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">One push is good, but steady growth is what actually moves the needle. The creators who get real results on Nitro are the ones who stay consistent.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Order again')}
      <p class="em-m" style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Same speed. Same dashboard. Same results.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, your last order went well. Ready to keep the momentum going? https://nitro.ng/dashboard`);
}

// ═══ RETENTION: was active, gone 14+ days ═══
export async function sendNudgeLapsed(name, to) {
  const subject = "It's been a minute";
  const html = await emailWrap({
    label: 'We Miss You', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: "Been a while",
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">We noticed you haven't placed an order in a while.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 22px;">Nothing's changed on our end. Same fast delivery, same platforms, same prices. Whenever you're ready, your dashboard is right where you left it.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">And if something wasn't right with your last experience, we'd genuinely like to hear about it.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Back to your dashboard')}
      <p class="em-m" style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Just reply to this email if you need anything. Real person on the other end.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, it's been a while. Your Nitro dashboard is ready when you are: https://nitro.ng/dashboard`);
}

// ═══ RETENTION: has balance, no orders in 7+ days ═══
export async function sendNudgeIdleBalance(name, to, balance) {
  const subject = `You've still got ₦${balance.toLocaleString()} in your wallet`;
  const html = await emailWrap({
    label: 'Reminder', labelBg: '#ecfdf5', labelColor: '#059669',
    title: 'Your wallet is still loaded',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 6px;">Hi ${name},</p>
      <div style="height:12px;"></div>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Quick heads up: you have money sitting in your Nitro wallet that hasn't been touched in over a week.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td align="center" style="padding:20px 24px;background:#ecfdf5;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#059669;">₦${balance.toLocaleString()}</div>
        <div style="font-size:13px;color:#059669;margin-top:6px;">Available in your wallet</div>
      </td></tr></table>

      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 28px;">Your money, your timeline. But if you're looking to give your content a push, everything is already set up and ready to go.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Use your balance')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ₦${balance.toLocaleString()} in your Nitro wallet. Put it to work: https://nitro.ng/dashboard`);
}
