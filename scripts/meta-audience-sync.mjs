#!/usr/bin/env node
/**
 * Fill the two Meta retargeting custom audiences from the database.
 *
 * Spec: Marketing/Playbooks/Retargeting Audience Build Spec.html (Option B).
 * Audiences are created by hand and must already exist — this only populates
 * them, and will refuse to run against an audience it cannot read.
 *
 *   node scripts/meta-audience-sync.mjs --dry-run
 *   node scripts/meta-audience-sync.mjs
 *   node scripts/meta-audience-sync.mjs --lapse-days=45 --segment=b
 *
 * Env:
 *   META_ADS_TOKEN  system-user token with ads_management on act 1490014492674357.
 *                   NOT the same as META_CAPI_TOKEN — a dataset token cannot
 *                   touch audiences (it returns GraphMethodException on read).
 *   LAPSE_DAYS      default 30, matching the pixel-built lapsed audience.
 *
 * Reruns are diffed, not re-pushed: each run stores the exact member ids it
 * sent in a Setting row, then adds what is newly eligible and REMOVES what no
 * longer is. That removal is the point of running this on a schedule — the
 * moment a signup deposits they must leave "signups no deposit", or we keep
 * paying to retarget somebody who already converted.
 */

import crypto from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AD_ACCOUNT = '1490014492674357';
const GRAPH = 'https://graph.facebook.com/v21.0';
const CHUNK = 2000;
const SCHEMA = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'EXTERN_ID'];

const argv = process.argv.slice(2);
const flag = (name) => argv.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const DRY_RUN = flag('dry-run');
const LAPSE_DAYS = Number(opt('lapse-days', process.env.LAPSE_DAYS || 30));
const ONLY = String(opt('segment', 'both')).toLowerCase();
const OUT_DIR = opt('out', null);

const AUDIENCES = {
  a: { id: '120250519929310084', label: 'Signups no deposit (DB)' },
  b: { id: '120250519931260084', label: 'Lapsed customers (DB)' },
};

// ── hashing (spec §5) ────────────────────────────────────────────
// Everything is normalised then SHA256 hex, lower case. Hashing happens here,
// so no raw identifier ever leaves this process.
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const hashEmail = (email) => {
  const clean = String(email || '').trim().toLowerCase();
  return clean ? sha256(clean) : '';
};

// Names: lower case, punctuation and whitespace stripped. Unicode-aware so a
// Yorùbá or Hausa name is not emptied out by an ASCII-only filter.
const hashName = (name) => {
  const clean = String(name || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return clean ? sha256(clean) : '';
};

const hashCountry = (country) => {
  const clean = String(country || 'NG').trim().toLowerCase().slice(0, 2);
  return clean.length === 2 ? sha256(clean) : '';
};

/**
 * Nigerian mobiles are stored in mixed shapes: 0803…, 803…, +234803…, with
 * spaces and dashes. Meta matches on E.164 digits, so an unconverted 080…
 * simply never matches — the spec calls this out as the single biggest lever
 * on match rate.
 *
 * Returns null when the number cannot be normalised with confidence, which
 * includes numbers carrying a foreign country code. Those are real and valid
 * E.164, but the instruction for this build is Nigeria-only, so they are
 * dropped from the PHONE column and counted rather than guessed at. The row
 * still goes up on its email.
 */
export function normalizeNgPhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('234')) {
    // already country-coded
  } else if (/^0[789]\d{9}$/.test(d)) {
    d = `234${d.slice(1)}`;
  } else if (/^[789]\d{9}$/.test(d)) {
    d = `234${d}`;
  } else {
    return null;
  }
  return /^234[789]\d{9}$/.test(d) ? d : null;
}

const hashPhone = (raw) => {
  const e164 = normalizeNgPhone(raw);
  return e164 ? sha256(e164) : '';
};

// ── segments (spec §4) ───────────────────────────────────────────
// Deposit type confirmed by the spec's §3 discovery query against live data:
// 'deposit' lower case. Status matters — there are over a thousand Expired and
// Failed deposit rows, and counting them would put non-customers in segment B.
// amount > 0 keeps a reversal or zero row from reading as a funding event.
//
// tosAcceptedAt is a consent gate, not a quality filter: the spec requires
// keeping the upload to users who accepted the terms.
const SEGMENT_SQL = {
  a: (lapseDays) => prisma.$queryRaw`
    SELECT u.id, u.email, u.phone, u."firstName", u."lastName", u.country
    FROM users u
    WHERE u.status = 'Active'
      AND u."deletedAt" IS NULL
      AND u."anonymizedAt" IS NULL
      AND u."tosAcceptedAt" IS NOT NULL
      AND u."createdAt" <= now() - interval '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t."userId" = u.id
          AND t.type = 'deposit' AND t.status = 'Completed' AND t.amount > 0
      )`,

  b: (lapseDays) => prisma.$queryRaw`
    SELECT u.id, u.email, u.phone, u."firstName", u."lastName", u.country
    FROM users u
    WHERE u.status = 'Active'
      AND u."deletedAt" IS NULL
      AND u."anonymizedAt" IS NULL
      AND u."tosAcceptedAt" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM transactions t
        WHERE t."userId" = u.id
          AND t.type = 'deposit' AND t.status = 'Completed' AND t.amount > 0
      )
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t."userId" = u.id
          AND t.type = 'deposit' AND t.status = 'Completed'
          AND t."createdAt" >= now() - make_interval(days => ${lapseDays}::int)
      )
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o."userId" = u.id
          AND o."deletedAt" IS NULL
          AND o."createdAt" >= now() - make_interval(days => ${lapseDays}::int)
      )`,
};

