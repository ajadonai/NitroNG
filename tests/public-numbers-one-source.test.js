import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Catalogue counts belong to lib/site-stats, not to prose.
 *
 * The site quoted its own platform count four different ways at once — 31 on the
 * homepage, 29 on the services hub, 28 on signup and 28 in the About copy, three
 * feet from stat cards that had been reading the real figure (27) from the
 * database all along. Same for service counts: "140+ service types", "150+",
 * "around 140 services", "7,848 services". Every one of them was typed by hand
 * at a moment when it was true, and none of them had a way to stop being true
 * quietly.
 *
 * So this fails the build when a number lands next to "platforms" or
 * "service types" in public copy. The fix is never to correct the digit — it is
 * to read it from getSiteStats, or to write the sentence so it does not need one.
 */

// Public surfaces only. The admin can say whatever it likes: nobody markets to
// themselves, and its numbers are already live readings by construction.
const ROOTS = ['app', 'components'];
const SKIP_DIR = /node_modules|\.next/;
const SKIP_FILE = /^admin-|admin\/|\/admin|\.test\./;

// A digit group immediately before a catalogue noun. Deliberately narrow: it is
// the shape of the copy that went wrong, not every number on the site.
const CLAIM = /\b\d[\d,]*\+?\s+(?:platforms|service types|curated services|tested services)\b/gi;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (SKIP_DIR.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Strips comments and the bodies of lines that are plainly explanatory, so a
 * comment recording what a number used to be does not read as a fresh claim.
 * The historical figures are worth keeping written down; that is the whole
 * reason the comments exist.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/.*$/, ''))
    .join('\n');
}

describe('catalogue counts have one source', () => {
  it('no public page types a platform or service count into its copy', () => {
    const offenders = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (SKIP_FILE.test(file)) continue;
        const src = stripComments(readFileSync(file, 'utf8'));
        for (const hit of src.matchAll(CLAIM)) {
          const line = src.slice(0, hit.index).split('\n').length;
          offenders.push(`${file}:${line} — "${hit[0].trim()}"`);
        }
      }
    }

    expect(
      offenders,
      'Read the figure from getSiteStats (lib/site-stats.js), or reword so the '
      + 'sentence does not carry a count. Do not just correct the number.\n'
      + offenders.join('\n'),
    ).toEqual([]);
  });

  it('every page that quotes the catalogue reads it from the one module', () => {
    for (const file of [
      'app/page.jsx',
      'app/about/page.jsx',
      'app/services/page.jsx',
      'app/signup/page.jsx',
      'app/pricing/page.jsx',
      'app/api/site-info/route.js',
    ]) {
      expect(
        readFileSync(file, 'utf8'),
        `${file} should import getSiteStats`,
      ).toContain("from '@/lib/site-stats'");
    }
  });

  it('keeps the two user counts named apart so they cannot be confused', () => {
    // /about says "verified accounts" and must keep counting verified accounts;
    // the landing strip says "accounts created" and counts every live one. The
    // bug worth preventing is one page silently adopting the other's fence.
    const stats = readFileSync('lib/site-stats.js', 'utf8');
    expect(stats).toContain('verifiedUsers');
    expect(stats).toContain("emailVerified: true");
    expect(stats).toContain("status: { not: 'Deleted' }");
    expect(readFileSync('app/about/page.jsx', 'utf8')).toContain('customers: s.verifiedUsers');
  });
});
