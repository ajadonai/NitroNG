import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEO_LOCALES, SOURCE_LOCALE, LOCALES } from "../lib/i18n";
import { localeAlternates, localeMetadata, SITE } from "../lib/locale-metadata";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * The locale URLs exist to be found. Everything here protects one of the two
 * ways that quietly fails: a page that is served in French but announces
 * itself as English, or a set of language versions that do not agree about
 * each other.
 */
describe("locale routes", () => {
  it("has a page for every SEO locale, and none for the others", () => {
    for (const code of SEO_LOCALES) {
      expect(fs.existsSync(`app/${code}/page.jsx`), `app/${code}/page.jsx is missing`).toBe(true);
    }
    // Pidgin is a comfort language for people already signed in — nobody
    // searches in it, so it gets no URL and no server-side dictionary.
    expect(fs.existsSync("app/pcm/page.jsx")).toBe(false);
    expect(LOCALES.pcm.seo).toBe(false);
  });

  it("keeps proxy.js in step with SEO_LOCALES", () => {
    // proxy.js cannot import lib/i18n — it runs on the edge runtime — so the
    // list is duplicated there and this is what stops the copies drifting. A
    // locale missing from the proxy gets no x-nitro-locale header, so its page
    // renders in English and the URL is worse than useless.
    const proxy = read("proxy.js");
    const declared = proxy.match(/const LOCALE_ROUTES = \[([^\]]*)\]/)?.[1] ?? "";
    const codes = [...declared.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect(codes.sort()).toEqual([...SEO_LOCALES].sort());

    for (const code of SEO_LOCALES) {
      expect(proxy, `proxy matcher is missing /${code}`).toContain(`'/${code}'`);
    }
  });

  it("points every language version at all the others, itself included", () => {
    // Google reads a one-way hreflang as unrelated pages rather than one page
    // in four languages, which is the duplicate-content problem these URLs
    // exist to avoid.
    const langs = localeAlternates();
    expect(Object.keys(langs).sort()).toEqual([...SEO_LOCALES, SOURCE_LOCALE, "x-default"].sort());
    expect(langs[SOURCE_LOCALE]).toBe(SITE);
    expect(langs["x-default"]).toBe(SITE);
    for (const code of SEO_LOCALES) expect(langs[code]).toBe(`${SITE}/${code}`);
  });

  it("gives each translation its own canonical, never the English one", () => {
    // A translation whose canonical points at the English page is telling
    // Google not to index the translation at all.
    for (const code of SEO_LOCALES) {
      const m = localeMetadata({ locale: code, title: "t", description: "d" });
      expect(m.alternates.canonical).toBe(`${SITE}/${code}`);
      expect(m.alternates.canonical).not.toBe(SITE);
    }
    expect(localeMetadata({ locale: SOURCE_LOCALE, title: "t", description: "d" })
      .alternates.canonical).toBe(SITE);
  });

  it("lists the locale homes in the sitemap", () => {
    const sitemap = read("app/sitemap.js");
    for (const code of SEO_LOCALES) {
      expect(sitemap, `sitemap is missing /${code}`).toMatch(new RegExp(`'${code}'`));
    }
  });

  it("writes each page's title and description in its own language", () => {
    // A French URL with an English snippet in the results is the version
    // nobody clicks, so these are authored per locale rather than translated
    // at runtime. Checked by script, not by eye: the Latin-script locales must
    // differ from English, and Arabic must actually be in Arabic.
    const en = read("app/page.jsx");
    const enTitle = en.match(/absolute: '([^']+)'/)?.[1];
    for (const code of SEO_LOCALES) {
      const src = read(`app/${code}/page.jsx`);
      const title = src.match(/title: ['"](.+?)['"],/)?.[1];
      expect(title, `app/${code}/page.jsx has no title`).toBeTruthy();
      expect(title, `app/${code}/page.jsx still has the English title`).not.toBe(enTitle);
    }
    expect(read("app/ar/page.jsx")).toMatch(/[؀-ۿ]/);
    expect(read("app/sw/page.jsx")).toMatch(/Maudhui|hadhira/);
  });

  it("hands the server-rendered locale to the provider", () => {
    // Without this the provider starts in English, renders an English page and
    // only switches after hydration — and a crawler never waits for hydration.
    const layout = read("app/layout.jsx");
    expect(layout).toContain("x-nitro-locale");
    expect(layout).toMatch(/initialLang=\{locale\}/);
    expect(layout).toMatch(/initialMessages=\{locale \?/);
    // lang and dir must both follow the route, not sit hardcoded.
    expect(layout).toMatch(/lang=\{locale \|\| 'en-NG'\}/);
    expect(layout).toMatch(/dir=\{meta\?\.dir \|\| 'ltr'\}/);
    // and the structured data must not contradict them
    expect(layout).toMatch(/inLanguage: locale \|\| "en"/);

    const provider = read("components/locale.jsx");
    expect(provider).toContain("initialLang");
    // the URL wins over a saved preference
    expect(provider).toMatch(/if \(routeLocale\) return;/);
  });
});
