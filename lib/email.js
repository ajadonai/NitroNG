import { fetchWithRetry } from './fetch.js';
import { log } from './logger.js';
import prisma from './prisma.js';
import { getWhatsAppChannelUrl } from './settings.js';
import { SITE } from './site.js';
import { signUnsubToken } from './unsubscribe.js';
import { BONUS_PRESETS } from './welcome-bonus.js';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'Ify from Nitro';

// ═══════════════════════════════════════════════════════════════════
// NITRO EMAIL SYSTEM (clean pass, approved 17 Oct 2026)
// Copy source of truth: Marketing/Email Redesign v2/Email Copy.md
// One letter-like layout for every email: wordmark and label, an icon tile,
// a serif headline, the body, one button, a rotating channel card, a footer.
// Art is hosted PNG in /public/email (Gmail strips SVG). Each icon has a light
// and a dark file, swapped by the bb-d/bb-n classes the same way as the
// wordmark. The old chip-*/hero-* images stay: emails already in inboxes
// still point at them.
// ═══════════════════════════════════════════════════════════════════

const A = `${SITE.url}/email`; // hosted asset base
const MONO = `'JetBrains Mono','SF Mono',Menlo,Consolas,monospace`;
const SANS = `'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const SERIF = `'Cormorant','Cormorant Garamond',Georgia,'Times New Roman',serif`;

// Day tokens (inline defaults); dark is the bb-* overrides in emailWrap's <style>
const C = {
  canvas: '#efe8e0', card: '#fffdfb', cardBorder: '#e6d5ce', hair: '#efe3dc',
  panel: '#f8f0ea', panelLine: '#efe3dc',
  ink: '#201b19', body: '#4f4a47', mut: '#857c77', accent: '#83535f', btn: '#8b5e6b', money: '#086e4f',
  amber: '#8a5a10',
};

function tint(hex, p) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  const mix = x => Math.round(x * p + 255 * (1 - p));
  const h = n => n.toString(16).padStart(2, '0');
  return '#' + h(mix(r)) + h(mix(g)) + h(mix(b));
}

const escapeEmailText = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

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

// ═══ ICONS ═══

function iconImg(name, size) {
  return `<img src="${A}/icon-${name}.png" width="${size}" height="${size}" alt="" class="bb-d" style="display:block;border:0;"/>`
    + `<img src="${A}/icon-${name}-dark.png" width="${size}" height="${size}" alt="" class="bb-n" style="display:none;border:0;"/>`;
}

/** The tile that opens an email, above the headline. */
export function iconTile(name) {
  return `<div style="margin:0 0 18px;">${iconImg(name, 60)}</div>`;
}

// headerRow() used to draw a coloured chip beside the title. Its chip names map
// onto the new icons, so every template that called it opens with a tile now.
const CHIP_ICON = {
  shield: 'shield', lock: 'shield', wallet: 'wallet', 'wallet-green': 'wallet',
  refund: 'refund', 'refund-amber': 'refund', list: 'receipt', check: 'check',
  'check-purple': 'check', gift: 'gift', pause: 'pause', send: 'send', bolt: 'bolt',
};

// ═══ BUILDING BLOCKS ═══

export function headline(html, size = 25) {
  const px = size >= 25 ? 32 : 29;
  return `<div class="bb-h" style="font-family:${SERIF};font-size:${px}px;line-height:1.08;font-weight:600;color:${C.ink};letter-spacing:-.2px;margin:0 0 12px;">${html}</div>`;
}

export function em(text) {
  return `<em class="bb-em" style="font-style:italic;color:${C.accent};">${text}</em>`;
}

export function para(html, mb = 13) {
  return `<p class="bb-t" style="font-size:15px;line-height:1.62;color:${C.body};margin:0 0 ${Math.max(mb, 16)}px;">${html}</p>`;
}

export function bold(text) {
  return `<strong class="bb-b" style="color:${C.ink};font-weight:600;">${text}</strong>`;
}

export function mutedLine(html, align = 'left', mt = 14) {
  return `<p class="bb-m" style="font-size:13px;line-height:1.55;color:${C.mut};text-align:${align};margin:${mt}px 0 0;">${html}</p>`;
}

export function signOff() {
  return `<p class="bb-t" style="font-size:14px;color:${C.body};margin:20px 0 0;">Ify, from Nitro</p>`;
}

export function headerRow(chip, title, size = 21) {
  const icon = CHIP_ICON[chip];
  return (icon ? iconTile(icon) : '') + headline(title, size);
}

/** One button, left-aligned like the end of a letter. Full width on a phone. */
export function emailCTA(href, text) {
  const label = String(text).replace(/\s*&#8594;\s*$/, '');
  return `<table cellpadding="0" cellspacing="0" border="0" class="bb-btn-wrap" style="margin:4px 0 0;"><tr>
    <td class="bb-btn" align="center" style="background:${C.btn};border-radius:10px;">
      <a href="${href}" style="display:inline-block;color:#ffffff;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:15px 22px;border-radius:10px;">${label}</a>
    </td>
  </tr></table>`;
}

export function ghostCTA(href, text) {
  return `<table cellpadding="0" cellspacing="0" border="0" class="bb-btn-wrap" style="margin:4px 0 0;"><tr>
    <td class="bb-line" align="center" style="border:1px solid ${C.cardBorder};border-radius:10px;">
      <a class="bb-em" href="${href}" style="display:inline-block;color:${C.accent};font-family:${SANS};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:14px 22px;">${text}</a>
    </td>
  </tr></table>`;
}

// Codes and order numbers keep the mono face; plain values ("Bank transfer",
// "Instagram Followers") read in the body face, which is what they are.
const ID_LIKE = /^(#\d+|[A-Z]{2,6}-[\w-]+|[A-Z0-9]{4}-[A-Z0-9]{4})$/;
const ROW_TONES = { '#059669': ['bb-money', C.money], '#d9821a': ['bb-amber', C.amber], '#d34040': ['bb-b', '#b42318'] };

export function emailRow(label, value, valueColor, { total = false } = {}) {
  const [cls, color] = ROW_TONES[valueColor] || ['bb-b', C.ink];
  const mono = ID_LIKE.test(String(value));
  return `<tr>
    <td class="bb-m bb-line" style="padding:11px 0;font-size:14px;color:${C.mut};border-bottom:1px solid ${C.hair};">${label}</td>
    <td class="${cls} bb-line" align="right" style="padding:11px 0 11px 16px;font-size:${mono ? 13 : total ? 15 : 14}px;font-weight:${total ? 700 : mono ? 600 : 500};${mono ? `font-family:${MONO};` : ''}color:${color};border-bottom:1px solid ${C.hair};">${value}</td>
  </tr>`;
}

export function emailDataBox(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-line" style="margin:0 0 22px;border-top:1px solid ${C.hair};">${rows}</table>`;
}

