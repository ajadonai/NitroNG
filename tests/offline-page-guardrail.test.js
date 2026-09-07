import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * The offline page is served when the network is gone, so every property that
 * lets it render with zero requests is load-bearing. A stylesheet link, a font
 * import or an <img> added later would not fail loudly — the page would simply
 * render unstyled or half-blank on the one occasion it exists for, and nobody
 * would find out. These assertions are cheap and catch exactly that.
 *
 * The second half guards the money rule: the worker must never answer a request
 * that could carry a balance from cache.
 */
describe("offline page guardrail", () => {
  const html = readFileSync(resolve(__dirname, "../public/offline.html"), "utf8");
  const sw = readFileSync(resolve(__dirname, "../public/sw.js"), "utf8");

  it("pulls in nothing over the network", () => {
    // Inline data: URIs are fine — they carry their own bytes.
    const external = html.match(/(?:src|href)\s*=\s*["'](?!data:|#)[^"']+["']/gi) || [];
    expect(external).toEqual([]);
  });

  it("has no <link> or @import, so it cannot depend on a stylesheet", () => {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/@import/i);
  });

  it("styles and scripts are inline", () => {
    expect(html).toMatch(/<style>/i);
    expect(html).toMatch(/<script>/i);
  });

  it("names a font fallback rather than trusting a webfont to load", () => {
    // Google Fonts cannot load offline, so every stack must end somewhere real.
    expect(html).toMatch(/system-ui|sans-serif/i);
    expect(html).toMatch(/Georgia|serif/i);
  });

  it("shows no balance or figures", () => {
    expect(html).not.toMatch(/₦/);
  });

  it("worker precaches the offline page under the cache it reads back", () => {
    const cacheName = sw.match(/const CACHE\s*=\s*['"]([^'"]+)['"]/)?.[1];
    const offlinePath = sw.match(/const OFFLINE\s*=\s*['"]([^'"]+)['"]/)?.[1];
    expect(cacheName).toBeTruthy();
    expect(offlinePath).toBe("/offline.html");
    // match() must read from the same cache install wrote to, or the fallback
    // silently misses and users get the browser's error page anyway.
    expect(sw).toMatch(new RegExp(`cacheName:\\s*CACHE`));
  });

  it("worker only ever intercepts GET navigations", () => {
    expect(sw).toMatch(/req\.method\s*!==\s*['"]GET['"]/);
    expect(sw).toMatch(/req\.mode\s*!==\s*['"]navigate['"]/);
  });

  it("worker never caches an API response", () => {
    // cache.put / cache.addAll anywhere in the fetch path would mean real data
    // could be served from cache. Only the install step may write, and only
    // the offline page.
    const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
    expect(fetchHandler).not.toMatch(/cache\.put|caches\.open|addAll/);
  });
});
