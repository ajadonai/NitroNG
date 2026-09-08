/**
 * Translation, the smallest thing that works.
 *
 * The site is written in English and always will be — English is the source,
 * not one translation among four. So a caller passes the English sentence
 * itself and gets it back translated, or gets it back unchanged:
 *
 *     t("Fund your wallet")            → "Alimentez votre portefeuille"
 *     t("Fund your wallet")  (en)      → "Fund your wallet"
 *     t("Nothing to translate yet")    → "Nothing to translate yet"
 *
 * Two things follow from keying on the sentence rather than on an invented id.
 * A missing translation degrades to readable English instead of a bare
 * `wallet.fund.title` leaking onto a customer's screen — the failure mode that
 * makes half-translated apps look broken. And nobody has to name 2,872 strings,
 * which is the tax that stops this kind of work ever starting.
 *
 * The cost is that editing English copy orphans its translations. That is the
 * right trade here: copy changes are frequent and translations are cheap to
 * regenerate, and `npm run i18n:report` lists what has drifted.
 *
 * Interpolation is deliberately absent. A sentence with a figure in it gets
 * split at the call site — `{t("You will be charged")} {money(x)}` — because a
 * translator reordering `{amount}` inside a template is a class of bug nobody
 * catches until a customer sees it.
 */

export const SOURCE_LOCALE = "en";

/**
 * `seo: true` means this language gets its own URLs and hreflang, because it
 * exists to be FOUND — somebody searching "acheter des abonnés instagram" has
 * to be able to land on a French page. `seo: false` means it exists to be
 * READ once you are already here: nobody searches in Pidgin, so translating
 * the dashboard serves customers and translating the marketing pages would
 * serve nobody.
 */
export const LOCALES = {
  en:  { code: "en",  label: "English",   flag: "🇬🇧", seo: false, dir: "ltr" },
  pcm: { code: "pcm", label: "Pidgin",    flag: "🇳🇬", seo: false, dir: "ltr" },
  fr:  { code: "fr",  label: "Français",  flag: "🇫🇷", seo: true,  dir: "ltr" },
  sw:  { code: "sw",  label: "Kiswahili", flag: "🇰🇪", seo: true,  dir: "ltr" },
  // Right-to-left, and that is a layout job rather than a dictionary one:
  // mirrored nav, flipped chevrons and back arrows, currency and quantity
  // landing on the other side of the number. The dictionary can be filled in
  // long before the layout is ready, so `dir` is carried here from the start
  // and nothing outside the Arabic layout work should read it yet.
  ar:  { code: "ar",  label: "العربية",   flag: "🇪🇬", seo: true,  dir: "rtl" },
};

export const LOCALE_CODES = Object.keys(LOCALES);
export const SEO_LOCALES = LOCALE_CODES.filter((c) => LOCALES[c].seo);

export function isLocale(code) {
  return Object.prototype.hasOwnProperty.call(LOCALES, code);
}

/**
 * Build a translator for one locale.
 *
 * `messages` is the flat { english: translation } map for that locale. Anything
 * missing, blank, or not a string falls through to the English that was passed
 * in, so a half-finished dictionary shows a half-translated page rather than a
 * broken one.
 */
export function makeTranslator(locale, messages = {}) {
  if (locale === SOURCE_LOCALE || !isLocale(locale)) return (english) => english;
  return (english) => {
    if (typeof english !== "string") return english;
    const hit = messages[english];
    return typeof hit === "string" && hit.trim() ? hit : english;
  };
}

/** How much of a dictionary is filled in — what `npm run i18n:report` counts. */
export function coverage(sourceStrings = [], messages = {}) {
  const total = sourceStrings.length;
  if (!total) return { total: 0, translated: 0, missing: [], percent: 100 };
  const missing = sourceStrings.filter((s) => {
    const hit = messages[s];
    return !(typeof hit === "string" && hit.trim());
  });
  return {
    total,
    translated: total - missing.length,
    missing,
    percent: Math.round(((total - missing.length) / total) * 100),
  };
}

/**
 * Translations that no longer match any English on the site — usually because
 * the English was edited. Reported rather than deleted: the old wording is
 * often one word away from the new one, and re-translating from scratch is
 * wasteful.
 */
export function orphans(sourceStrings = [], messages = {}) {
  const live = new Set(sourceStrings);
  return Object.keys(messages).filter((k) => !live.has(k));
}
