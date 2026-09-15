/**
 * Recompute Service.platform for every service.
 *
 * The column is a cache of lib/full-catalogue platformOf, stored so the full
 * list can filter in SQL: without it the route reads all 9,820 fenced rows and
 * groups them in memory, with it the query returns only the platform asked for.
 *
 * Run this after the first deploy of the column, and any time platformOf's
 * rules change — the sync keeps new and edited services current, but a rule
 * change affects rows nothing has touched. Safe to run repeatedly: it writes
 * only where the stored value differs from the computed one, so a second run
 * over an already-correct table writes nothing.
 *
 *   node --env-file-if-exists=.env --env-file-if-exists=.env.local \
 *     scripts/backfill-service-platform.mjs [--dry]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const dry = process.argv.includes('--dry');
const prisma = new PrismaClient();

/**
 * Load the real platformOf rather than a copy of them. The libs import through
 * the `@/` alias that Next resolves and node does not, so each one is rewritten
 * to a file path in a temp copy and imported from there. A second copy of the
 * rules in this file is exactly the drift the script exists to prevent.
 */
async function loadPlatformOf() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nitro-backfill-'));
  for (const rel of ['lib/public-service-label.js', 'lib/reseller-format.js', 'lib/full-catalogue.js']) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
      .replace(/(['"])@\/lib\/([a-z-]+)\1/g, (_m, q, name) => `${q}./${name}.js${q}`);
    fs.writeFileSync(path.join(dir, path.basename(rel)), src);
  }
  const mod = await import(path.join(dir, 'full-catalogue.js'));
  fs.rmSync(dir, { recursive: true, force: true });
  return mod.platformOf;
}

const platformOf = await loadPlatformOf();

// One statement per platform rather than one per row. The first pass used a
// transaction of 500 individual updates, which is 500 round trips to a database
// in another building: it managed 125 rows a minute. Grouping by the value being
// written turns 16,099 writes into about thirty statements.
const CHUNK = 2000;

const services = await prisma.service.findMany({ select: { id: true, name: true, category: true, platform: true } });
console.log(`${services.length.toLocaleString()} services to check${dry ? '  (dry run — nothing will be written)' : ''}`);

const byPlatform = new Map(); // value to write → ids needing it
const tally = {};
let set = 0, cleared = 0;
for (const s of services) {
  const next = platformOf(s.name, s.category);
  tally[next || '(no tile)'] = (tally[next || '(no tile)'] || 0) + 1;
  if (next === s.platform) continue;
  if (next === null) cleared++; else set++;
  if (!byPlatform.has(next)) byPlatform.set(next, []);
  byPlatform.get(next).push(s.id);
}

const pending = set + cleared;
console.log(`\n${set.toLocaleString()} to set, ${cleared.toLocaleString()} to clear, ${(services.length - pending).toLocaleString()} already right`);
console.log('\nresulting spread:');
for (const [p, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${p}`);
}

if (dry || !pending) {
  console.log(pending ? '\ndry run — nothing written.' : '\nnothing to do: every service already carries the right tile.');
} else {
  let done = 0;
  for (const [platform, ids] of byPlatform) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await prisma.service.updateMany({ where: { id: { in: slice } }, data: { platform } });
      done += slice.length;
      process.stdout.write(`\r  written ${done.toLocaleString()}/${pending.toLocaleString()}`);
    }
  }
  console.log('\ndone.');
}

await prisma.$disconnect();
