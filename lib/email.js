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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">Welcome aboard. Thousands of Nigerian creators and businesses use Nitro to get the visibility their content deserves, and now you've got access too.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Top up your wallet, pick what you need, and watch things move. Most orders start delivering in seconds.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Go to your dashboard')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="padding:14px 16px;background:#faf8f5;border-radius:12px;">
        <p style="font-size:14px;line-height:1.6;color:#555;margin:0;">💡 <strong>Know someone building their brand?</strong> Share your referral link and you both earn a bonus when they make their first deposit.</p>
      </td></tr></table>
      <p style="font-size:13px;color:#999;margin:0;">Need anything? We're at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a>, real people, quick replies.</p>
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, we received a request to reset your password. Click the button below to choose a new one:</p>
      ${emailCTA(resetUrl, 'Reset password')}
      <p style="font-size:13px;color:#999;text-align:center;margin:16px 0 4px;">This link expires in 30 minutes.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="padding:0;font-size:11px;color:#bbb;word-break:break-all;overflow-wrap:break-word;">
          Can't click the button? <a href="${resetUrl}" style="color:#c47d8e;text-decoration:underline;">Copy this link</a>
        </td>
      </tr></table>
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your Nitro wallet has been topped up:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" style="padding:16px 24px;background:#ecfdf5;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#059669;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#059669;margin-top:4px;">Added to your wallet</div>
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your Nitro account has been scheduled for permanent deletion in <strong>${daysLeft} days</strong>.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">If this was a mistake, contact us at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a> to cancel the deletion.</p>
      <p style="font-size:13px;color:#999;margin:0;">After deletion, your data cannot be recovered.</p>
    `,
  });
}

// ═══ LEADERBOARD REWARD ═══
export async function leaderboardRewardEmail(name, amount) {
  return await emailWrap({
    label: 'Reward', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'You received a reward!',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, congratulations on making it to the Nitro leaderboard!</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" style="padding:16px 24px;background:#fef3c7;border-radius:14px;">
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#b45309;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#b45309;margin-top:4px;">Leaderboard reward</div>
      </td></tr></table>
      ${emailCTA('https://nitro.ng/dashboard', 'View your wallet')}
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your bulk order has been submitted.</p>
      ${emailDataBox(rows)}
      ${failed > 0 ? '<p style="font-size:13px;color:#888;margin:0 0 20px;">Pending orders will be retried automatically. If they can\'t be placed, you\'ll be refunded.</p>' : ''}
      ${emailCTA('https://nitro.ng/dashboard', 'View Orders')}
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Place an order now and the discount is applied automatically at checkout. No codes needed.${capStr ? ' ' + capStr : ''}${endsStr ? ` Ends ${endsStr}.` : ''}</p>
      ${emailCTA('https://nitro.ng/dashboard', theme?.ctaText || 'Order now')}
      ${decoRow ? `<div style="margin-top:16px;">${decoRow}</div>` : ''}
    `,
  });

  let sent = 0;
  for (const user of users) {
    const personalised = htmlTemplate.replace('</h1>', `</h1>\n      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 4px;">Hi ${user.name || 'there'},</p>`);
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

// ═══ WIN-BACK EMAIL ═══
export async function sendWinbackEmail(name, to) {
  const subject = "We're giving you ₦500 free. Seriously.";
  const html = await emailWrap({
    label: 'Special Offer', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'Your ₦500 is waiting',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">Hey ${name},</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">We noticed you signed up but haven't placed your first order yet.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">So we're putting <strong>₦500</strong> on the table for you.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Use this code when you make your first deposit of ₦2,000 or more:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:16px;border:2px dashed #b45309;">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin:0 0 10px;">Your Promo Code</div>
          <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;color:#92400e;letter-spacing:5px;">NITRO500</div>
          <div style="font-size:14px;color:#b45309;margin-top:10px;">₦500 bonus on your first deposit</div>
        </td></tr>
      </table>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 10px;">Here's how it works:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr><td style="padding:16px 20px;background:#faf8f5;border-radius:12px;">
          <p style="font-size:14px;line-height:1.8;color:#555;margin:0;">
            1. Head to your dashboard<br/><br/>
            2. Fund your wallet with ₦2,000 or more<br/><br/>
            3. Enter code <strong style="color:#92400e;">NITRO500</strong> at checkout<br/><br/>
            4. Get an extra ₦500 added instantly
          </p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr><td align="center" style="padding:14px 20px;background:#fef2f2;border-radius:12px;">
          <p style="font-size:14px;font-weight:700;color:#dc2626;margin:0;">This offer expires in 72 hours</p>
        </td></tr>
      </table>
      ${emailCTA('https://nitro.ng/dashboard?page=wallet', 'Claim your ₦500 now')}
      <p style="font-size:13px;color:#999;margin:20px 0 0;text-align:center;">Thousands of creators are already growing with Nitro. Your turn.</p>
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
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, all orders in your batch have finished processing.</p>
      ${emailDataBox(rows)}
      ${emailCTA('https://nitro.ng/dashboard', 'View Orders')}
    `,
  });
}
