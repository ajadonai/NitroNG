import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../app/api', import.meta.url));

function routeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.js' ? [path] : [];
  });
}

function limiterCalls(source) {
  const pattern = /(?:const|let)?\s*([A-Za-z_$][\w$]*)\s*=\s*await\s+(?:rateLimit|rateLimitForUser)\s*\(/g;
  return [...source.matchAll(pattern)];
}

describe('rate-limited API entrypoints', () => {
  it('handles unavailable before limited and forwards retry timing at every call site', () => {
    const checked = [];

    for (const path of routeFiles(apiRoot)) {
      const source = readFileSync(path, 'utf8');
      if (!source.includes("@/lib/rate-limit")) continue;

      const calls = limiterCalls(source);
      for (const [index, call] of calls.entries()) {
        const variable = call[1];
        const end = calls[index + 1]?.index ?? source.length;
        const block = source.slice(call.index, end);
        const unavailableAt = block.indexOf(`${variable}.unavailable`);
        const limitedAt = block.indexOf(`${variable}.limited`);

        expect(unavailableAt, `${path}: missing unavailable branch for ${variable}`).toBeGreaterThan(0);
        expect(limitedAt, `${path}: missing limited branch for ${variable}`).toBeGreaterThan(0);
        expect(
          unavailableAt,
          `${path}: unavailable must be handled before limited for ${variable}`,
        ).toBeLessThan(limitedAt);

        const unavailableHandler = block.slice(unavailableAt, limitedAt);
        expect(
          unavailableHandler,
          `${path}: unavailable branch must return an explicit 503 response`,
        ).toMatch(/rateLimitUnavailable|rateLimitUnavailableResponse|status:\s*503/);

        const limitedHandler = block.slice(limitedAt, limitedAt + 1_000);
        expect(
          limitedHandler,
          `${path}: limited branch must forward retryAfter`,
        ).toContain(`${variable}.retryAfter`);

        checked.push(`${relative(apiRoot, path)}:${variable}`);
      }
    }

    expect(checked.length).toBeGreaterThanOrEqual(29);
  });
});
