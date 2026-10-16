import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The guest order page is kept out of search by its own meta tag. robots.txt
 * is PROTECTED (CLAUDE.md): the nightly cohort check depends on it, so the
 * page must never be the reason somebody edits it.
 */
describe('/order/[code]', () => {
  it('is noindex by meta tag, not by robots.txt', () => {
    const page = fs.readFileSync('app/order/[code]/page.jsx', 'utf8');
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    expect(fs.readFileSync('public/robots.txt', 'utf8')).not.toMatch(/\/order/);
  });
});
