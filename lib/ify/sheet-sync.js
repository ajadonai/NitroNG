import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { IFY } from './config';
import { log } from '@/lib/logger';

function parseCredentials() {
  const raw = IFY.promises.sheet.saKey;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    try { return JSON.parse(raw); } catch { return null; }
  }
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const sig = crypto.createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(creds.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${sig}`,
  });
  const data = await res.json();
  return data.access_token;
}

async function sheetsApi(token, sheetId, path, body, method = 'PUT') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'short', timeStyle: 'short' });
}

function toRow(p) {
  return [
    fmtDate(p.dueAt),
    p.state,
    p.customerName || '',
    p.customerNumber,
    p.orderNumber || '',
    p.promiseText,
    p.category,
    p.owner || '',
    fmtDate(p.lastUpdateAt),
    p.lastUpdateText || '',
  ];
}

const HEADER = ['Due At', 'State', 'Customer', 'Phone', 'Order', 'Promise', 'Category', 'Owner', 'Last Update', 'Update Text'];

export async function syncSheet() {
  const sheetId = IFY.promises.sheet.id;
  if (!sheetId) return;

  const creds = parseCredentials();
  if (!creds) { log.warn('Ify', 'Sheet sync: no credentials configured'); return; }

  const token = await getAccessToken(creds);
  if (!token) { log.warn('Ify', 'Sheet sync: auth failed'); return; }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [active, resolved] = await Promise.all([
    prisma.ifyPromise.findMany({
      where: { state: { not: 'resolved' } },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.ifyPromise.findMany({
      where: { state: 'resolved', resolvedAt: { gte: thirtyDaysAgo } },
      orderBy: { resolvedAt: 'desc' },
    }),
  ]);

  await sheetsApi(token, sheetId, '/values/Active!A:J', {
    values: [HEADER, ...active.map(toRow)],
  }, 'PUT').catch(() =>
    sheetsApi(token, sheetId, '/values/Sheet1!A:J', {
      values: [HEADER, ...active.map(toRow)],
    }),
  );

  await sheetsApi(token, sheetId, '/values/Resolved!A:J', {
    values: [HEADER, ...resolved.map(toRow)],
  }).catch(() => {});

  log.info('Ify', `Sheet synced: ${active.length} active, ${resolved.length} resolved`);
}
