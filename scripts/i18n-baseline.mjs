/**
 * Record how much untranslated English each file still has.
 *
 *   node scripts/i18n-baseline.mjs           → what has changed since the record
 *   node scripts/i18n-baseline.mjs --write   → update the record
 *   node scripts/i18n-baseline.mjs --list components/new-order.jsx
 *
 * A guard that demanded zero on the day it was written would have failed on
 * 1,401 strings across 108 files, and a guard that fails on day one is a guard
 * somebody deletes in week two. So this records the debt instead, and the test
 * in tests/i18n-drift-guard.test.js holds the line at it: a file not on this
 * list must have none, and a file on it may never have more.
 *
 * It also fails when a number goes DOWN without being written back. That looks
 * pedantic and is the whole point — it is what makes this a ratchet rather than
 * a ceiling that stays quietly slack for a year. Translating a page is supposed
 * to end with its number falling, and the number falling is supposed to be
 * recorded in the same commit as the translation.
 *
 * Every number here should be zero eventually. None of them is a target.
 */
import fs from 'node:fs';
import path from 'node:path';
import { scanRepo } from './i18n-detect.mjs';

const FILE = path.join(process.cwd(), 'scripts', 'i18n-baseline.json');
const [flag, which] = process.argv.slice(2);

const rows = scanRepo();

if (flag === '--list') {
  const hit = rows.get(which);
  if (!hit) { console.log(`${which}: nothing unwrapped.`); process.exit(0); }
  console.log(`${which} — ${hit.count} string(s):\n`);
  hit.texts.forEach((s) => console.log('  •', s.length > 100 ? s.slice(0, 97) + '…' : s));
  process.exit(0);
}

const current = Object.fromEntries([...rows].map(([f, r]) => [f, r.count]));

if (flag === '--write') {
  const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]));
  fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n');
  const total = Object.values(sorted).reduce((a, b) => a + b, 0);
  console.log(`Recorded ${Object.keys(sorted).length} file(s), ${total} untranslated string(s).`);
  process.exit(0);
}

const baseline = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const total = Object.values(current).reduce((a, b) => a + b, 0);
const was = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`${total} untranslated string(s) in ${Object.keys(current).length} file(s) — recorded: ${was}\n`);

const worse = Object.entries(current).filter(([f, n]) => n > (baseline[f] ?? 0));
const better = Object.entries(baseline).filter(([f, n]) => (current[f] ?? 0) < n);

if (worse.length) {
  console.log('New untranslated English:');
  worse.forEach(([f, n]) => console.log(`  ${f}  ${baseline[f] ?? 0} → ${n}`));
}
if (better.length) {
  console.log('\nImproved — write the record back:');
  better.forEach(([f, n]) => console.log(`  ${f}  ${n} → ${current[f] ?? 0}`));
}
if (!worse.length && !better.length) console.log('Unchanged.');