export function amountBlock(accent, big, caption) {
  const green = accent === '#059669' || accent === C.money;
  return `<div style="margin:2px 0 16px;">
    <div class="bb-m" style="font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.mut};margin:0 0 2px;">${caption}</div>
    <div class="${green ? 'bb-money' : 'bb-h'}" style="font-family:${SANS};font-size:38px;line-height:1.15;font-weight:600;letter-spacing:-.5px;color:${green ? C.money : C.ink};">${big}</div>
  </div>`;
}

export function ticketBlock({ label, big, note }) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 14px;"><tr><td class="bb-panel" style="background:${C.panel};border:1px solid ${C.cardBorder};border-radius:12px;padding:15px 18px;">
    <div class="bb-m" style="font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.mut};">${label}</div>
    <div class="bb-money" style="font-family:${SANS};font-size:30px;font-weight:600;letter-spacing:-.4px;color:${C.money};margin:4px 0 2px;">${big}</div>
    <div class="bb-m" style="font-size:13px;color:${C.mut};">${note}</div>
  </td></tr></table>`;
}

export function expiryStrip(daysLeft, dateStr) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-line" style="margin:0 0 18px;border-top:1px solid ${C.hair};border-bottom:1px solid ${C.hair};"><tr>
    <td class="bb-amber" style="padding:10px 0;font-size:13.5px;font-weight:600;color:${C.amber};">Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</td>
    <td class="bb-amber" align="right" style="padding:10px 0;font-size:13.5px;font-weight:600;color:${C.amber};">${dateStr}</td>
  </tr></table>`;
}

export function stepsBlock(steps) {
  const rows = steps.map((s, i) => `<tr>
    <td width="24" valign="top" style="padding:6px 0;"><div class="bb-em bb-line" style="width:22px;height:22px;border-radius:50%;border:1.5px solid ${C.accent};color:${C.accent};font-size:11.5px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</div></td>
    <td class="bb-t" style="padding:7px 0 6px 12px;font-size:14px;line-height:1.5;color:${C.body};">${s}</td>
  </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">${rows}</table>`;
}

export function quoteBlock(text, who) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td style="border-left:3px solid ${C.accent};padding:2px 0 2px 16px;">
    <p class="bb-h" style="font-family:${SERIF};font-size:19px;line-height:1.4;font-style:italic;color:${C.ink};margin:0 0 6px;">&ldquo;${text}&rdquo;</p>
    <p class="bb-m" style="font-size:12.5px;font-weight:600;color:${C.mut};margin:0;">${who}</p>
  </td></tr></table>`;
}

export function warnBlock(html) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td class="bb-warn" style="background:#fbf3ea;border:1px solid #efdcc6;border-radius:12px;padding:14px 16px;">
    <div class="bb-warn-t" style="font-size:13.5px;line-height:1.6;color:#6b4a2a;">${html}</div>
  </td></tr></table>`;
}

export function referCard() {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;"><tr><td class="bb-panel" style="background:${C.panel};border-radius:12px;padding:12px 14px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="middle">${iconImg('gift', 34)}</td>
      <td class="bb-t" style="padding-left:12px;font-size:13.5px;line-height:1.5;color:${C.body};"><strong class="bb-b" style="color:${C.ink};font-weight:600;">Bring a friend, both of you earn.</strong> Share your referral link and you both get a bonus on their first deposit.</td>
    </tr></table>
  </td></tr></table>`;
}

export function codeBlock(code, { label = 'Your code', note = 'Never share this code with anyone. Nitro will never ask for it.' } = {}) {
  const spaced = String(code).replace(/(\d{3})(\d{3})/, '$1 $2');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 20px;"><tr><td class="bb-panel" style="background:${C.panel};border:1px solid ${C.cardBorder};border-radius:12px;padding:15px 18px 14px;">
    <div class="bb-m" style="font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.mut};">${label}</div>
    <div class="bb-code-c" style="font-family:${MONO};font-size:26px;font-weight:600;letter-spacing:5px;color:${C.accent};margin:6px 0 4px;">${spaced}</div>
    <div class="bb-m" style="font-size:12.5px;line-height:1.5;color:${C.mut};">${note}</div>
  </td></tr></table>`;
}

