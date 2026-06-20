import { fetchWithRetry } from '@/lib/fetch';
import prisma from '@/lib/prisma';
import { SITE } from '@/lib/site';
import { signUnsubToken } from '@/lib/unsubscribe';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'Ify from Nitro';

function tint(hex, p) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  const mix = x => Math.round(x * p + 255 * (1 - p));
  const h = n => n.toString(16).padStart(2, '0');
  return '#' + h(mix(r)) + h(mix(g)) + h(mix(b));
}

function unsubUrl(email) {
  return `${SITE.url}/unsubscribe?token=${signUnsubToken(email)}`;
}

function unsubHeaders(email) {
  const url = unsubUrl(email);
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

// ═══ EMAIL LAYOUT HELPERS ═══

export function emailRow(label, value, valueColor = '#333') {
  return `<tr>
    <td class="em-m em-dbb" style="padding:9px 0;font-size:13px;color:#918b85;border-bottom:1px solid #f0ece6;">${label}</td>
    <td class="em-dbb" align="right" style="padding:9px 0;font-size:13px;font-weight:700;color:${valueColor};border-bottom:1px solid #f0ece6;">${value}</td>
  </tr>`;
}

export function emailDataBox(rows, accent = '#c47d8e') {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td class="em-mod" style="background:#faf7f4;border-radius:14px;border-left:3px solid ${accent};padding:2px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`;
}

export function emailCTA(href, text) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:340px;"><tr>
      <td align="center" style="background:#c47d8e;border-radius:14px;">
        <a class="em-cta-a" href="${href}" style="display:inline-block;color:#fff;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:.2px;padding:16px 34px;">${text}</a>
      </td>
    </tr></table>
  </td></tr></table>`;
}

export function amountBlock(accent, big, caption) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td align="center" class="em-mod" style="padding:20px 24px;background:${tint(accent, 0.12)};border-radius:16px;">
    <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:${accent};">${big}</div>
    <div style="font-size:13px;color:${accent};margin-top:6px;">${caption}</div>
  </td></tr></table>`;
}

// ═══ BRANDED EMAIL WRAPPER ═══
export function emailWrap({ accent: accentOverride, body }) {
  const accent = accentOverride || '#c47d8e';
  const heroBg = tint(accent, 0.09);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark}
