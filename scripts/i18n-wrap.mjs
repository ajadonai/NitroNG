/**
 * Wrap a component's user-facing English in tr(), or list what it would wrap.
 *
 *   node scripts/i18n-wrap.mjs components/dashboard.jsx --dry
 *   node scripts/i18n-wrap.mjs components/dashboard.jsx
 *
 * The detector lives in ./i18n-detect.mjs and is shared with the drift guard
 * in tests/, so what this rewrites and what CI demands are the same thing by
 * construction rather than by anyone remembering to update both.
 *
 * Always dry-run first and read the list. This decides what a customer sees.
 */
import fs from 'node:fs';
import { scan } from './i18n-detect.mjs';

const [file, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/i18n-wrap.mjs <file.jsx> [--dry]');
  process.exit(1);
}

const { out, found, moduleScope } = scan(fs.readFileSync(file, 'utf8'));
const unique = [...new Set(found.map((f) => f.text))];

if (DRY) {
  console.log(`${file}\n${unique.length} string(s) would be wrapped:\n`);
  unique.forEach((s) => console.log('  •', s.length > 100 ? s.slice(0, 97) + '…' : s));
} else {
  fs.writeFileSync(file, out);
  console.log(`${file}: wrapped ${unique.length} string(s)`);
}

if (moduleScope.length) {
  console.log(`\n${moduleScope.length} at module scope — tr() is a hook, so move these inside the component by hand:`);
  moduleScope.forEach((m) => console.log(`  ! ${m.line}: ${m.text.slice(0, 70)}`));
}
