import { fetchWithRetry } from './fetch.js';
import prisma from './prisma.js';
import { getWhatsAppChannelUrl } from './settings.js';
import { SITE } from './site.js';
import { signUnsubToken } from './unsubscribe.js';
import { BONUS_PRESETS } from './welcome-bonus.js';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'Ify from Nitro';

// ═══════════════════════════════════════════════════════════════════
// BRIGHT & BOLD EMAIL SYSTEM (redesign v2, Jul 2026)
// Copy source of truth: Marketing/Email Redesign v2/Email Copy.md
// Visual reference:     Marketing/Email Redesign v2/Bright and Bold Full Set.html
// All art/icons are hosted PNGs in /public/email (Gmail strips SVG).
// ═══════════════════════════════════════════════════════════════════

const A = `${SITE.url}/email`; // hosted asset base
const MONO = `'JetBrains Mono','SF Mono','Courier New',monospace`;

// Day tokens (inline defaults); dark handled by bb-* class overrides in <style>
const C = {
  canvas: '#f7ebe2', card: '#ffffff', cardBorder: '#f0ddd2', topline: '#f7ece4',
  ink: '#241f1d', body: '#5b544e', mut: '#a1988f',
  accent: '#d5688a', money: '#0a7d54',
  panel: '#fdf6f0', panelLine: '#f3e4d9',
};

const PILL_TONES = {
  rose:   ['#c4576f', '#fdf1f5'],
  green:  ['#0a7d54', '#e6f6ef'],
  amber:  ['#8a5200', '#fff4e2'],
  warm:   ['#b26a00', '#fff4e2'],
  purple: ['#5b4bc4', '#efecfd'],
  grey:   ['#6b5f57', '#f6efe8'],
  pink:   ['#93264a', '#fdeef3'],
  blue:   ['#1e5fb0', '#e7f0fd'],
};

const CTA_GRADS = {
  pink:   ['#e26a8d', '#c4576f', 'rgba(226,106,141,.32)'],
  green:  ['#3fb98a', '#0a7d54', 'rgba(10,125,84,.28)'],
  amber:  ['#f0a53c', '#d9821a', 'rgba(217,130,26,.3)'],
  red:    ['#ef6a6a', '#d34040', 'rgba(211,64,64,.28)'],
  purple: ['#8b7cf6', '#5b4bc4', 'rgba(91,75,196,.3)'],
};

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

const PREHEADER_PAD = '&zwnj;&nbsp;'.repeat(30);
export function preheader(text) {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${text}${PREHEADER_PAD}</div>`;
}

// ═══ BUILDING BLOCKS ═══

export function headline(html, size = 25) {
  return `<div class="bb-h" style="font-size:${size}px;line-height:1.16;font-weight:900;color:${C.ink};letter-spacing:-.4px;margin:0 0 12px;">${html}</div>`;
}

export function em(text) {
  return `<span class="bb-em" style="color:${C.accent};">${text}</span>`;
}

export function para(html, mb = 13) {
  return `<p class="bb-t" style="font-size:14px;line-height:1.7;color:${C.body};margin:0 0 ${mb}px;">${html}</p>`;
}

export function bold(text) {
  return `<strong class="bb-b" style="color:${C.ink};">${text}</strong>`;
}

export function mutedLine(html, align = 'center', mt = 12) {
  return `<p class="bb-m" style="font-size:11.5px;line-height:1.6;color:${C.mut};text-align:${align};margin:${mt}px 0 0;">${html}</p>`;
}

export function signOff() {
  return `<p class="bb-t" style="font-size:13px;color:${C.body};margin:16px 0 0;text-align:right;">&#8212; Ify, from Nitro</p>`;
}

export function headerRow(chip, title, size = 21) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 13px;"><tr>
    <td width="42" valign="middle"><img src="${A}/chip-${chip}.png" width="42" height="42" alt="" style="display:block;border-radius:14px;"/></td>
    <td valign="middle" style="padding-left:11px;"><div class="bb-h" style="font-size:${size}px;font-weight:900;color:${C.ink};letter-spacing:-.3px;">${title}</div></td>
  </tr></table>`;
}

export function emailCTA(href, text, variant = 'pink') {
  const [g1, g2, shadow] = CTA_GRADS[variant] || CTA_GRADS.pink;
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:320px;"><tr>
      <td align="center" style="background:${g2};background:linear-gradient(135deg,${g1},${g2});border-radius:99px;box-shadow:0 10px 24px ${shadow};">
        <a class="bb-cta" href="${href}" style="display:block;color:#ffffff;font-size:14.5px;font-weight:900;text-decoration:none;letter-spacing:.2px;padding:15px 20px;">${text}</a>
      </td>
    </tr></table>
  </td></tr></table>`;
}

export function ghostCTA(href, text) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:320px;"><tr>
      <td class="bb-panel" align="center" style="background:${C.panel};border-radius:99px;">
        <a class="bb-t" href="${href}" style="display:block;color:${C.body};font-size:14px;font-weight:800;text-decoration:none;padding:14px 20px;">${text}</a>
      </td>
    </tr></table>
  </td></tr></table>`;
}

export function emailRow(label, value, valueColor = '#333') {
  const v = valueColor === '#333' ? C.ink : valueColor;
  const cls = valueColor === '#059669' || valueColor === C.money ? 'bb-money' : (valueColor === '#333' ? 'bb-b' : '');
  return `<tr>
    <td class="bb-m bb-line" style="padding:10px 0;font-size:12.5px;color:${C.mut};border-bottom:1px solid ${C.panelLine};">${label}</td>
    <td class="${cls} bb-line" align="right" style="padding:10px 0;font-size:12.5px;font-weight:800;font-family:${MONO};color:${v};border-bottom:1px solid ${C.panelLine};">${value}</td>
  </tr>`;
}

export function emailDataBox(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="bb-panel" style="background:${C.panel};border-radius:14px;padding:3px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`;
}