export function featureTrio() {
  const items = [
    ['bolt', 'Delivery starts in seconds'],
    ['audience', 'Real Nigerian audience'],
    ['naira', 'Wallet in Naira'],
  ];
  const rows = items.map(([icon, label], i) => `<tr><td class="bb-line" style="padding:9px 14px;${i ? `border-top:1px solid ${C.hair};` : ''}">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="middle">${iconImg(icon, 34)}</td>
      <td class="bb-b" valign="middle" style="padding-left:12px;font-size:14px;font-weight:500;color:${C.ink};">${label}</td>
    </tr></table>
  </td></tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-line" style="margin:0 0 22px;border:1px solid ${C.cardBorder};border-radius:12px;border-collapse:separate;">${rows}</table>`;
}

// The bonus ladder: coins that grow with the amount, so "the more you add, the
// bigger the push" is visible before it is read.
export function tierCards() {
  const coin = (n) => Array.from({ length: n }, (_, i) => {
    const px = 18 + i * 4;
    return `<img src="${A}/coin.png" width="${px}" height="${px}" alt="" class="bb-d" style="display:inline-block;border:0;vertical-align:bottom;"/><img src="${A}/coin-dark.png" width="${px}" height="${px}" alt="" class="bb-n" style="display:none;border:0;vertical-align:bottom;"/>`;
  }).join('');
  const rows = BONUS_PRESETS.map((p, i) => {
    const hot = !!p.tag;
    return `<tr><td class="${hot ? 'bb-panel ' : ''}bb-line" style="padding:10px 14px;${hot ? `background:${C.panel};` : ''}${i ? `border-top:1px solid ${C.cardBorder};` : ''}">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="78" valign="middle" style="line-height:0;white-space:nowrap;">${coin(i + 1)}</td>
        <td class="bb-b" valign="middle" style="font-size:14px;font-weight:600;color:${C.ink};">Add &#8358;${p.amount.toLocaleString()}${hot ? `<div class="bb-em" style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${C.accent};">${p.tag}</div>` : ''}</td>
        <td class="bb-money" align="right" valign="middle" style="font-size:14px;font-weight:600;color:${C.money};white-space:nowrap;">+&#8358;${p.bonus.toLocaleString()} free</td>
      </tr></table>
    </td></tr>`;
  }).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-line" style="margin:0 0 22px;border:1px solid ${C.cardBorder};border-radius:12px;border-collapse:separate;overflow:hidden;">${rows}</table>`;
}

// ═══ CHANNEL CARD ═══
// One per email, in place of the old WhatsApp-only card. sendEmail picks it
// from the recipient and the Lagos date, so a person sees a different channel
// from email to email and a day's sends split evenly across the four. A
// channel with no handle in Admin → Settings is skipped.

const FALLBACK_WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q';
const handleOf = (raw, strip) => (raw ? String(raw).trim().replace(strip, '').replace(/^@/, '').replace(/[/?#].*$/, '') : '');

export function channelList({ wa, social_instagram, social_twitter, social_tiktok } = {}) {
  const ig = handleOf(social_instagram, /^(https?:\/\/)?(www\.)?instagram\.com\//i) || SITE.social.instagram;
  const x = handleOf(social_twitter, /^(https?:\/\/)?(www\.)?(x|twitter)\.com\//i) || SITE.social.twitter;
  const tt = handleOf(social_tiktok, /^(https?:\/\/)?(www\.)?tiktok\.com\/@?/i);
  return [
    { key: 'wa', name: 'WhatsApp', title: 'Follow The Nitro NG on WhatsApp', line: 'Delivery updates, deal days and service news.', url: wa || FALLBACK_WA_CHANNEL },
    { key: 'ig', name: 'Instagram', title: `@${ig} on Instagram`, line: "Growth tips and what's new on Nitro.", url: `https://instagram.com/${ig}` },
    ...(tt ? [{ key: 'tt', name: 'TikTok', title: `@${tt} on TikTok`, line: 'Short how-tos for growing your page.', url: `https://tiktok.com/@${tt}` }] : []),
    { key: 'x', name: 'X', title: `@${x} on X`, line: 'Quick updates and service news.', url: `https://x.com/${x}` },
  ];
}

export function pickChannel(list, email, now = new Date()) {
  let h = 0;
  for (const ch of String(email || '').toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // Lagos is UTC+1 all year, so this day number turns over at Lagos midnight.
  // A rotation, not a reporting window, so it does not need report-window.
  const day = Math.floor((now.getTime() + 3600000) / 86400000);
  return list[(h + day) % list.length];
}

function channelCard(ch) {
  return `<tr><td class="bb-line bb-pad" style="padding:15px 28px;border-top:1px solid ${C.hair};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="34" valign="middle"><img src="${A}/ch-${ch.key}.png" width="34" height="34" alt="${ch.name}" style="display:block;border:0;border-radius:9px;"/></td>
        <td valign="middle" style="padding-left:12px;">
          <div class="bb-b" style="font-size:13.5px;font-weight:600;color:${C.ink};">${escapeEmailText(ch.title)}</div>
          <div class="bb-m" style="font-size:12.5px;line-height:1.45;color:${C.mut};">${ch.line}</div>
        </td>
        <td align="right" valign="middle" style="padding-left:10px;"><a class="bb-em" href="${escapeEmailText(ch.url)}" style="font-size:13px;font-weight:700;color:${C.accent};text-decoration:none;white-space:nowrap;">Follow</a></td>
      </tr></table>
    </td></tr>`;
}

function socialRow(list) {
  return `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;"><tr>${list.map(ch =>
    `<td style="padding:0 4px;"><a href="${escapeEmailText(ch.url)}"><img src="${A}/foot-${ch.key}.png" width="26" height="26" alt="${ch.name}" style="display:block;border:0;"/></a></td>`).join('')}</tr></table>`;
}

let channelCache = null;
let channelCacheAt = 0;
async function loadChannels() {
  if (channelCache && Date.now() - channelCacheAt < 10 * 60 * 1000) return channelCache;
  const s = {};
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['social_instagram', 'social_twitter', 'social_tiktok'] } },
      select: { key: true, value: true },
    });
    for (const r of rows) s[r.key] = r.value;
  } catch { /* the site defaults in channelList */ }
  const wa = await getWhatsAppChannelUrl().catch(() => null);
  channelCache = channelList({ wa, ...s });
  channelCacheAt = Date.now();
  return channelCache;
}

/** Fills the channel card and the footer icons for one recipient. */
export async function fillChannels(html, to, now = new Date()) {
  if (!html.includes('{{CHANNEL_CARD}}') && !html.includes('{{SOCIAL_ROW}}')) return html;
  const list = await loadChannels();
  return html
    .replace('{{CHANNEL_CARD}}', channelCard(pickChannel(list, to, now)))
    .replace('{{SOCIAL_ROW}}', socialRow(list));
}

// ═══ SHARED SHELL ═══
// Backward compatible: emailWrap({ body }) still works, and legacy callers
// passing { title, label } are mapped: title becomes a headline, label the
// label. Options from the last design (accent, pillTone, hero, topStrip) are
// ignored rather than rejected.
//   icon       a tile above the body (see public/email/icon-*.png)
//   noChannel  no channel card and no footer icons: codes, resets, deletion
//   footNote   replaces the account line and its unsubscribe link, for mail to
//              someone without an account (a guest's receipt) or about security
export function emailWrap({ body, pill, title, label, footNote, icon, noChannel } = {}) {
  if (!pill && label) pill = label;
  if (title) body = headline(title, 21) + body;
  if (icon) body = iconTile(icon) + body;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,600;1,600&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light dark}
@media(prefers-color-scheme:dark){
.bb-body{background:#0c0814!important}
.bb-card{background:#171126!important;border-color:#2e2439!important}
.bb-line{border-color:#2a2136!important}
.bb-h{color:#f6f1ee!important}
.bb-em{color:#e3a4b5!important}
.bb-t{color:#c6bfba!important}
.bb-b{color:#f6f1ee!important}
.bb-m{color:#918992!important}
.bb-panel{background:#1d1630!important;border-color:#2e2439!important}
.bb-money{color:#6ee7b7!important}
.bb-amber{color:#e0a458!important}
.bb-btn{background:#e3a4b5!important}
.bb-btn a{color:#2a1720!important}
.bb-code-c{color:#e3a4b5!important}
.bb-warn{background:#2a2016!important;border-color:#45331f!important}
.bb-warn-t,.bb-warn-b{color:#e6c9a6!important}
.bb-refer{background:#1d1630!important}
.bb-s1,.bb-s2,.bb-s3{background:#1d1630!important}
.bb-foot{color:#918992!important}
.bb-foot a{color:#e3a4b5!important}
.bb-d{display:none!important}
.bb-n{display:block!important}
}
@media only screen and (max-width:600px){
.bb-shell{padding:14px 8px!important}
.bb-pad{padding-left:20px!important;padding-right:20px!important}
.bb-btn-wrap{width:100%!important}
.bb-btn a{display:block!important;text-align:center!important}
.stack{display:block!important;width:100%!important;padding:7px 0!important}
}
</style>
</head>
<body class="bb-body" style="margin:0;padding:0;background:${C.canvas};font-family:${SANS};-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-body" style="background:${C.canvas};">
<tr><td align="center" class="bb-shell" style="padding:24px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" class="bb-card" style="max-width:520px;width:100%;background:${C.card};border-radius:16px;border:1px solid ${C.cardBorder};overflow:hidden;">
    <tr><td class="bb-line bb-pad" style="padding:17px 28px;border-bottom:1px solid ${C.hair};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle">
          <img src="${SITE.url}/wordmark-accent.png" width="65" height="20" alt="Nitro" class="bb-d" style="display:block;border:0;"/>
          <img src="${SITE.url}/wordmark-white.png" width="65" height="20" alt="Nitro" class="bb-n" style="display:none;border:0;"/>
        </td>
        ${pill ? `<td align="right" valign="middle" class="bb-m" style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.mut};">${pill}</td>` : ''}
      </tr></table>
    </td></tr>
    <tr><td class="bb-pad" style="padding:28px 28px 26px;font-family:${SANS};">
      ${body}
    </td></tr>
${noChannel ? '' : '    {{CHANNEL_CARD}}\n'}  </table>

  <table cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;"><tr>
    <td align="center" style="padding:16px 0 0;">
      ${noChannel ? '' : '{{SOCIAL_ROW}}'}
      <p class="bb-foot" style="font-size:11.5px;color:${C.mut};margin:0;line-height:1.7;">The Nitro NG, Lagos, Nigeria<br/>${footNote || `You're receiving this because you have a Nitro account. <a href="{{UNSUB_URL}}" style="color:${C.accent};">Unsubscribe</a>`}</p>
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
    log.info('Email', `To: ${to} | Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }
  const finalHtml = (await fillChannels(html, to)).replace(/\{\{UNSUB_URL\}\}/g, unsubUrl(to));
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
      log.info('Email', `Sent: ${subject} (messageId: ${data.messageId})`);
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
    noChannel: true,
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
  const subject = "You're in, welcome to Nitro";
  const html = preheader("Your page is about to stop being a secret. Here's how to start.") + emailWrap({
    pill: 'Welcome',
    icon: 'rocket',
    body: `
      ${headline(`You're in.<br/>Let's make some ${em('noise')}.`)}
      ${para('Thousands of Nigerian creators and businesses use Nitro to grow their content. Now you\'ve got the same tools they do.')}
      ${featureTrio()}
      ${emailCTA(`${SITE.url}/dashboard`, 'Go to your dashboard &#8594;')}
      ${mutedLine('Fund your wallet, pick what you need, and you are off.')}
      ${referCard()}
    `,
  });
  return sendEmail(to, subject, html, `Welcome to Nitro, ${name}! Head to your dashboard: ${SITE.url}/dashboard`);
}

// ═══ 3. PASSWORD RESET ═══
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = preheader('Tap the button to choose a new one. Link expires in 30 minutes.') + emailWrap({
    pill: 'Security',
    noChannel: true,
    footNote: "You're receiving this because someone asked to reset the password on this account.",
    body: `
      ${headerRow('lock', "Let's get you back in.")}
      ${para(`Hi ${name}, someone requested a password reset for your account. If that was you, tap below to choose a new one.`, 18)}
      ${emailCTA(resetUrl, 'Reset my password')}
      ${mutedLine('This link expires in 30 minutes.')}
      ${mutedLine("If you didn't request this, ignore this email. Your password won't change.", 'left', 6)}
    `,
  });
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

// ═══ 4. ACCOUNT DELETION SCHEDULED ═══
export function accountDeletionEmail(name, daysLeft) {
  return emailWrap({
    pill: 'Account',
    icon: 'shield',
    noChannel: true,
    body: `
      ${headline('Sad to see you go.', 21)}
      ${para(`Hi ${name}, your Nitro account has been scheduled for permanent deletion in ${bold(`${daysLeft} days`)}.`)}
      ${warnBlock(`<strong style="color:#5c3f24;">This cannot be undone after 30 days:</strong> your personal details and wallet balance are removed. Financial records we must retain are stripped of your contact details.`)}
      ${para(`If this was a mistake or you changed your mind, reach us at ${bold('support@nitro.ng')} before the 30-day deadline and we'll cancel it.`, 18)}
      ${emailCTA('mailto:support@nitro.ng', 'Keep my account')}
    `,
  });
}

// Refund emails are paused (Trip, 17 Oct 2026). The refund itself still
// happens and still shows in the wallet and on the order; only the email stops.
// Set this to false to send them again.
export const REFUND_EMAILS_PAUSED = true;

// ═══ 5/6. WALLET: DEPOSIT / REFUND / GENERIC CREDIT ═══
// Backward compatible: walletCreditEmail(name, amount, reason) still works (generic credit).
// opts: { kind: 'deposit'|'refund'|'credit', bonus, method, orderRef, failReason, pointsRestored }
// No balance figure in any email (Trip, 17 Oct 2026): the amount that moved, never the total after it.
export function walletCreditEmail(name, amount, reason, opts = {}) {
  const kind = opts.kind || 'credit';
  if (kind === 'deposit') {
    const bonus = Number(opts.bonus || 0);
    const total = Number(amount) + bonus;
    let rows = '';
    if (bonus > 0) rows += emailRow('Welcome credit', `+₦${bonus.toLocaleString()}`, '#059669');
    if (opts.method) rows += emailRow('Method', opts.method);
    return preheader('Your deposit landed and is ready to spend.') + emailWrap({
      pill: 'Wallet',
      body: `
        ${headerRow('wallet-green', 'Money in.')}
        ${para(`Hi ${name}, your deposit of ${bold(`₦${Number(amount).toLocaleString()}`)} just landed and it's ready to spend.`)}
        ${bonus > 0 ? para(`And because it's your first deposit, we added ${bold(`₦${bonus.toLocaleString()} in free welcome credit`)} on top. It spends like cash on any service.`) : ''}
        ${amountBlock('#059669', `+₦${total.toLocaleString()}`, bonus > 0 ? `₦${Number(amount).toLocaleString()} deposit + ₦${bonus.toLocaleString()} welcome credit` : 'Added to your wallet')}
        ${rows ? emailDataBox(rows) : ''}
        ${para("Pick a platform, choose what you need, and you're off. Most orders start delivering within a minute.", 18)}
        ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Place an order &#8594;')}
        ${signOff()}
      `,
    });
  }

  if (kind === 'refund') {
    const pts = Number(opts.pointsRestored || 0);
    let rows = '';
    if (opts.orderRef) rows += emailRow('Order', opts.orderRef);
    if (opts.failReason) rows += emailRow('Reason', opts.failReason);
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
    return preheader("An order couldn't complete, so the money came straight back.") + emailWrap({
      pill: 'Refund',
      body: `
        ${headerRow('refund', 'Money back.')}
        ${para(blurb)}
        ${blocks}
        ${rows ? emailDataBox(rows) : ''}
        ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Reorder in one tap &#8594;')}
        ${mutedLine(hasPoints ? 'Wallet credit and points are available instantly.' : 'Refunds land instantly as spendable wallet credit.')}
      `,
    });
  }

  // generic credit (admin top-ups, gifts)
  return emailWrap({
    pill: 'Wallet',
    body: `
      ${headerRow('wallet-green', 'Money in.')}
      ${para(`Hi ${name}, ${reason || 'your Nitro wallet just got a top up.'}`)}
      ${amountBlock('#059669', `+₦${Number(amount).toLocaleString()}`, 'Added to your wallet')}
      ${emailCTA(`${SITE.url}/dashboard`, 'Check your balance')}
    `,
  });
}

// ═══ 7. BULK ORDER PLACED ═══
export function batchPlacementEmail(name, batchId, total, placed, failed, totalCharge) {
  let rows = emailRow('Batch', batchId) + emailRow('Total orders', total) + emailRow('Processing', placed, '#059669');
  if (failed > 0) rows += emailRow('Pending retry', failed, '#d9821a');
  rows += emailRow('Total charged', `₦${totalCharge.toLocaleString()}`, undefined, { total: true });
  return emailWrap({
    pill: 'Orders',
    body: `
      ${headerRow('list', "Orders in. We're on it.")}
      ${para(`Hi ${name}, your bulk order has been submitted and is now processing.`)}
      ${emailDataBox(rows)}
      ${mutedLine("Orders that couldn't be placed immediately retry automatically. If they still don't go through, you're refunded.", 'left', 0)}
      <div style="height:16px;font-size:0;">&nbsp;</div>
      ${emailCTA(`${SITE.url}/dashboard`, 'Track my orders &#8594;')}
    `,
  });
}

// ═══ 24. GUEST ORDER RECEIPT ═══
// For someone who ordered without an account: no name, no wallet, no
// dashboard, so the guest code is the way back to the order.
export function guestReceiptEmail({ code, orderId, service, tier, quantity, link, paidKobo, creditKobo = 0 }) {
  const shortLink = String(link || '').replace(/^https?:\/\/(www\.)?/, '');
  let rows = emailRow('Order', escapeEmailText(orderId))
    + emailRow('Service', escapeEmailText(service))
    + (tier ? emailRow('Quality', escapeEmailText(tier)) : '')
    + emailRow('Quantity', Number(quantity || 0).toLocaleString('en-NG'))
    + emailRow('Link', escapeEmailText(shortLink.length > 34 ? `${shortLink.slice(0, 33)}…` : shortLink));
  rows += paidKobo > 0
    ? emailRow('Paid', `₦${Math.round(paidKobo / 100).toLocaleString('en-NG')}`, undefined, { total: true })
    : emailRow('Paid', 'With credit', '#059669', { total: true });
  if (paidKobo > 0 && creditKobo > 0) rows += emailRow('Credit used', `₦${Math.round(creditKobo / 100).toLocaleString('en-NG')}`, '#059669');
  return preheader('Your guest code is inside. Use it to track this order.') + emailWrap({
    pill: 'Order',
    footNote: "You're receiving this because you ordered on Nitro and asked for a receipt.",
    body: `
      ${headerRow('list', "Order in. We're on it.")}
      ${para('Thanks for ordering with Nitro. Your order is placed and on its way.')}
      ${codeBlock(escapeEmailText(code), { label: 'Your guest code', note: 'Use it to track this order or spend any credit. Keep it private.' })}
      ${emailDataBox(rows)}
      ${emailCTA(`${SITE.url}/order/${encodeURIComponent(code)}`, 'Track this order &#8594;')}
      ${mutedLine("If part of it can't be delivered, the money comes back as credit on your guest code. Questions? Message us on WhatsApp and quote your guest code.")}
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
  const html = preheader("You're in. One quick step to give it a real push, up to ₦1,500 free.") + emailWrap({
    pill: 'Bonus live',
    icon: 'megaphone',
    body: `
      ${headline(`Give it the push it ${em('deserves')}.`)}
      ${para(`Hi ${firstName}, you came to Nitro for one reason: to get your content in front of more people. You're one step away from doing exactly that.`)}
      ${para(`Your first deposit unlocks ${bold('up to ₦1,500 in free promo credit')}, applied automatically. No codes needed.`)}
      <p class="bb-m" style="font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.mut};margin:0 0 8px;">The more you add, the bigger the push</p>
      ${tierCards()}
      ${emailCTA(`${SITE.url}/dashboard?page=add-funds`, 'Add funds and push my content &#8594;')}
      ${mutedLine('Real engagement. Fast start. No foreign wahala.')}
    `,
  });
  return sendEmail(to, 'Your content is still waiting to be seen', html,
    `Hi ${firstName}, you're one step from getting your content seen. Fund your wallet and get up to N1,500 in free credit. Start here: ${SITE.url}/dashboard?page=add-funds`);
}

// ═══ 10. AD ACTIVATION DAY 3 (proof + steps) ═══
export function sendAdActivationDay3(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = preheader('Test Nitro small, watch your numbers move, then decide.') + emailWrap({
    pill: 'Try it small',
    icon: 'naira',
    body: `
      ${headline(`Start with ${em('₦1,000')}. Seriously.`)}
      ${para(`Hi ${firstName}, totally fair to be careful. Plenty of "growth" tools out there don't do anything real, so don't take our word for it. Point ₦1,000 at one post and watch what happens.`)}
      ${stepsBlock([`Pick ${bold('what to push')}`, `Paste ${bold('your link')}`, `Watch it ${bold('move, live')}`])}
      ${quoteBlock('I was posting every week and getting nothing. Pushed one video with Nitro and it finally started moving.', 'Tunde, creator')}
      ${para(`Like what you see? Top up ${bold('₦2,500 or more')} and up to ₦1,500 in free credit kicks in automatically.`, 18)}
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
    icon: 'bolt',
    body: `
      ${headline('The honest pitch.', 21)}
      ${para(`Hi ${firstName}, you signed up a few days ago and haven't taken Nitro for a spin. No pressure, and this is the last time we'll remind you about it.`)}
      ${para('The creators, artists and brands who actually grow are the ones who put their content in front of people, instead of posting and hoping the algorithm notices. That is the whole job Nitro does.')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td class="bb-panel" align="center" style="background:${C.panel};border:1px solid ${C.panelLine};border-radius:14px;padding:14px 16px;">
        <p class="bb-t" style="font-size:13.5px;line-height:1.65;color:${C.body};margin:0;">Your first deposit still gets ${bold('up to ₦1,500 in free credit')}. If you've got a post, a song, or a page that deserves more eyes, this is your sign.</p>
      </td></tr></table>
      ${emailCTA(`${SITE.url}/dashboard?page=add-funds`, 'Push my content now &#8594;')}
      ${mutedLine("Not the right time? No wahala, you won't hear about this again.")}
    `,
  });
  return sendEmail(to, 'Our last reminder, we promise', html,
    `Hi ${firstName}, last reminder: your free promo credit is still waiting. Fund your wallet and get up to N1,500 free to push your content. Your call: ${SITE.url}/dashboard?page=add-funds`);
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
      pill: 'Deal day',
      icon: 'tag',
      body: `
        ${headline(`${promotionName} is ${em('live')}.`, 22)}
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td align="center" style="padding:22px 20px;background:${bgColor};border-radius:18px;">
          <div style="font-family:${SANS};font-size:40px;font-weight:600;letter-spacing:-.5px;color:${color};">${discountPercent}% OFF</div>
          <div style="font-size:13px;font-weight:700;color:${color};margin-top:6px;">${bannerCopy || 'All services, today only'}</div>
        </td></tr></table>
        ${para(`Hi ${user.name || 'there'}, place an order now and the discount is applied automatically at checkout. No codes needed.${capStr ? ' ' + capStr : ''}`)}
        ${endsStr ? `<p class="bb-amber" style="font-size:13.5px;font-weight:600;color:${C.amber};margin:0 0 18px;">Ends ${endsStr}</p>` : ''}
        ${emailCTA(`${SITE.url}/dashboard`, theme?.ctaText || 'Grab the deal &#8594;')}
      `,
    });
    try {
      await sendEmail(user.email, subject, html, `${promotionName} — ${discountPercent}% off all orders at Nitro. Order now: ${SITE.url}/dashboard`);
      sent++;
    } catch {}
  }
  log.info('Email', `Promotion blast: ${sent}/${users.length} sent for "${promotionName}"`);
  return sent;
}

// ═══ 13. LEADERBOARD REWARD ═══
export function leaderboardRewardEmail(name, amount) {
  return emailWrap({
    pill: 'Reward',
    icon: 'trophy',
    body: `
      ${headline(`You made the ${em('board')}.`, 21)}
      ${para(`Nice one ${name}. You made the Nitro leaderboard this month and the reward is already sitting in your wallet.`)}
      ${amountBlock('#059669', `+₦${amount.toLocaleString()}`, 'Leaderboard reward')}
      ${emailCTA(`${SITE.url}/dashboard`, 'View my wallet &#8594;')}
      ${mutedLine('Keep it going. The leaderboard resets every month.')}
    `,
  });
}

// ═══ 14. REFERRAL BONUS ═══
export function referralBonusEmail(name, amount) {
  return emailWrap({
    pill: 'Referral',
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
    icon: 'gift',
    body: `
      ${headline(`Your page didn't stop.<br/>${em('You did.')}`)}
      ${para("It's been about a month. Maybe life happened, fair. But the algorithm didn't pause with you. The accounts you were outpacing are still running the play, and the gap you'd closed is quietly reopening.")}
      ${para(`So we put ${bold(`${amt} in free promo credit`)} in your wallet, to make coming back easy. It's live now and it spends on anything.`)}
      ${ticketBlock({ label: 'Already in your wallet', big: `${amt} FREE`, note: 'Spends on any service. No code needed.' })}
      ${expiryStrip(days, expiryDateStr(days))}
      ${para('You already know how this works. Pick the post that deserves better numbers, point the credit at it, watch it move.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, `Use my ${amt} before it expires &#8594;`)}
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
    icon: 'gift',
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
export function sendNudgeIdleFunds(name, to) {
  const subject = 'Your wallet is funded. Ready to go?';
  const html = preheader('Your money is sitting there ready. First order takes about a minute.') + emailWrap({
    pill: 'Ready',
    body: `
      ${headerRow('bolt', 'Loaded. Not launched.')}
      ${para(`Hi ${name}, you added money to your Nitro wallet a little while back, but you haven't placed your first order yet.`)}
      ${para('That is more than enough to get started. Pick a platform, choose what you need, and Nitro handles the rest. Most orders start delivering within a minute.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Place my first order &#8594;')}
      ${mutedLine('Not sure where to start? Instagram followers and TikTok views are the most popular picks.')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have money in your Nitro wallet. Place your first order: ${SITE.url}/dashboard`);
}

// ═══ 18. IDLE BALANCE (money sitting 7+ days) ═══
export function sendNudgeIdleBalance(name, to) {
  const subject = "You've still got money in your wallet";
  const html = preheader("Quick heads up, it's been sitting there over a week.") + emailWrap({
    pill: 'Wallet',
    body: `
      ${headerRow('wallet-green', "It's just sitting there.")}
      ${para(`Hi ${name}, quick heads up: you have money in your Nitro wallet that hasn't been touched in over a week.`)}
      ${para('Your money, your timeline. But if you are looking to give your content a push, everything is already set up and ready to go.', 18)}
      ${emailCTA(`${SITE.url}/dashboard?page=order`, 'Use my balance &#8594;')}
    `,
  });
  return sendEmail(to, subject, html, `Hi ${name}, you have money in your Nitro wallet. Put it to work: ${SITE.url}/dashboard`);
}

// ═══ 20. PIT APPLICATION APPROVED ═══
export function pitApprovedEmail(name) {
  return preheader('Your application was approved and your referral link is live.') + emailWrap({
    pill: 'The Pit',
    body: `
      ${headerRow('check-purple', 'Welcome to the crew.')}
      ${para(`Hi ${name}, good news: your Pit application has been approved.`)}
      ${para('Your referral link is already live. Log into the Pit portal to grab it, share it, and watch your commissions build.')}
      ${para('Everything you need, your link, your numbers, your payouts, lives in the portal.', 18)}
      ${emailCTA(`${SITE.url}/pit`, 'Go to the Pit &#8594;')}
      ${signOff()}
    `,
  });
}

// ═══ 21. PIT MEMBER SUSPENDED ═══
export function pitSuspendedEmail(name) {
  return preheader('Commissions are on hold while your account is paused.') + emailWrap({
    pill: 'Paused',
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
    body: `
      ${headerRow('send', 'Payout sent.')}
      ${para(`Hi ${name}, your payout of ${bold(amt)} has been sent to your bank. Depending on your bank, it can take a little while to reflect.`)}
      ${amountBlock('#059669', amt, 'Sent to your bank')}
      ${emailDataBox(rows)}
      ${para('Keep the reference handy in case you ever need to ask about this payment. Nice work, your earnings page has the full breakdown.', 18)}
      ${emailCTA(`${SITE.url}/pit`, 'View my earnings &#8594;')}
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
    body: `
      ${headerRow('refund-amber', 'Back in your balance.')}
      ${para(`Hi ${name}, we couldn't process your payout this time, so the held amount has been returned to your commission balance in full.`)}
      ${emailDataBox(rows)}
      ${para("Nothing is lost. You can request again anytime, and if you're not sure what went wrong, support can tell you exactly.", 18)}
      ${emailCTA(`${SITE.url}/pit`, 'View my earnings &#8594;')}
      ${signOff()}
    `,
  });
}

// ═══ PIT APPLICATION UPDATE (rejection — canon copy, new shell) ═══
export function pitRejectionEmail(name) {
  return emailWrap({
    pill: 'The Pit',
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
    'We check it, and the credit lands in your wallet',
  ].map((s, i) => `<tr><td width="22" style="padding:5.5px 0;"><div style="width:22px;height:22px;border-radius:50%;background:#c4576f;background:linear-gradient(135deg,#e26a8d,#c47d8e);color:#ffffff;font-size:11px;font-weight:800;text-align:center;line-height:22px;">${i + 1}</div></td>
    <td class="bb-t" style="padding:5.5px 0 5.5px 11px;font-size:12.5px;line-height:1.5;color:${C.body};">${s}</td></tr>`).join('');
  const html = preheader('Follow, share, post. Each task adds free credit to your wallet.') + emailWrap({
    pill: 'New',
    icon: 'check',
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
  return sendEmail(to, 'Do a small task, earn free credit', html,
    `Hi ${firstName}, the Tasks page is live. Do a small task (follow, share, post), show proof, and free credit lands in your wallet, from N100 up to N5,000 per task. ${SITE.url}/dashboard`);
}

// ═══ 26. BRAND WELCOME / "why Nitro" broadcast (manual send) ═══
// Design approved by Trip 12 Jul 2026. Stats confirmed same day —
// RECHECK they still match the live site before every send.
export const BRAND_STATS = [
  { value: '20K+', label: 'Orders placed',      color: '#c4576f', bg: '#fdf1f5', cls: 'bb-s1' },
  { value: '3.8K', label: 'Accounts created',   color: '#7c5bd0', bg: '#f2eefc', cls: 'bb-s2' },
  { value: '92%',  label: 'Delivery benchmark', color: '#0a7d54', bg: '#e6f6ef', cls: 'bb-s3' },
];

const BRAND_BENEFITS = [
  ['bolt',         'Starts in seconds',       'Most orders begin moving in under a minute.'],
  ['wallet',       'Naira pricing',           'Local rates, no FX markup, no hidden fees.'],
  ['grid',         '35+ platforms',           'Instagram, TikTok, YouTube, X, Spotify and more.'],
  ['shield-green', 'Refill protection',       'Drops on eligible services get topped up, free.'],
  ['refund',       'Automatic refunds',       "If an order doesn't deliver, the money comes back."],
  ['whatsapp',     'Real humans on WhatsApp', 'A person replies, day or night. Not a bot.'],
];

function statCards() {
  const cells = BRAND_STATS.map((s) =>
    `<td class="${s.cls}" align="center" valign="middle" style="background:${s.bg};border-radius:13px;padding:14px 8px 12px;">
      <div style="font-family:${MONO};font-size:20px;font-weight:700;color:${s.color};white-space:nowrap;">${s.value}</div>
      <div class="bb-m" style="font-size:9.5px;font-weight:700;letter-spacing:.3px;color:${C.mut};margin-top:4px;line-height:1.3;">${s.label}</div>
    </td>`).join('');
  return `<table width="100%" cellspacing="6" cellpadding="0" border="0" style="margin:0 0 26px;table-layout:fixed;"><tr>${cells}</tr></table>`;
}

function benefitGrid() {
  let rows = '';
  for (let i = 0; i < BRAND_BENEFITS.length; i += 2) {
    const left = BRAND_BENEFITS[i];
    const right = BRAND_BENEFITS[i + 1];
    const cell = ([icon, title, desc]) => `
      <td class="stack" width="48%" valign="top" style="padding:0 0 14px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="30" valign="top" style="padding-top:2px;"><img src="${A}/chip-${icon}.png" width="30" height="30" alt="" style="display:block;border-radius:10px;"/></td>
          <td style="padding-left:9px;">
            <div class="bb-b" style="font-size:12.5px;font-weight:800;color:${C.ink};line-height:1.3;">${title}</div>
            <div class="bb-t" style="font-size:11.5px;line-height:1.5;color:${C.body};margin-top:2px;">${desc}</div>
          </td>
        </tr></table>
      </td>`;
    rows += '<tr>' + cell(left) +
      `<td width="4%" valign="top" style="padding:0 0 14px;"><table cellpadding="0" cellspacing="0" border="0" height="100%"><tr><td style="width:1px;background:${C.panelLine};font-size:0;line-height:0;">&nbsp;</td></tr></table></td>` +
      (right ? cell(right) : '<td width="48%"></td>') + '</tr>';
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;table-layout:fixed;">${rows}</table>`;
}

export function sendBrandWelcomeEmail(name, to) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = preheader('Real reach, Naira pricing, and humans who actually reply.') + emailWrap({
    pill: 'Nitro',
    icon: 'rocket',
    body: `
      ${headline(`Glad you're ${em('here')}.`)}
      ${para(`Hi ${firstName}, whether you're a creator, an artist, a business, or someone who runs pages for clients, the job is the same: get good content in front of more people. That's the only thing we build for.`, 18)}
      ${statCards()}
      ${benefitGrid()}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td class="bb-refer" style="background:#ffe9ee;background:linear-gradient(135deg,#fff1e4,#ffe4ec);border-radius:14px;padding:13px 16px;">
        <div class="bb-b" style="font-size:12.5px;font-weight:800;color:${C.ink};">And every order gives something back</div>
        <div class="bb-t" style="font-size:11.5px;line-height:1.55;color:${C.body};margin-top:3px;">Your Nitro Status discount grows as you spend, and Nitro Points come back as credit for your next order.</div>
      </td></tr></table>
      ${emailCTA(`${SITE.url}/dashboard`, 'Go to my dashboard &#8594;')}
      ${mutedLine('Questions before you start? Message us on WhatsApp. Someone real answers.')}
      ${signOff()}
    `,
  });
  // Sender is noreply@ — never invite a reply. Point at WhatsApp or support@nitro.ng.
  return sendEmail(to, "Here's what makes Nitro different", html,
    `Hi ${firstName}, delivery starts in seconds, Naira pricing with no FX markup, 35+ platforms, refill protection, automatic refunds, and real humans on WhatsApp. ${SITE.url}/dashboard`);
}

export async function sendBrandBlast() {
  const users = await prisma.user.findMany({
    where: { status: 'Active', emailVerified: true, notifPromo: true },
    select: { email: true, name: true },
  });
  if (!users.length) return 0;

  const BATCH = 50;
  const DELAY = 1000;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i++) {
    try {
      await sendBrandWelcomeEmail(users[i].name, users[i].email);
      sent++;
    } catch {
      failed++;
    }
    if ((i + 1) % BATCH === 0 && i + 1 < users.length) {
      log.info('Email', `Brand blast progress: ${sent} sent, ${failed} failed / ${users.length} total`);
      await new Promise(r => setTimeout(r, DELAY));
    }
  }
  log.info('Email', `Brand blast complete: ${sent}/${users.length} sent, ${failed} failed`);
  return sent;
}
