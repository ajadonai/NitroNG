import { SEO_LOCALES, LOCALES, SOURCE_LOCALE } from './i18n';

export const SITE = 'https://nitro.ng';

/**
 * The hreflang block, built once and shared by every language version of a page.
 *
 * Google needs each version to point at ALL of them, itself included, or it
 * treats them as unrelated pages that happen to say similar things — which is
 * the duplicate-content reading these URLs exist to avoid. So the English page
 * lists the translations and every translation lists the English, from one
 * function, because the moment two of them disagree the whole cluster is
 * ignored.
 *
 * `x-default` points at English: it is what somebody gets when none of the
 * languages match, and English is the source here rather than one translation
 * among four.
 *
 * `path` is the page below the locale, '' for the landing page. A future
 * /fr/tarifs would pass 'pricing' and get the same treatment for free.
 */
export function localeAlternates(path = '') {
  const tail = path ? `/${path}` : '';
  const languages = { [SOURCE_LOCALE]: `${SITE}${tail}` };
  for (const code of SEO_LOCALES) languages[code] = `${SITE}/${code}${tail}`;
  languages['x-default'] = `${SITE}${tail}`;
  return languages;
}

/**
 * Metadata for one language version of a page.
 *
 * The canonical is the page's own URL, never the English one. Pointing a
 * translation's canonical at the English page is the classic way to tell Google
 * the translation should not be indexed at all, which would undo the entire
 * point of publishing it.
 */
export function localeMetadata({ locale, path = '', title, description }) {
  const tail = path ? `/${path}` : '';
  const self = locale === SOURCE_LOCALE ? `${SITE}${tail}` : `${SITE}/${locale}${tail}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: self, languages: localeAlternates(path) },
    openGraph: {
      title,
      description,
      url: self,
      siteName: 'The Nitro NG',
      locale: locale === SOURCE_LOCALE ? 'en_NG' : locale,
      type: 'website',
    },
  };
}

/** Language names and directions, for anything that needs to label a locale. */
export const localeMeta = (code) => LOCALES[code];