export function amountBlock(accent, big, caption) {
  const green = accent === '#059669' || accent === C.money;
  const bg = green ? 'linear-gradient(135deg,#e8f8f0,#d8f3e6)' : `linear-gradient(135deg,${tint(accent, 0.14)},${tint(accent, 0.22)})`;
  const cap = green ? '#3f9c74' : tint(accent, 0.75);
  const color = green ? C.money : accent;
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td align="center" class="${green ? 'bb-amt' : ''}" style="padding:22px 20px;background:${tint(accent, 0.12)};background:${bg};border-radius:18px;">
    <div class="${green ? 'bb-amt-big' : ''}" style="font-family:${MONO};font-size:33px;font-weight:700;color:${color};">${big}</div>
    <div class="${green ? 'bb-amt-cap' : ''}" style="font-size:12px;font-weight:700;color:${cap};margin-top:5px;">${caption}</div>
  </td></tr></table>`;
}

export function ticketBlock({ label, big, note, variant = 'amber' }) {
  const v = variant === 'pink'
    ? { bg: 'linear-gradient(135deg,#ffc9d9,#ff9fbb)', flat: '#ffb3c9', lab: '#93264a', big: '#7c1f3e', note: '#93264a' }
    : { bg: 'linear-gradient(135deg,#ffd98e,#ffb85c)', flat: '#ffcb78', lab: '#8a5200', big: '#6d3f00', note: '#8a5200' };
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px;"><tr><td align="center" style="background:${v.flat};background:${v.bg};border-radius:18px;padding:20px;">
    <div style="font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${v.lab};margin-bottom:7px;">${label}</div>
    <div style="font-family:${MONO};font-size:31px;font-weight:700;color:${v.big};">${big}</div>
    <div style="font-size:12px;font-weight:700;color:${v.note};margin-top:7px;">${note}</div>
  </td></tr></table>`;
}

export function expiryStrip(daysLeft, dateStr) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="bb-exp" style="border:1.5px dashed #e8b46a;border-radius:12px;padding:9px 14px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="bb-exp-l" style="font-size:11.5px;font-weight:800;color:#8a5200;">&#9201;&nbsp; Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</td>
      <td class="bb-exp-d" align="right" style="font-family:${MONO};font-size:12px;font-weight:700;color:#b26a00;">${dateStr}</td>
    </tr></table>
  </td></tr></table>`;
}

export function stepsBlock(steps) {
  const rows = steps.map((s, i) => `<tr>
    <td width="22" style="padding:5.5px 0;"><div style="width:22px;height:22px;border-radius:50%;background:#c4576f;background:linear-gradient(135deg,#e26a8d,#c47d8e);color:#ffffff;font-size:11px;font-weight:800;text-align:center;line-height:22px;">${i + 1}</div></td>
    <td class="bb-t" style="padding:5.5px 0 5.5px 11px;font-size:12.5px;color:${C.body};">${s}</td>
  </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="bb-panel" style="background:${C.panel};border-radius:14px;padding:9px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr></table>`;
}

export function quoteBlock(text, who) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="bb-panel" style="background:${C.panel};border-radius:16px;padding:15px 18px;">
    <p class="bb-t" style="font-size:13.5px;line-height:1.6;color:#4c463f;font-style:italic;margin:0 0 8px;">&ldquo;${text}&rdquo;</p>
    <p class="bb-m" style="font-size:12px;font-weight:900;color:${C.mut};margin:0;">${who}</p>
  </td></tr></table>`;
}

export function warnBlock(html) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="bb-warn" style="background:#fff4ec;border:1px solid #ffdfc4;border-radius:14px;padding:13px 15px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="top"><img src="${A}/chip-warn.png" width="34" height="34" alt="" style="display:block;border-radius:11px;"/></td>
      <td class="bb-warn-t" style="padding-left:11px;font-size:12.5px;line-height:1.6;color:#7a5b3e;">${html}</td>
    </tr></table>
  </td></tr></table>`;
}

export function referCard() {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr><td class="bb-refer" style="background:#ffe9ee;background:linear-gradient(135deg,#fff1e4,#ffe4ec);border-radius:16px;padding:13px 16px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="38" valign="middle"><img src="${A}/chip-gift.png" width="38" height="38" alt="" style="display:block;border-radius:50%;"/></td>
      <td class="bb-refer-t" style="padding-left:12px;font-size:12px;line-height:1.55;color:#6b5f57;"><strong class="bb-b" style="color:${C.ink};">Bring a friend, both of you earn.</strong> Share your referral link and you both get a bonus on their first deposit.</td>
    </tr></table>
  </td></tr></table>`;
}

export function codeBlock(code) {
  const spaced = String(code).replace(/(\d{3})(\d{3})/, '$1 $2');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td align="center" class="bb-code" style="background:#fdf4f7;border:2px dashed #eec3cf;border-radius:18px;padding:20px;">
    <div class="bb-code-lab" style="font-size:9.5px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#c4708a;margin-bottom:9px;">Your code</div>
    <div class="bb-code-c" style="font-family:${MONO};font-size:33px;font-weight:700;letter-spacing:9px;color:#c4576f;">${spaced}</div>
    <div class="bb-m" style="font-size:11.5px;color:${C.mut};margin-top:9px;">Never share this code with anyone. Nitro will never ask for it.</div>
  </td></tr></table>`;
}

export function featureTrio() {
  const items = [
    ['chip-bolt', 'Delivery starts in seconds'],
    ['chip-users', 'Real Nigerian audience'],
    ['chip-wallet', 'Wallet in Naira'],
  ];
  const cells = items.map(([icon, label]) => `
    <td class="stack bb-feat" width="33%" align="center" valign="top" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;padding:13px 6px 11px;">
      <img src="${A}/${icon}.png" width="36" height="36" alt="" style="display:block;margin:0 auto 7px;border-radius:50%;"/>
      <div class="bb-b" style="font-size:11px;font-weight:800;color:${C.ink};line-height:1.35;">${label}</div>
    </td>`).join('<td width="8" style="font-size:0;">&nbsp;</td>');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 2px;"><tr>${cells}</tr></table>`;
}

