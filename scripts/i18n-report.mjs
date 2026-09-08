/**
 * What is translated, what is not, and what has drifted.
 *
 *   node scripts/i18n-report.mjs            → coverage per language
 *   node scripts/i18n-report.mjs --missing fr  → the English still to translate
 *   node scripts/i18n-report.mjs --orphans     → translations whose English changed
 *
 * The source of truth is the code: every tr("…") call in the app is a string
 * that needs translating, so nobody maintains a list by hand and a list cannot
 * fall out of date. Wrapping a new string in tr() adds it to the report; editing
 * the English orphans its old translations, which is the cost of keying on
 * sentences and the reason --orphans exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALE_CODES, SOURCE_LOCALE, coverage, orphans } from '../lib/i18n.js';

const ROOT = process.cwd();
const SEARCH = ['components', 'app'];

// tr("…") and tr('…'), single-line, no interpolation — the only shape the
// the codebase is allowed to use. Template literals are deliberately not
// matched: a sentence with a value inside it is split at the call site instead.
const CALL = /\btr\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\)/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full, out); }
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function sourceStrings() {
  const found = new Map();      // string → the files that use it
  for (const dir of SEARCH) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      // Comments out first: a tr("…") in a doc example is not a string the
      // site shows, and left in it would ask for translations of the manual.
      const src = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      for (const m of src.matchAll(CALL)) {
        const text = (m[1] ?? m[2]).replace(/\\(["'])/g, '$1');
        if (!text.trim()) continue;
        if (!found.has(text)) found.set(text, []);
        found.get(text).push(path.relative(ROOT, file));
      }
    }
  }
  return found;
}

function dictionary(code) {
  const f = path.join(ROOT, 'messages', `${code}.json`);
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.error(`messages/${code}.json is not valid JSON: ${e.message}`); process.exit(1); }
}

const strings = [...sourceStrings().keys()];
const targets = LOCALE_CODES.filter((c) => c !== SOURCE_LOCALE);
const [flag, which] = process.argv.slice(2);

if (flag === '--missing') {
  if (!targets.includes(which)) {
    console.error(`Usage: --missing <${targets.join('|')}>`);
    process.exit(1);
  }
  const { missing } = coverage(strings, dictionary(which));
  if (!missing.length) console.log(`${which}: nothing missing.`);
  else console.log(JSON.stringify(Object.fromEntries(missing.map((s) => [s, ''])), null, 2));
} else if (flag === '--orphans') {
  let any = false;
  for (const code of targets) {
    const stale = orphans(strings, dictionary(code));
    if (!stale.length) continue;
    any = true;
    console.log(`\n${code} — ${stale.length} translation(s) whose English no longer appears:`);
    stale.forEach((s) => console.log(`  ${s.length > 90 ? s.slice(0, 87) + '…' : s}`));
  }
  if (!any) console.log('No orphans: every translation still matches a live English string.');
} else {
  console.log(`${strings.length} string(s) wrapped in tr() across the app\n`);
  for (const code of targets) {
    const { translated, total, percent } = coverage(strings, dictionary(code));
    const bar = '█'.repeat(Math.round(percent / 5)).padEnd(20, '·');
    console.log(`  ${code.padEnd(4)} ${bar} ${String(percent).padStart(3)}%  ${translated}/${total}`);
  }
  console.log('\n  --missing <code>  the English still to translate, as a JSON skeleton');
  console.log('  --orphans         translations whose English has since changed');
}