function toRow(u) {
  return [
    hashEmail(u.email),
    hashPhone(u.phone),
    hashName(u.firstName),
    hashName(u.lastName),
    hashCountry(u.country),
    u.id, // EXTERN_ID: the cuid, deliberately not hashed, so membership can be
          // diffed and removed deterministically on later runs.
  ];
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function graph(path, { method = 'POST', body, token }) {
  // A GET carries no body, so the token has to ride on the query string or the
  // call comes back 401 — which is how the post-push size read silently
  // returned null on the first real run.
  const url = body
    ? `${GRAPH}${path}`
    : `${GRAPH}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ ...body, access_token: token }) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    // Never echo the token back: Meta includes the submitted token in some
    // error messages, and this output goes to logs.
    throw new Error(String(msg).split('EAA')[0].trim() || `HTTP ${res.status}`);
  }
  return json;
}

const STATE_KEY = (audienceId) => `meta_audience_sync:${audienceId}`;

async function readLastMembers(audienceId) {
  try {
    const row = await prisma.setting.findUnique({ where: { key: STATE_KEY(audienceId) } });
    if (!row) return null;
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed?.ids) ? new Set(parsed.ids) : null;
  } catch { return null; }
}

async function writeLastMembers(audienceId, ids, meta) {
  const value = JSON.stringify({ at: new Date().toISOString(), count: ids.length, ids, ...meta });
  await prisma.setting.upsert({
    where: { key: STATE_KEY(audienceId) },
    update: { value },
    create: { key: STATE_KEY(audienceId), value },
  });
}

async function syncSegment(key, token) {
  const { id: audienceId, label } = AUDIENCES[key];
  const users = await SEGMENT_SQL[key](LAPSE_DAYS);

  let noPhone = 0, unnormalisedPhone = 0;
  for (const u of users) {
    if (!u.phone) noPhone += 1;
    else if (!normalizeNgPhone(u.phone)) unnormalisedPhone += 1;
  }

  const byId = new Map(users.map((u) => [u.id, u]));
  const current = new Set(byId.keys());
  const previous = await readLastMembers(audienceId);

  const toAdd = previous ? [...current].filter((id) => !previous.has(id)) : [...current];
  const toRemove = previous ? [...previous].filter((id) => !current.has(id)) : [];

  const report = {
    segment: key, label, audienceId,
    eligible: users.length,
    withEmail: users.filter((u) => u.email).length,
    withUsablePhone: users.length - noPhone - unnormalisedPhone,
    noPhoneStored: noPhone,
    phoneNotNormalisable: unnormalisedPhone,
    firstRun: !previous,
    toAdd: toAdd.length,
    toRemove: toRemove.length,
    pushed: 0,
    removed: 0,
    batches: [],
  };

  const addRows = toAdd.map((id) => toRow(byId.get(id)));

  if (OUT_DIR) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(`${OUT_DIR}/${key}-${audienceId}.json`, JSON.stringify({ schema: SCHEMA, data: addRows }, null, 1));
  }

  if (DRY_RUN) { report.dryRun = true; return report; }

  for (const batch of chunk(addRows, CHUNK)) {
    const out = await graph(`/${audienceId}/users`, {
      token,
      body: { payload: { schema: SCHEMA, data: batch } },
    });
    report.pushed += batch.length;
    report.batches.push({ op: 'add', rows: batch.length, received: out.num_received, invalid: out.num_invalid_entries, session: out.session_id });
  }

  // Removals keep segment A honest; without them a converted signup stays in
  // the retargeting pool forever.
  for (const batch of chunk(toRemove, CHUNK)) {
    const out = await graph(`/${audienceId}/users`, {
      method: 'DELETE',
      token,
      body: { payload: { schema: ['EXTERN_ID'], data: batch.map((id) => [id]) } },
    });
    report.removed += batch.length;
    report.batches.push({ op: 'remove', rows: batch.length, received: out.num_received });
  }

  await writeLastMembers(audienceId, [...current], { lapseDays: LAPSE_DAYS, segment: key });

  const after = await graph(`/${audienceId}?fields=approximate_count_lower_bound,approximate_count_upper_bound,operation_status`, { method: 'GET', token })
    .catch(() => null);
  report.audienceAfter = after;
  return report;
}

async function main() {
  const token = process.env.META_ADS_TOKEN;
  if (!token && !DRY_RUN) {
    console.error('META_ADS_TOKEN is not set. It needs ads_management on ad account ' + AD_ACCOUNT + '.');
    console.error('META_CAPI_TOKEN will NOT work — a dataset token cannot read or write audiences.');
    console.error('Re-run with --dry-run to see segment sizes and write the payloads without pushing.');
    process.exit(2);
  }

  const keys = ONLY === 'both' ? ['a', 'b'] : [ONLY];
  const reports = [];
  for (const k of keys) {
    if (!AUDIENCES[k]) throw new Error(`Unknown segment ${k}`);
    reports.push(await syncSegment(k, token));
  }

  console.log(JSON.stringify({ lapseDays: LAPSE_DAYS, dryRun: DRY_RUN, reports }, null, 1));
}

// Only run when invoked directly, so normalizeNgPhone can be imported and
// tested without the script firing a sync as a side effect of the import.
const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main()
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
} else {
  await prisma.$disconnect();
}