export function tierCards() {
  const cells = BONUS_PRESETS.map(p => {
    const hot = !!p.tag;
    return `<td class="stack" width="33%" align="center" valign="top" style="padding:0;">
      <div class="${hot ? 'bb-tier-hot' : 'bb-tier'}" style="border:${hot ? '2px solid #e26a8d' : `1px solid ${C.cardBorder}`};border-radius:14px;padding:${hot ? '11px' : '13px'} 4px 11px;background:${hot ? '#fdf1f5' : '#ffffff'};">
        ${hot ? `<div style="font-size:8.5px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;background:#c4576f;background:linear-gradient(135deg,#e26a8d,#c4576f);border-radius:20px;display:inline-block;padding:2.5px 9px;margin-bottom:5px;">${p.tag}</div>` : ''}
        <div class="${hot ? '' : 'bb-b'}" style="font-size:15px;font-weight:900;color:${hot ? '#c4576f' : C.ink};">&#8358;${p.amount.toLocaleString()}</div>
        <div class="bb-bonus" style="margin-top:7px;font-size:11.5px;font-weight:900;color:#0a7d54;background:#e6f6ef;border-radius:8px;padding:4px 0;">+&#8358;${p.bonus.toLocaleString()} free</div>
      </div>
    </td>`;
  }).join('<td width="8" style="font-size:0;">&nbsp;</td>');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr>${cells}</tr></table>`;
}

const FALLBACK_WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q';

export function whatsappCard(channelUrl) {
  const url = channelUrl || FALLBACK_WA_CHANNEL;
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr><td class="bb-wa" style="background:#eaf7ef;border-radius:16px;padding:14px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="40" valign="middle"><img src="${A}/chip-whatsapp.png" width="40" height="40" alt="WhatsApp" style="display:block;border-radius:50%;"/></td>
      <td valign="middle" style="padding-left:12px;">
        <div class="bb-b" style="font-size:13px;font-weight:800;color:${C.ink};">Follow The Nitro NG on WhatsApp</div>
        <div class="bb-m" style="font-size:11.5px;line-height:1.5;color:${C.mut};margin-top:2px;">Delivery updates, deal days and service news.</div>
      </td>
      <td align="right" valign="middle" style="padding-left:10px;">
        <a href="${url}" style="display:inline-block;background:#1faa59;color:#ffffff;font-size:12px;font-weight:800;text-decoration:none;padding:9px 15px;border-radius:99px;white-space:nowrap;">Follow</a>
      </td>
    </tr></table>
  </td></tr></table>`;
}

// ═══ SHARED SHELL ═══
// Backward compatible: emailWrap({ accent, body }) still works, and legacy
// callers passing { title, label } (old internal-alert shape) are mapped:
// title becomes a headline, label becomes the pill.
// New options: pill, pillTone, hero (asset filename), topStrip (css gradient), noBrandBar.
export function emailWrap({ accent: accentOverride, body, pill, pillTone = 'rose', hero, topStrip, noBrandBar, title, label } = {}) {
  const accent = accentOverride || C.accent;
  if (!pill && label) { pill = label; pillTone = 'warm'; }
  if (title) body = headline(title, 21) + body;
  const [pillColor, pillBg] = PILL_TONES[pillTone] || PILL_TONES.rose;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark}