@media(prefers-color-scheme:dark){
.em-body{background:#15151f!important}
.em-card{background:#1e1e30!important;border-color:#33334a!important}
.em-hero{background:#252438!important}
.em-h{color:#f4eff0!important}
.em-t{color:#cfc8cf!important}
.em-m{color:#9a93a0!important}
.em-mod{background:#26263c!important;border-color:#33334a!important}
.em-dbb{border-color:#33334a!important}
.em-div{background:#33334a!important}
.em-wm{display:block!important}
.em-wm-dark{display:none!important}
}
@media only screen and (max-width:600px){
.em-shell{padding:16px 8px!important}
.em-pad{padding-left:22px!important;padding-right:22px!important}
.em-herotop{padding:30px 22px 0!important}
.em-cta-a{display:block!important;padding:16px 18px!important}
.stack{display:block!important;width:100%!important;border:0!important;padding:7px 0!important}
}
</style>
</head>
<body class="em-body" style="margin:0;padding:0;background:#e9e4dd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="em-body" style="background:#e9e4dd;">
<tr><td align="center" class="em-shell" style="padding:14px 16px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" class="em-card" style="max-width:520px;width:100%;background:#fff;border-radius:22px;border:1px solid #e7e0d8;overflow:hidden;">

    <tr><td class="em-hero em-herotop" align="center" style="background:${heroBg};padding:34px 32px 28px;">
      <img src="https://nitro.ng/wordmark-accent.png" width="120" height="37" alt="Nitro" class="em-wm" style="display:block;margin:0 auto;" />
    </td></tr>

    <tr><td class="em-pad" style="padding:28px 34px 36px;">
      ${body}
    </td></tr>

  </table>

  <table cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;"><tr>
    <td align="center" style="padding:18px 0 0;">
      <p style="font-size:11px;color:#b5b0aa;margin:0;line-height:1.6;">You're receiving this because you have a Nitro account.<br/><a href="{{UNSUB_URL}}" style="color:${accent};">Unsubscribe</a></p>
    </td>
  </tr></table>

</td></tr>
</table>
</body></html>`;
}

// ═══ SEND EMAIL VIA BREVO ═══
export async function sendEmail(to, subject, html, text = '', emailHeaders) {
  if (!BREVO_KEY) {
    console.warn('[Email] BREVO_API_KEY not set — logging email instead');
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }
  const finalHtml = html.replace(/\{\{UNSUB_URL\}\}/g, unsubUrl(to));
  const hdrs = { ...unsubHeaders(to), ...emailHeaders };
  try {
    const payload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: finalHtml,
      textContent: text || subject,
      headers: hdrs,
    };
    const res = await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
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
  const html = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Thousands of Nigerian creators and businesses use Nitro to grow their content. Now you've got the same tools they do.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Fund your wallet, pick what you need, and you are off. Most orders start delivering within seconds.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Go to your dashboard')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td class="em-mod" style="padding:16px 18px;background:#faf7f4;border:1px solid #f0e9e1;border-radius:14px;">
        <p class="em-t" style="font-size:14px;line-height:1.7;color:#555;margin:0;">Got a friend building their brand? Share your referral link from your dashboard. You both earn a bonus when they make their first deposit.</p>
      </td></tr></table>
    `,
  });
  return sendEmail(to, subject, html, `Welcome to Nitro, ${name}! Head to your dashboard: https://nitro.ng/dashboard`);
}

// ═══ PASSWORD RESET ═══
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = emailWrap({
    accent: '#dc2626',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Someone requested a password reset for your account. If that was you, tap the button below to choose a new one.</p>
      ${emailCTA(resetUrl, 'Reset password')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">This link expires in 30 minutes.</p>
      <p class="em-m" style="font-size:13px;color:#bbb;text-align:center;margin:6px 0 0;">If you didn't request this, just ignore this email. Your password won't change.</p>
    `,
  });
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

// ═══ WALLET CREDIT ═══
export function walletCreditEmail(name, amount, reason) {
  return emailWrap({
    accent: '#059669',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">${reason || 'Your Nitro wallet just got a top up.'}</p>
      ${amountBlock('#059669', '+₦' + amount.toLocaleString(), 'Added to your wallet')}
      ${emailCTA('https://nitro.ng/dashboard', 'Check your balance')}
    `,
  });
}

// ═══ ACCOUNT DELETION ═══
export function accountDeletionEmail(name, daysLeft) {
  return emailWrap({
    accent: '#dc2626',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Your Nitro account has been scheduled for permanent deletion in <strong>${daysLeft} days</strong>.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">All your data, order history, and wallet balance will be removed permanently after this period.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0;">If this was a mistake or you changed your mind, reach out to us at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a> and we'll cancel it right away.</p>
    `,
  });
}

// ═══ LEADERBOARD REWARD ═══
export function leaderboardRewardEmail(name, amount) {
  return emailWrap({
    accent: '#b45309',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Nice one. You made the Nitro leaderboard this month and the reward is already in your wallet.</p>
      ${amountBlock('#b45309', '+₦' + amount.toLocaleString(), 'Leaderboard reward')}
      ${emailCTA('https://nitro.ng/dashboard', 'View your wallet')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Keep it going. The leaderboard resets every month.</p>
    `,
  });
}

// ═══ BULK ORDER PLACEMENT ═══
export function batchPlacementEmail(name, batchId, total, placed, failed, totalCharge) {
  let rows = emailRow('Batch', batchId) + emailRow('Total orders', total) + emailRow('Processing', placed, '#059669');
  if (failed > 0) rows += emailRow('Pending retry', failed, '#d97706');
  rows += `<tr><td colspan="2" style="padding:0;"><div style="height:1px;background:#f0ece6;margin:4px 0;"></div></td></tr>`;
  rows += emailRow('Total charged', `₦${totalCharge.toLocaleString()}`, '#1a1a1a');

  return emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Your bulk order has been submitted and is now processing.</p>
      ${emailDataBox(rows)}
      ${failed > 0 ? '<p class="em-m" style="font-size:13px;color:#9a948d;margin:0 0 24px;">Orders that couldn\'t be placed immediately will be retried automatically. If they still don\'t go through, you\'ll be refunded.</p>' : ''}
      ${emailCTA('https://nitro.ng/dashboard', 'View orders')}
    `,
  });
}

// ═══ PROMOTIONAL CAMPAIGN ═══

const EMAIL_THEMES = {
  christmas: {
    accent: '#c0392b',
    bg: '#fdf2f2',
    topBar: 'linear-gradient(90deg,#c0392b,#27ae60,#c0392b)',
    ctaText: 'Unwrap your discount',
  },
  newyear: {
    accent: '#d4a017',
    bg: '#fefce8',
    topBar: 'linear-gradient(90deg,#d4a017,#f59e0b,#d4a017)',
    ctaText: 'Start the year right',
  },
  valentine: {
    accent: '#e91e63',
    bg: '#fce4ec',
    topBar: 'linear-gradient(90deg,#e91e63,#f48fb1,#e91e63)',
    ctaText: 'Treat yourself',
  },
  independence: {
    accent: '#008751',
    bg: '#ecfdf5',
    topBar: 'linear-gradient(90deg,#008751,#ffffff,#008751)',
    ctaText: 'Celebrate with savings',
  },
  eid: {
    accent: '#1b5e20',
    bg: '#e8f5e9',
    topBar: 'linear-gradient(90deg,#1b5e20,#c8a951,#1b5e20)',
    ctaText: 'Eid Mubarak, order now',
  },
  easter: {
    accent: '#7c3aed',
    bg: '#f5f3ff',
    topBar: 'linear-gradient(90deg,#7c3aed,#a78bfa,#7c3aed)',
    ctaText: 'Hop on this deal',
  },
  blackfriday: {
    accent: '#1a1a1a',
    bg: '#f5f5f5',
    topBar: 'linear-gradient(90deg,#1a1a1a,#d4a017,#1a1a1a)',
    ctaText: 'Grab the deal',
  },
  sallah: {
    accent: '#6d4c1d',
    bg: '#fef3c7',
    topBar: 'linear-gradient(90deg,#6d4c1d,#c8a951,#6d4c1d)',
    ctaText: 'Sallah savings await',
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

  const subject = `${promotionName} is live | ${discountPercent}% off all orders`;

  let sent = 0;
  for (const user of users) {
    const html = emailWrap({
      accent: color,
      body: `
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${user.name || 'there'},</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" style="padding:20px 24px;background:${bgColor};border-radius:14px;border:1px solid ${color}20;">
          <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:${color};">${discountPercent}% OFF</div>
          <div style="font-size:14px;color:${color};margin-top:6px;">${bannerCopy || 'All services, limited time'}</div>
        </td></tr></table>
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Place an order now and the discount is applied automatically at checkout. No codes needed.${capStr ? ' ' + capStr : ''}${endsStr ? ` Ends ${endsStr}.` : ''}</p>
        ${emailCTA('https://nitro.ng/dashboard', theme?.ctaText || 'Order now')}
      `,
    });
    try {
      await sendEmail(user.email, subject, html, `${promotionName} — ${discountPercent}% off all orders at Nitro. Order now: https://nitro.ng/dashboard`);
      sent++;
    } catch {}
  }
  console.log(`[Email] Promotion blast: ${sent}/${users.length} sent for "${promotionName}"`);
  return sent;
}


// ═══ WIN-BACK EMAIL (new users who haven't deposited) ═══
export function sendWinbackEmail(name, to) {
  const subject = "We're giving you ₦500. For real.";
  const html = emailWrap({
    accent: '#b45309',
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hey ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">You signed up for Nitro but haven't made your first move yet.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 26px;">So here's a little push: <strong>₦500 free</strong> when you make your first deposit of ₦2,000 or more.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:16px;border:2px dashed #b45309;">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin:0 0 10px;">Your Code</div>
          <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;color:#92400e;letter-spacing:5px;">NITRO500</div>
          <div style="font-size:14px;color:#b45309;margin-top:10px;">₦500 added to your wallet instantly</div>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td class="em-mod" style="padding:18px 20px;background:#faf7f4;border:1px solid #f0e9e1;border-radius:14px;">
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
export function batchCompletionEmail(name, batchId, completed, partial, cancelled, refunded) {
  let rows = emailRow('Completed', completed, '#059669');
  if (partial > 0) rows += emailRow('Partial', partial, '#d97706');
  if (cancelled > 0) rows += emailRow('Cancelled', cancelled, '#dc2626');
  if (refunded > 0) rows += emailRow('Refunded', `₦${refunded.toLocaleString()}`, '#059669');

  return emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">All orders in your batch have finished processing. Here is how it went:</p>
      ${emailDataBox(rows)}
      ${emailCTA('https://nitro.ng/dashboard', 'View orders')}
    `,
  });
}

// ═══ RETENTION: funded wallet, no orders ═══
export function sendNudgeIdleFunds(name, to, balance) {
  const subject = "Your wallet is funded. Ready to go?";
  const html = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">You added money to your Nitro wallet a little while back, but you haven't placed your first order yet.</p>
      ${amountBlock('#059669', '₦' + balance.toLocaleString(), 'Available in your wallet')}
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">That is more than enough to get started. Pick a platform, choose what you need, and Nitro handles the rest. Most orders start delivering within a minute.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Place your first order')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Not sure where to start? Instagram followers and TikTok views are the most popular picks.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ₦${balance.toLocaleString()} in your Nitro wallet. Place your first order: https://nitro.ng/dashboard`);
}

// ═══ RETENTION: ordered once, quiet 7+ days ═══
export function sendNudgeComeback(name, to) {
  const subject = "Your next order is one tap away";
  const html = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Your last Nitro order was delivered successfully. But you haven't been back since.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">One push is good, but steady growth is what actually moves the needle. The creators who get real results on Nitro are the ones who stay consistent.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Order again')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Same speed. Same dashboard. Same results.</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, your last order went well. Ready to keep the momentum going? https://nitro.ng/dashboard`);
}

// ═══ RETENTION: was active, gone 14+ days ═══
export function sendNudgeLapsed(name, to) {
  const subject = "Your Nitro dashboard misses you";
  const html = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">We noticed you haven't placed an order in a while.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Nothing has changed on our end. Same fast delivery, same platforms, same prices. Whenever you're ready, your dashboard is right where you left it.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">And if something was not right with your last experience, we'd genuinely like to hear about it.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Back to your dashboard')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Need help? Reach us at support@nitro.ng</p>
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, it's been a while. Your Nitro dashboard is ready when you are: https://nitro.ng/dashboard`);
}

// ═══ RETENTION: has balance, no orders in 7+ days ═══
export function sendNudgeIdleBalance(name, to, balance) {
  const subject = `You've still got ₦${balance.toLocaleString()} in your wallet`;
  const html = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Quick heads up: you have money sitting in your Nitro wallet that hasn't been touched in over a week.</p>
      ${amountBlock('#059669', '₦' + balance.toLocaleString(), 'Available in your wallet')}
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Your money, your timeline. But if you are looking to give your content a push, everything is already set up and ready to go.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=order', 'Use your balance')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ₦${balance.toLocaleString()} in your Nitro wallet. Put it to work: https://nitro.ng/dashboard`);
}

// ═══ GRADUAL DELIVERY ANNOUNCEMENT ═══
export function gradualDeliveryAnnouncementEmail(name) {
  return emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${name},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hope you're having a good weekend.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Quick update: we've changed how orders are delivered on Nitro. Instead of everything arriving at once, your orders now come in gradually throughout the day. This makes your growth look more natural and keeps your account safer.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">It means delivery takes a few hours instead of minutes, but you can track everything in real time on your dashboard, including an estimated delivery time on each order.</p>
      ${emailCTA('https://nitro.ng/dashboard', 'Go to your dashboard')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">If anything looks off, tap Support in your dashboard and we'll sort it out.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:20px 0 0;">Enjoy the rest of your weekend!</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:4px 0 0;">Team Nitro</p>
    `,
  });
}

// ═══ AD ACTIVATION SEQUENCE ═══

const PREHEADER_PAD = '&zwnj;&nbsp;'.repeat(30);

function preheader(text) {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${text}${PREHEADER_PAD}</div>`;
}

export function sendAdActivationDay1(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const body = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${firstName},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">You came to Nitro for one reason: to get your content in front of more people. You're one step away from doing exactly that.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Fund your wallet and your first deposit unlocks <strong style="color:#1a1a1a;">up to ₦3,000 in free promo credit</strong>. Real reach, a real Nigerian audience, delivery that starts in seconds.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td class="em-mod" style="background:#faf7f4;border:1px solid #f0e9e1;border-radius:16px;padding:18px 18px 8px;">
        <p class="em-m" style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#a39a92;text-align:center;">The more you add, the bigger the push</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="stack" width="33%" align="center" valign="top" style="padding:0 5px 12px;">
            <div style="border:1px solid #ece4db;border-radius:12px;padding:12px 4px;">
              <div class="em-h" style="font-size:15px;font-weight:800;color:#1a1a1a;">₦2,500</div>
              <div style="margin-top:6px;font-size:12px;font-weight:800;color:#0a7d54;background:#e6f6ef;border-radius:7px;padding:4px 0;">+₦500 free</div>
            </div>
          </td>
          <td class="stack" width="34%" align="center" valign="top" style="padding:0 5px 12px;">
            <div style="border:2px solid #c47d8e;border-radius:12px;padding:12px 4px;background:#fdf4f7;">
              <div style="font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#fff;background:#c47d8e;border-radius:20px;display:inline-block;padding:2px 9px;margin-bottom:5px;">Best value</div>
              <div style="font-size:15px;font-weight:800;color:#a3506a;">₦5,000</div>
              <div style="margin-top:6px;font-size:12px;font-weight:800;color:#0a7d54;background:#e6f6ef;border-radius:7px;padding:4px 0;">+₦1,200 free</div>
            </div>
          </td>
          <td class="stack" width="33%" align="center" valign="top" style="padding:0 5px 12px;">
            <div style="border:1px solid #ece4db;border-radius:12px;padding:12px 4px;">
              <div class="em-h" style="font-size:15px;font-weight:800;color:#1a1a1a;">₦10,000</div>
              <div style="margin-top:6px;font-size:12px;font-weight:800;color:#0a7d54;background:#e6f6ef;border-radius:7px;padding:4px 0;">+₦3,000 free</div>
            </div>
          </td>
        </tr></table>
      </td></tr></table>
      ${emailCTA('https://nitro.ng/dashboard?page=add-funds', 'Add funds and push my content')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Real engagement. Fast start. No foreign wahala.</p>
    `,
  });
  const html = preheader("You're in. One quick step to give it a real push, up to ₦3,000 free.") + body;
  return sendEmail(to, 'Your content is still waiting to be seen', html,
    `Hi ${firstName}, you're one step from getting your content seen. Fund your wallet and get up to N3,000 in free credit. Start here: https://nitro.ng/dashboard?page=add-funds`);
}

export function sendAdActivationDay3(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const body = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${firstName},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Totally fair to be cautious. Plenty of "growth" tools out there are smoke, so don't take our word for it.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 26px;">Start with as little as <strong style="color:#1a1a1a;">₦500</strong>, point it at one post, and watch what happens.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr>
        <td class="stack" width="33%" valign="top" align="center" style="padding:0 6px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#f7e9ee;color:#c47d8e;font-weight:800;font-size:14px;line-height:32px;margin:0 auto 9px;">1</div>
          <p class="em-t" style="margin:0;font-size:13px;line-height:1.45;color:#555;">Pick what to push</p>
        </td>
        <td class="stack" width="34%" valign="top" align="center" style="padding:0 6px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#f7e9ee;color:#c47d8e;font-weight:800;font-size:14px;line-height:32px;margin:0 auto 9px;">2</div>
          <p class="em-t" style="margin:0;font-size:13px;line-height:1.45;color:#555;">Paste your link</p>
        </td>
        <td class="stack" width="33%" valign="top" align="center" style="padding:0 6px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#f7e9ee;color:#c47d8e;font-weight:800;font-size:14px;line-height:32px;margin:0 auto 9px;">3</div>
          <p class="em-t" style="margin:0;font-size:13px;line-height:1.45;color:#555;">Watch it move, live</p>
        </td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td class="em-mod" style="background:#faf7f4;border-left:3px solid #c47d8e;border-radius:0 12px 12px 0;padding:16px 20px;">
        <p class="em-t" style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#444;font-style:italic;">"I was posting every week and getting nothing. Pushed one video with Nitro and it finally started moving."</p>
        <p class="em-m" style="margin:0;font-size:13px;font-weight:800;color:#a39a92;">Tunde, creator</p>
      </td></tr></table>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 26px;">Like what you see? Top up <strong style="color:#1a1a1a;">₦2,500 or more</strong> and up to ₦3,000 in free credit kicks in automatically.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=add-funds', 'Try it with ₦500')}
    `,
  });
  const html = preheader('Test Nitro small, watch your numbers move, then decide.') + body;
  return sendEmail(to, 'You can start with ₦500 (seriously)', html,
    `Hi ${firstName}, not sure about Nitro? Start with just N500, point it at one post, and watch what happens. Try it: https://nitro.ng/dashboard?page=add-funds`);
}

export function sendAdActivationDay6(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const body = emailWrap({
    body: `
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi ${firstName},</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">You signed up a few days ago and haven't taken Nitro for a spin yet. No pressure, and this is the last time we'll nudge you about it.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Here's the honest pitch. The creators, artists and brands who actually grow are the ones who put their content in front of people, instead of posting and hoping the algorithm notices. That is the whole job Nitro does.</p>
      <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 26px;">Your first deposit still gets <strong style="color:#1a1a1a;">up to ₦3,000 in free credit</strong> to start. If you've got a post, a song, or a page that deserves more eyes, this is your sign.</p>
      ${emailCTA('https://nitro.ng/dashboard?page=add-funds', 'Push my content now')}
      <p class="em-m" style="font-size:13px;color:#9a948d;margin:18px 0 0;text-align:center;">Not the right time? No wahala, you won't hear from us about this again.</p>
    `,
  });
  const html = preheader('Your free promo credit is still here. Your call.') + body;
  return sendEmail(to, "Last nudge, then we'll leave you be", html,
    `Hi ${firstName}, last nudge: your free promo credit is still waiting. Fund your wallet and get up to N3,000 free to push your content. Your call: https://nitro.ng/dashboard?page=add-funds`);
}