@media(prefers-color-scheme:dark){
.bb-body{background:#16121b!important}
.bb-card{background:#231c28!important;border-color:#3b3040!important}
.bb-topline{border-color:#352b3a!important}
.bb-h{color:#f6f1ee!important}
.bb-em{color:#f2a0b6!important}
.bb-t{color:#c9c0bd!important}
.bb-b{color:#f0e9e6!important}
.bb-m{color:#8d8391!important}
.bb-pill{background:#3a2f3c!important}
.bb-panel{background:#2c2430!important;border-color:#3b3040!important}
.bb-feat{background:#2c2430!important;border-color:#3b3040!important}
.bb-line{border-color:#3b3040!important}
.bb-money{color:#4fd1a1!important}
.bb-amt{background:#14291f!important}
.bb-amt-big{color:#4fd1a1!important}
.bb-amt-cap{color:#7fbfa9!important}
.bb-code{background:#321f27!important;border-color:#7c4a58!important}
.bb-code-lab{color:#d391a3!important}
.bb-code-c{color:#f2a0b6!important}
.bb-exp{border-color:#8a6a3a!important}
.bb-exp-l{color:#e8b78a!important}
.bb-exp-d{color:#e0a45c!important}
.bb-warn{background:#33261a!important;border-color:#4a3826!important}
.bb-warn-t{color:#d9b68f!important}
.bb-warn-b{color:#f0d3ad!important}
.bb-green{background:#14291f!important}
.bb-green-t{color:#7fbfa9!important}
.bb-green-b{color:#4fd1a1!important}
.bb-refer{background:#2c2430!important}
.bb-refer-t{color:#c9c0bd!important}
.bb-wa{background:#12261c!important}
.bb-tier{background:#2c2430!important;border-color:#3b3040!important}
.bb-tier-hot{background:#33202b!important}
.bb-bonus{background:#14291f!important;color:#4fd1a1!important}
.bb-foot{color:#7a7280!important}
.bb-foot a{color:#f2a0b6!important}
.bb-wm-d{display:none!important}
.bb-wm-n{display:block!important}
}
@media only screen and (max-width:600px){
.bb-shell{padding:14px 8px!important}
.bb-pad{padding-left:22px!important;padding-right:22px!important}
.bb-cta{padding:15px 16px!important}
.stack{display:block!important;width:100%!important;padding:7px 0!important}
}
</style>
</head>
<body class="bb-body" style="margin:0;padding:0;background:${C.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-body" style="background:${C.canvas};">
<tr><td align="center" class="bb-shell" style="padding:18px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" class="bb-card" style="max-width:520px;width:100%;background:${C.card};border-radius:22px;border:1px solid ${C.cardBorder};overflow:hidden;">
${topStrip ? `    <tr><td style="height:7px;font-size:0;line-height:0;background:${accent};background:${topStrip};">&nbsp;</td></tr>\n` : ''}${noBrandBar ? '' : `    <tr><td class="bb-topline" style="padding:15px 22px 13px;border-bottom:1px solid ${C.topline};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle">
          <img src="${SITE.url}/wordmark-accent.png" width="65" height="20" alt="Nitro" class="bb-wm-d" style="display:block;"/>
          <img src="${SITE.url}/wordmark-white.png" width="65" height="20" alt="Nitro" class="bb-wm-n" style="display:none;"/>
        </td>
        ${pill ? `<td align="right" valign="middle"><span class="bb-pill" style="font-size:9px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${pillColor};background:${pillBg};padding:5px 11px;border-radius:99px;">${pill}</span></td>` : ''}
      </tr></table>
    </td></tr>\n`}${hero ? `    <tr><td><img src="${A}/${hero}" width="520" alt="" style="display:block;width:100%;height:auto;"/></td></tr>\n` : ''}    <tr><td class="bb-pad" style="padding:22px 28px 28px;">
      ${body}
    </td></tr>

  </table>

  <table cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;"><tr>
    <td align="center" style="padding:14px 0 0;">
      <p class="bb-foot" style="font-size:10.5px;color:#b3a89f;margin:0;line-height:1.7;">You're receiving this because you have a Nitro account.<br/><a href="{{UNSUB_URL}}" style="color:${C.accent};">Unsubscribe</a></p>
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

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES — copy is canon per Email Copy.md; don't edit copy here first
// ═══════════════════════════════════════════════════════════════════

// ═══ 1. VERIFICATION CODE (main app + Pit) ═══
export function sendVerificationEmail(to, name, code, { pit = false } = {}) {
  const subject = pit ? 'Your Pit verification code' : 'Your Nitro verification code';
  const html = preheader('Your code is inside. It expires in 10 minutes.') + emailWrap({
    pill: pit ? 'The Pit' : 'Verify',
    pillTone: pit ? 'purple' : 'rose',
    body: `
      ${headerRow('shield', "Prove it's you.")}
      ${para(`Hi ${name}, use this code to finish signing in. It expires in ${bold('10 minutes')}.`)}
      ${codeBlock(code)}
      ${mutedLine("Didn't try to sign in? You can safely ignore this email.")}
    `,
  });
  return sendEmail(to, subject, html, `Your Nitro verification code is ${code}. It expires in 10 minutes.`);
}

// ═══ 2. WELCOME ═══
export async function sendWelcomeEmail(name, to) {
  const waUrl = await getWhatsAppChannelUrl();
  const subject = "You're in, welcome to Nitro";
  const html = preheader("Your page is about to stop being a secret. Here's how to start.") + emailWrap({
    pill: 'Welcome',
    hero: 'hero-welcome.png',
    body: `
      ${headline(`You're in.<br/>Let's make some ${em('noise')}.`)}
      ${para('Thousands of Nigerian creators and businesses use Nitro to grow their content. Now you\'ve got the same tools they do.')}
      ${featureTrio()}
      <div style="height:18px;font-size:0;">&nbsp;</div>
      ${emailCTA(`${SITE.url}/dashboard`, 'Go to your dashboard &#8594;')}
      ${mutedLine('Fund your wallet, pick what you need, and you are off.')}
      ${whatsappCard(waUrl)}
      ${referCard()}
    `,
  });
  return sendEmail(to, subject, html, `Welcome to Nitro, ${name}! Head to your dashboard: ${SITE.url}/dashboard`);
}

// ═══ 3. PASSWORD RESET ═══
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = preheader('Tap the button to choose a new one. Link expires in 30 minutes.') + emailWrap({
    accent: '#d34040',
    pill: 'Security',
    pillTone: 'pink',
    body: `
      ${headerRow('lock', "Let's get you back in.")}
      ${para(`Hi ${name}, someone requested a password reset for your account. If that was you, tap below to choose a new one.`, 18)}
      ${emailCTA(resetUrl, 'Reset my password', 'red')}
      ${mutedLine('This link expires in 30 minutes.')}
      ${mutedLine("If you didn't request this, ignore this email. Your password won't change.", 'center', 5)}
    `,
  });
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

// ═══ 4. ACCOUNT DELETION SCHEDULED ═══
export function accountDeletionEmail(name, daysLeft) {
  return emailWrap({
    pill: 'Account',
    pillTone: 'warm',
    body: `
      ${headline('Sad to see you go.', 21)}
      ${para(`Hi ${name}, your Nitro account has been scheduled for permanent deletion in ${bold(`${daysLeft} days`)}.`)}
      ${warnBlock(`<strong style="color:#5c3f24;">Everything goes with it:</strong> your data, order history and wallet balance are removed permanently after this period.`)}
      ${para(`If this was a mistake or you changed your mind, reach us at ${bold('support@nitro.ng')} and we'll cancel it right away.`, 18)}
      ${emailCTA('mailto:support@nitro.ng', 'Keep my account', 'amber')}
    `,
  });
}

// ═══ 5/6. WALLET: DEPOSIT / REFUND / GENERIC CREDIT ═══
// Backward compatible: walletCreditEmail(name, amount, reason) still works (generic credit).
// opts: { kind: 'deposit'|'refund'|'credit', bonus, newBalance, method, orderRef, failReason, waChannelUrl }
export function walletCreditEmail(name, amount, reason, opts = {}) {
  const kind = opts.kind || 'credit';
  const bal = opts.newBalance != null ? `₦${Number(opts.newBalance).toLocaleString()}` : null;

  if (kind === 'deposit') {
    const bonus = Number(opts.bonus || 0);
    const total = Number(amount) + bonus;
    let rows = '';
    if (bal) rows += emailRow('New balance', bal, '#059669');
    if (bonus > 0) rows += emailRow('Welcome credit', `+₦${bonus.toLocaleString()}`, '#059669');
    if (opts.method) rows += emailRow('Method', opts.method);
    return emailWrap({
      pill: 'Wallet',
      pillTone: 'green',
      body: `
        ${headerRow('wallet-green', 'Money in.')}
        ${para(`Hi ${name}, your deposit of ${bold(`₦${Number(amount).toLocaleString()}`)} just landed and it's ready to spend.`)}
        ${bonus > 0 ? para(`And because it's your first deposit, we added ${bold(`₦${bonus.toLocaleString()} in free welcome credit`)} on top. It spends like cash on any service.`) : ''}
        ${amountBlock('#059669', `+₦${total.toLocaleString()}`, bonus > 0 ? `₦${Number(amount).toLocaleString()} deposit + ₦${bonus.toLocaleString()} welcome credit` : 'Added to your wallet')}
        ${rows ? emailDataBox(rows) : ''}
        ${para("Pick a platform, choose what you need, and you're off. Most orders start delivering within a minute.", 18)}
        ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Place an order &#8594;', 'green')}
        ${whatsappCard(opts.waChannelUrl)}
        ${signOff()}
      `,
    });
  }

  if (kind === 'refund') {
    const pts = Number(opts.pointsRestored || 0);
    let rows = '';
    if (opts.orderRef) rows += emailRow('Order', opts.orderRef);
    if (opts.failReason) rows += emailRow('Reason', opts.failReason);
    if (bal) rows += emailRow('New balance', bal, '#059669');
    const walletAmt = Number(amount);
    const hasWallet = walletAmt > 0;
    const hasPoints = pts > 0;
    const blurb = hasWallet && hasPoints
      ? `Hi ${name}, one of your orders couldn't complete. Here's the breakdown of your refund.`
      : `Hi ${name}, one of your orders couldn't complete, so we sent the money straight back${hasPoints ? ' as points' : ' to your wallet'}. No forms, no waiting.`;
    let blocks = '';
    if (hasWallet) blocks += amountBlock('#059669', `+₦${walletAmt.toLocaleString()}`, 'Credited to your wallet');
    if (hasPoints) blocks += amountBlock('#059669', `+${pts.toLocaleString()} points`, 'Restored to your points balance');
    if (!hasWallet && !hasPoints) blocks = amountBlock('#059669', `+₦0`, 'Nothing to refund');
    return emailWrap({
      pill: 'Refund',
      pillTone: 'green',
      body: `
        ${headerRow('refund', 'Money back.')}
        ${para(blurb)}
        ${blocks}
        ${rows ? emailDataBox(rows) : ''}
        ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Reorder in one tap &#8594;', 'green')}
        ${mutedLine(hasPoints ? 'Wallet credit and points are available instantly.' : 'Refunds land instantly as spendable wallet credit.')}
      `,
    });
  }

  // generic credit (admin top-ups, gifts)
  return emailWrap({
    pill: 'Wallet',
    pillTone: 'green',
    body: `
      ${headerRow('wallet-green', 'Money in.')}
      ${para(`Hi ${name}, ${reason || 'your Nitro wallet just got a top up.'}`)}
      ${amountBlock('#059669', `+₦${Number(amount).toLocaleString()}`, 'Added to your wallet')}
      ${emailCTA(`${SITE.url}/dashboard`, 'Check your balance', 'green')}
    `,
  });
}

// ═══ 7. BULK ORDER PLACED ═══
export function batchPlacementEmail(name, batchId, total, placed, failed, totalCharge, { waChannelUrl } = {}) {
  let rows = emailRow('Batch', batchId) + emailRow('Total orders', total) + emailRow('Processing', placed, '#059669');
  if (failed > 0) rows += emailRow('Pending retry', failed, '#d9821a');
  rows += emailRow('Total charged', `₦${totalCharge.toLocaleString()}`);
  return emailWrap({
    pill: 'Orders',
    body: `
      ${headerRow('list', "Orders in. We're on it.")}
      ${para(`Hi ${name}, your bulk order has been submitted and is now processing.`)}
      ${emailDataBox(rows)}
      ${mutedLine("Orders that couldn't be placed immediately retry automatically. If they still don't go through, you're refunded.", 'left', 0)}
      <div style="height:16px;font-size:0;">&nbsp;</div>
      ${emailCTA(`${SITE.url}/dashboard`, 'Track my orders &#8594;')}
      ${whatsappCard(waChannelUrl)}
    `,
  });
}

// ═══ 8. BULK ORDER COMPLETE ═══
export function batchCompletionEmail(name, batchId, completed, partial, cancelled, refunded) {
  let rows = emailRow('Completed', completed, '#059669');
  if (partial > 0) rows += emailRow('Partial', partial, '#d9821a');
  if (cancelled > 0) rows += emailRow('Cancelled', cancelled, '#d34040');
  if (refunded > 0) rows += emailRow('Refunded', `₦${refunded.toLocaleString()}`, '#059669');
  return emailWrap({
    pill: 'Complete',
    pillTone: 'green',
    body: `
      ${headerRow('check', "All done. Here's the score.")}
      ${para(`Hi ${name}, every order in your batch has finished processing.`)}
      ${emailDataBox(rows)}
      ${emailCTA(`${SITE.url}/dashboard`, 'View the results &#8594;')}
      ${mutedLine('Partials and cancellations are refunded automatically.')}
    `,
  });
}

// ═══ 9. AD ACTIVATION DAY 1 (tier cards) ═══
export function sendAdActivationDay1(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = preheader("You're in. One quick step to give it a real push, up to ₦3,000 free.") + emailWrap({
    pill: 'Bonus live',
    pillTone: 'amber',
    body: `
      ${headline(`Give it the push it ${em('deserves')}.`)}
      ${para(`Hi ${firstName}, you came to Nitro for one reason: to get your content in front of more people. You're one step away from doing exactly that.`)}
      ${para(`Your first deposit unlocks ${bold('up to ₦3,000 in free promo credit')}, applied automatically. No codes needed.`)}
      <p class="bb-m" style="font-size:10px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:${C.mut};text-align:center;margin:0 0 9px;">The more you add, the bigger the push</p>
      ${tierCards()}
      ${emailCTA(`${SITE.url}/dashboard?page=add-funds`, 'Add funds and push my content &#8594;')}
      ${mutedLine('Real engagement. Fast start. No foreign wahala.')}
    `,
  });
  return sendEmail(to, 'Your content is still waiting to be seen', html,
    `Hi ${firstName}, you're one step from getting your content seen. Fund your wallet and get up to N3,000 in free credit. Start here: ${SITE.url}/dashboard?page=add-funds`);
}

// ═══ 10. AD ACTIVATION DAY 3 (proof + steps) ═══
export function sendAdActivationDay3(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = preheader('Test Nitro small, watch your numbers move, then decide.') + emailWrap({
    pill: 'Try it small',
    body: `
      ${headline(`Start with ${em('₦1,000')}. Seriously.`)}
      ${para(`Hi ${firstName}, totally fair to be careful. Plenty of "growth" tools out there don't do anything real, so don't take our word for it. Point ₦1,000 at one post and watch what happens.`)}
      ${stepsBlock([`Pick ${bold('what to push')}`, `Paste ${bold('your link')}`, `Watch it ${bold('move, live')}`])}
      ${quoteBlock('I was posting every week and getting nothing. Pushed one video with Nitro and it finally started moving.', 'Tunde, creator')}
      ${para(`Like what you see? Top up ${bold('₦2,500 or more')} and up to ₦3,000 in free credit kicks in automatically.`, 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=add-funds`, 'Try it with ₦1,000 &#8594;')}
    `,
  });
  return sendEmail(to, 'You can start with ₦1,000 (seriously)', html,
    `Hi ${firstName}, not sure about Nitro? Start with just N1,000, point it at one post, and watch what happens. Try it: ${SITE.url}/dashboard?page=add-funds`);
}

// ═══ 11. AD ACTIVATION DAY 6 (last reminder) ═══
export function sendAdActivationDay6(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = preheader('Your free promo credit is still here. Your call.') + emailWrap({
    pill: 'Last one',
    pillTone: 'grey',
    body: `
      ${headline('The honest pitch.', 21)}
      ${para(`Hi ${firstName}, you signed up a few days ago and haven't taken Nitro for a spin. No pressure, and this is the last time we'll remind you about it.`)}
      ${para('The creators, artists and brands who actually grow are the ones who put their content in front of people, instead of posting and hoping the algorithm notices. That is the whole job Nitro does.')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td class="bb-panel" align="center" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;padding:14px 16px;">
        <p class="bb-t" style="font-size:13.5px;line-height:1.65;color:${C.body};margin:0;">Your first deposit still gets ${bold('up to ₦3,000 in free credit')}. If you've got a post, a song, or a page that deserves more eyes, this is your sign.</p>
      </td></tr></table>
      ${emailCTA(`${SITE.url}/dashboard?page=add-funds`, 'Push my content now &#8594;')}
      ${mutedLine("Not the right time? No wahala, you won't hear about this again.")}
    `,
  });
  return sendEmail(to, 'Our last reminder, we promise', html,
    `Hi ${firstName}, last reminder: your free promo credit is still waiting. Fund your wallet and get up to N3,000 free to push your content. Your call: ${SITE.url}/dashboard?page=add-funds`);
}

// ═══ 12. PROMO BLAST (seasonal themes recolor accent + top strip) ═══

const EMAIL_THEMES = {
  christmas:    { accent: '#c0392b', bg: '#fdf2f2', topBar: 'linear-gradient(90deg,#c0392b,#27ae60,#c0392b)', ctaText: 'Unwrap your discount' },
  newyear:      { accent: '#d4a017', bg: '#fefce8', topBar: 'linear-gradient(90deg,#d4a017,#f59e0b,#d4a017)', ctaText: 'Start the year right' },
  valentine:    { accent: '#e91e63', bg: '#fce4ec', topBar: 'linear-gradient(90deg,#e91e63,#f48fb1,#e91e63)', ctaText: 'Treat yourself' },
  independence: { accent: '#008751', bg: '#ecfdf5', topBar: 'linear-gradient(90deg,#008751,#ffffff,#008751)', ctaText: 'Celebrate with savings' },
  eid:          { accent: '#1b5e20', bg: '#e8f5e9', topBar: 'linear-gradient(90deg,#1b5e20,#c8a951,#1b5e20)', ctaText: 'Eid Mubarak, order now' },
  easter:       { accent: '#7c3aed', bg: '#f5f3ff', topBar: 'linear-gradient(90deg,#7c3aed,#a78bfa,#7c3aed)', ctaText: 'Hop on this deal' },
  blackfriday:  { accent: '#1a1a1a', bg: '#f5f5f5', topBar: 'linear-gradient(90deg,#1a1a1a,#d4a017,#1a1a1a)', ctaText: 'Grab the deal' },
  sallah:       { accent: '#6d4c1d', bg: '#fef3c7', topBar: 'linear-gradient(90deg,#6d4c1d,#c8a951,#6d4c1d)', ctaText: 'Sallah savings await' },
};

export async function sendPromotionBlast(campaign) {
  const { name: promotionName, discountPercent, bannerCopy, bannerColor, maxDiscountPerOrder, endAt, emailTheme } = campaign;
  const users = await prisma.user.findMany({
    where: {
      status: 'Active', notifPromo: true, emailVerified: true,
      // Exclude users in an active Play 7 window
      bonusCredits: { none: { amountRemaining: { gt: 0 }, expiredAt: null, expiresAt: { gt: new Date() } } },
    },
    select: { email: true, name: true },
  });
  if (!users.length) return 0;

  const theme = EMAIL_THEMES[emailTheme] || null;
  const color = theme?.accent || bannerColor || '#d5688a';
  const bgColor = theme?.bg || tint(color, 0.1);
  const endsStr = endAt ? new Date(endAt).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  const capStr = maxDiscountPerOrder ? `Up to ₦${(maxDiscountPerOrder / 100).toLocaleString()} off per order.` : '';
  const subject = `${promotionName} is live | ${discountPercent}% off all orders`;

  let sent = 0;
  for (const user of users) {
    const html = preheader(`Applied automatically at checkout.${endsStr ? ` Ends ${endsStr}.` : ''}`) + emailWrap({
      accent: color,
      pill: 'Deal day',
      topStrip: theme?.topBar || 'linear-gradient(90deg,#e26a8d,#f4b04b,#e26a8d)',
      body: `
        ${headline(`${promotionName} is ${em('live')}.`, 22)}
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td align="center" style="padding:22px 20px;background:${bgColor};border-radius:18px;">
          <div style="font-family:${MONO};font-size:40px;font-weight:700;color:${color};">${discountPercent}% OFF</div>
          <div style="font-size:13px;font-weight:700;color:${color};margin-top:6px;">${bannerCopy || 'All services, today only'}</div>
        </td></tr></table>
        ${para(`Hi ${user.name || 'there'}, place an order now and the discount is applied automatically at checkout. No codes needed.${capStr ? ' ' + capStr : ''}`)}
        ${endsStr ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td align="center" style="background:#ffe9e6;border-radius:12px;padding:10px 14px;font-size:12.5px;font-weight:800;color:#d34040;">&#9201;&nbsp; Ends ${endsStr}</td></tr></table>` : ''}
        ${emailCTA(`${SITE.url}/dashboard`, theme?.ctaText || 'Grab the deal &#8594;')}
      `,
    });
    try {
      await sendEmail(user.email, subject, html, `${promotionName} — ${discountPercent}% off all orders at Nitro. Order now: ${SITE.url}/dashboard`);
      sent++;
    } catch {}
  }
  console.log(`[Email] Promotion blast: ${sent}/${users.length} sent for "${promotionName}"`);
  return sent;
}

// ═══ 13. LEADERBOARD REWARD ═══
export function leaderboardRewardEmail(name, amount) {
  return emailWrap({
    pill: 'Reward',
    pillTone: 'amber',
    hero: 'hero-trophy.png',
    body: `
      ${headline(`You made the ${em('board')}.`, 21)}
      ${para(`Nice one ${name}. You made the Nitro leaderboard this month and the reward is already sitting in your wallet.`)}
      ${amountBlock('#059669', `+₦${amount.toLocaleString()}`, 'Leaderboard reward')}
      ${emailCTA(`${SITE.url}/dashboard`, 'View my wallet &#8594;', 'amber')}
      ${mutedLine('Keep it going. The leaderboard resets every month.')}
    `,
  });
}

// ═══ 14. REFERRAL BONUS ═══
export function referralBonusEmail(name, amount) {
  return emailWrap({
    pill: 'Referral',
    pillTone: 'purple',
    body: `
      ${headerRow('gift', 'Your friend came through.')}
      ${para(`Hi ${name}, someone you referred just made their first deposit. Your bonus landed instantly.`)}
      ${amountBlock('#059669', `+₦${amount.toLocaleString()}`, 'Referral bonus, spendable on your next order')}
      ${para("More friends, more bonuses. Your referral link is on your dashboard, and there's no limit.", 18)}
      ${emailCTA(`${SITE.url}/dashboard`, 'Refer another friend &#8594;')}
    `,
  });
}

// ═══ 15. COMEBACK DAY 30 (Play 7, expiring credit) ═══
function expiryDateStr(days) {
  return new Date(Date.now() + days * 86400000).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short' });
}

export function sendWinback30Email(name, to, amount, days) {
  const subject = "Your page didn't stop. You did.";
  const amt = `₦${amount.toLocaleString()}`;
  const html = preheader('A little fuel is waiting in your wallet. One week only.') + emailWrap({
    pill: 'Credit inside',
    pillTone: 'amber',
    hero: 'hero-gift.png',
    body: `
      ${headline(`Your page didn't stop.<br/>${em('You did.')}`)}
      ${para("It's been about a month. Maybe life happened, fair. But the algorithm didn't pause with you. The accounts you were outpacing are still running the play, and the gap you'd closed is quietly reopening.")}
      ${para(`So we put ${bold(`${amt} in free promo credit`)} in your wallet, to make coming back easy. It's live now and it spends on anything.`)}
      ${ticketBlock({ label: 'Already in your wallet', big: `${amt} FREE`, note: 'Spends on any service. No code needed.' })}
      ${expiryStrip(days, expiryDateStr(days))}
      ${para('You already know how this works. Pick the post that deserves better numbers, point the credit at it, watch it move.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, `Use my ${amt} before it expires &#8594;`, 'amber')}
      ${mutedLine('Your social media deserves better numbers.')}
    `,
  });
  return sendEmail(to, subject, html, `We loaded ${amt} in free promo credit into your Nitro wallet. It expires in ${days} days. Use it: ${SITE.url}/dashboard`);
}

// ═══ 16. COMEBACK DAY 60 (Play 7, final) ═══
export function sendWinback60Email(name, to, amount, days) {
  const subject = 'Last one from us for a while';
  const amt = `₦${amount.toLocaleString()}`;
  const html = preheader('One real offer, bigger than last time. Then we go quiet.') + emailWrap({
    pill: 'Final offer',
    pillTone: 'pink',
    body: `
      ${headline(`Last one from us<br/>for a ${em('while')}.`)}
      ${para("Straight up: this is the last comeback offer we'll send for a while. Nobody likes being disturbed.")}
      ${para(`But before we go quiet, one real offer. ${bold(`${amt} in free promo credit`)}, bigger than last time, live in your wallet for ${days} days. If the timing was the problem, this is the timing.`)}
      ${ticketBlock({ label: 'Our biggest comeback offer', big: `${amt} FREE`, note: 'Already loaded. Spends on anything.', variant: 'pink' })}
      ${expiryStrip(days, expiryDateStr(days))}
      ${para(`If you've genuinely moved on, no hard feelings. The work you put in still counts, and the door stays open. But if the plan was always "I'll get back to it", this is the cheapest week you'll ever pick to get back to it.`, 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, `Claim ${amt} and pick my post &#8594;`)}
      ${mutedLine('Your social media deserves better numbers.')}
    `,
  });
  return sendEmail(to, subject, html, `Last one: ${amt} in free promo credit, bigger than last time, live in your wallet for ${days} days. ${SITE.url}/dashboard`);
}

// ═══ 17. IDLE FUNDS (funded, never ordered) ═══
export function sendNudgeIdleFunds(name, to, balance) {
  const subject = 'Your wallet is funded. Ready to go?';
  const bal = `₦${balance.toLocaleString()}`;
  const html = preheader(`${bal} is sitting there ready. First order takes about a minute.`) + emailWrap({
    pill: 'Ready',
    pillTone: 'green',
    body: `
      ${headerRow('bolt', 'Loaded. Not launched.')}
      ${para(`Hi ${name}, you added money to your Nitro wallet a little while back, but you haven't placed your first order yet.`)}
      ${amountBlock('#059669', bal, 'Available in your wallet')}
      ${para('That is more than enough to get started. Pick a platform, choose what you need, and Nitro handles the rest. Most orders start delivering within a minute.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Place my first order &#8594;', 'green')}
      ${mutedLine('Not sure where to start? Instagram followers and TikTok views are the most popular picks.')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ${bal} in your Nitro wallet. Place your first order: ${SITE.url}/dashboard`);
}

// ═══ 18. IDLE BALANCE (money sitting 7+ days) ═══
export function sendNudgeIdleBalance(name, to, balance) {
  const bal = `₦${balance.toLocaleString()}`;
  const subject = `You've still got ${bal} in your wallet`;
  const html = preheader("Quick heads up, it's been sitting there over a week.") + emailWrap({
    pill: 'Wallet',
    pillTone: 'green',
    body: `
      ${headerRow('wallet-green', "It's just sitting there.")}
      ${para(`Hi ${name}, quick heads up: you have money in your Nitro wallet that hasn't been touched in over a week.`)}
      ${amountBlock('#059669', bal, 'Available in your wallet')}
      ${para('Your money, your timeline. But if you are looking to give your content a push, everything is already set up and ready to go.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Use my balance &#8594;', 'green')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have ${bal} in your Nitro wallet. Put it to work: ${SITE.url}/dashboard`);
}

// ═══ 20. PIT APPLICATION APPROVED ═══
export function pitApprovedEmail(name) {
  return preheader('Your application was approved and your referral link is live.') + emailWrap({
    pill: 'The Pit',
    pillTone: 'purple',
    body: `
      ${headerRow('check-purple', 'Welcome to the crew.')}
      ${para(`Hi ${name}, good news: your Pit application has been approved.`)}
      ${para('Your referral link is already live. Log into the Pit portal to grab it, share it, and watch your commissions build.')}
      ${para('Everything you need, your link, your numbers, your payouts, lives in the portal.', 18)}
      ${emailCTA(`${SITE.url}/pit`, 'Go to the Pit &#8594;', 'purple')}
      ${signOff()}
    `,
  });
}

// ═══ 21. PIT MEMBER SUSPENDED ═══
export function pitSuspendedEmail(name) {
  return preheader('Commissions are on hold while your account is paused.') + emailWrap({
    pill: 'Paused',
    pillTone: 'warm',
    body: `
      ${headerRow('pause', 'Your account is paused.')}
      ${para(`Hi ${name}, your Pit account has been suspended, and commissions are on hold while it stays paused.`)}
      ${para("If you believe this is a mistake, reach out to support and we'll take a look.", 18)}
      ${ghostCTA('mailto:support@nitro.ng', 'Contact support')}
      ${signOff()}
    `,
  });
}

// ═══ 22. PAYOUT COMPLETED ═══
export function payoutCompletedEmail(name, amount, reference, bankLabel, dateStr) {
  const amt = `₦${Number(amount).toLocaleString()}`;
  let rows = emailRow('Reference', reference);
  if (bankLabel) rows += emailRow('Sent to', bankLabel);
  if (dateStr) rows += emailRow('Date', dateStr);
  return preheader("It's on the way to your bank. Reference inside.") + emailWrap({
    pill: 'Payout',
    pillTone: 'purple',
    body: `
      ${headerRow('send', 'Payout sent.')}
      ${para(`Hi ${name}, your payout of ${bold(amt)} has been sent to your bank. Depending on your bank, it can take a little while to reflect.`)}
      ${amountBlock('#059669', amt, 'Sent to your bank')}
      ${emailDataBox(rows)}
      ${para('Keep the reference handy in case you ever need to ask about this payment. Nice work, your earnings page has the full breakdown.', 18)}
      ${emailCTA(`${SITE.url}/pit`, 'View my earnings &#8594;', 'purple')}
      ${signOff()}
    `,
  });
}

// ═══ 23. PAYOUT REJECTED ═══
export function payoutRejectedEmail(name, amount, reference) {
  const amt = `₦${Number(amount).toLocaleString()}`;
  let rows = emailRow('Returned to balance', amt, '#059669');
  if (reference) rows += emailRow('Reference', reference);
  return preheader('The held amount is back in your commission balance.') + emailWrap({
    pill: 'Payout',
    pillTone: 'purple',
    body: `
      ${headerRow('refund-amber', 'Back in your balance.')}
      ${para(`Hi ${name}, we couldn't process your payout this time, so the held amount has been returned to your commission balance in full.`)}
      ${emailDataBox(rows)}
      ${para("Nothing is lost. You can request again anytime, and if you're not sure what went wrong, support can tell you exactly.", 18)}
      ${emailCTA(`${SITE.url}/pit`, 'View my earnings &#8594;', 'purple')}
      ${signOff()}
    `,
  });
}

// ═══ PIT APPLICATION UPDATE (rejection — canon copy, new shell) ═══
export function pitRejectionEmail(name) {
  return emailWrap({
    pill: 'The Pit',
    pillTone: 'purple',
    body: `
      ${para(`Hi ${name},`)}
      ${para("Thanks for applying to join the Pit, Nitro's referral crew.")}
      ${para("After reviewing your application, we've decided not to move forward at this time. This isn't permanent, you're welcome to reapply in the future if anything changes.")}
      ${para('In the meantime, you can still use Nitro to grow your content like thousands of other creators.', 18)}
      ${emailCTA(`${SITE.url}/dashboard`, 'Go to Nitro')}
    `,
  });
}

// ═══ GRADUAL DELIVERY ANNOUNCEMENT (one-off broadcast, kept for reference) ═══
export function gradualDeliveryAnnouncementEmail(name) {
  return emailWrap({
    body: `
      ${para(`Hi ${name},`)}
      ${para("Hope you're having a good weekend.")}
      ${para("Quick update: we've changed how orders are delivered on Nitro. Instead of everything arriving at once, your orders now come in gradually throughout the day. This makes your growth look more natural and keeps your account safer.")}
      ${para('It means delivery takes a few hours instead of minutes, but you can track everything in real time on your dashboard, including an estimated delivery time on each order.', 18)}
      ${emailCTA(`${SITE.url}/dashboard`, 'Go to your dashboard')}
      ${mutedLine("If anything looks off, tap Support in your dashboard and we'll sort it out.")}
      ${para('Enjoy the rest of your weekend!', 0).replace('margin:0 0 0px', 'margin:20px 0 0')}
      ${para('Team Nitro', 0).replace('margin:0 0 0px', 'margin:4px 0 0')}
    `,
  });
}

// ═══ LAUNCH BROADCASTS (manual sends — nothing triggers these automatically) ═══
// Copy canon: Marketing/Email Redesign v2/Email Copy.md (approved 11 Jul 2026)

function launchFeaturePanel(chip, title, html) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 9px;"><tr><td class="bb-panel" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;padding:14px 16px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="middle"><img src="${A}/chip-${chip}.png" width="34" height="34" alt="" style="display:block;border-radius:11px;"/></td>
      <td style="padding-left:11px;">
        <div class="bb-b" style="font-size:13px;font-weight:800;color:${C.ink};">${title}</div>
        <div class="bb-t" style="font-size:12.5px;line-height:1.65;color:${C.body};margin-top:3px;">${html}</div>
      </td>
    </tr></table>
  </td></tr></table>`;
}

// 25. Tasks page launch (Trip fires this manually when the Tasks page ships)
export function sendTasksLaunchEmail(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const steps = [
    'Pick a task',
    'Do it, then paste your proof (a link or your handle)',
    'We check it, and the credit lands within a day or two',
  ].map((s, i) => `<tr><td width="22" style="padding:5.5px 0;"><div style="width:22px;height:22px;border-radius:50%;background:#c4576f;background:linear-gradient(135deg,#e26a8d,#c47d8e);color:#ffffff;font-size:11px;font-weight:800;text-align:center;line-height:22px;">${i + 1}</div></td>
    <td class="bb-t" style="padding:5.5px 0 5.5px 11px;font-size:12.5px;line-height:1.5;color:${C.body};">${s}</td></tr>`).join('');
  const html = preheader('Follow, share, post. Each task adds free credit to your wallet.') + emailWrap({
    pill: 'New',
    pillTone: 'blue',
    hero: 'hero-tasks.png',
    body: `
      ${headline(`Small tasks,<br/>${em('free credit')}.`)}
      ${para(`Hi ${firstName}, there's a new Tasks page on your dashboard. It works exactly how it sounds: do a small task, show us proof, and we add free credit to your wallet.`, 16)}
      ${launchFeaturePanel('task', 'What kind of tasks?', `Follow us on Instagram or X, join our Telegram, put nitro.ng in your bio, or post about us. Each task shows its own reward, from ${bold('₦100')} for a follow up to ${bold('₦5,000')} for the biggest ones.`)}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 9px;"><tr><td class="bb-panel" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;padding:11px 16px;">
        <div class="bb-b" style="font-size:13px;font-weight:800;color:${C.ink};padding:3px 0 4px;">How it works</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
      </td></tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td class="bb-warn" style="background:#fff4ec;border:1px solid #ffdfc4;border-radius:14px;padding:12px 16px;">
        <div class="bb-warn-b" style="font-size:12px;font-weight:800;color:#5c3f24;">The honest part</div>
        <div class="bb-warn-t" style="font-size:12px;line-height:1.6;color:#7a5b3e;margin-top:2px;">This credit is for placing orders, not for withdrawal, and each reward stays valid for 30 days after it lands. So don't let it sit.</div>
      </td></tr></table>
      ${emailCTA(`${SITE.url}/dashboard`, 'See the tasks &#8594;')}
      ${mutedLine('Each task can be done once. New ones drop from time to time.')}
      ${signOff()}
    `,
  });
  // TODO: point the CTA at the Tasks page route once it ships
  return sendEmail(to, 'Do a small task, earn free credit', html,
    `Hi ${firstName}, the Tasks page is live. Do a small task (follow, share, post), show proof, and free credit lands in your wallet, from N100 up to N5,000 per task. ${SITE.url}/dashboard`);
}
