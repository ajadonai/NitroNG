import './globals.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import CookieBanner from '@/components/cookie-banner';
import { headers } from 'next/headers';
import { LOCALES, isLocale, SOURCE_LOCALE } from '@/lib/i18n';
import { LocaleProvider } from '@/components/locale';
import fr from '@/messages/fr.json';
import sw from '@/messages/sw.json';
import ar from '@/messages/ar.json';
import CAPIPageView from '@/components/capi-tracker';
import Heartbeat from '@/components/heartbeat';
import AnalyticsScripts from '@/components/analytics-scripts';

// Only the locales that have their own URLs. Pidgin is deliberately absent: it
// is a comfort language for people already signed in, not one anybody searches
// in, so it has no route and needs no server-side dictionary.
const ROUTE_MESSAGES = { fr, sw, ar };

export const metadata = {
  title: {
    default: "The Nitro NG | Your Content Deserves a Bigger Audience",
    template: '%s | The Nitro NG',
  },
  description: "Nitro helps Nigerian creators, artists, and businesses reach a wider audience. Content-promotion services across major platforms. Naira pricing, fast results, human support.",
  authors: [{ name: 'The Nitro NG', url: 'https://nitro.ng' }],
  creator: 'The Nitro NG',
  publisher: 'The Nitro NG',
  metadataBase: new URL('https://nitro.ng'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'The Nitro NG | Your Content Deserves a Bigger Audience',
    description: "Nitro helps Nigerian creators, artists, and businesses reach a wider audience. Premium promotion, Naira pricing, built for Naija.",
    url: 'https://nitro.ng',
    siteName: 'The Nitro NG',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Nitro NG | Your Content Deserves a Bigger Audience',
    description: "Nitro helps Nigerian creators, artists, and businesses reach a wider audience. Premium promotion, Naira pricing, built for Naija.",
    creator: '@TheNitroNG',
    site: '@TheNitroNG',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-v2.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon-v2.png',
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Nitro',
  },
  verification: {},
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080b14',
};

export default async function RootLayout({ children }) {
  // Set by proxy.js on /fr, /sw and /ar. A server component cannot read the
  // pathname, so this is how the locale reaches the first render — and the
  // first render is the only one a crawler ever sees.
  const routeLocale = (await headers()).get('x-nitro-locale');
  const locale = isLocale(routeLocale) && routeLocale !== SOURCE_LOCALE ? routeLocale : null;
  const meta = locale ? LOCALES[locale] : null;
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    logo: "https://nitro.ng/icon-512.png",
    description: "Nigerian digital marketing company helping creators, artists, and businesses promote their content and reach wider audiences across social media.",
    foundingDate: "2025",
    foundingLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG" } },
    sameAs: [
      "https://instagram.com/Nitro.ng",
      "https://instagram.com/TheNitroNg",
      "https://twitter.com/TheNitroNG",
      "https://www.trustpilot.com/review/nitro.ng",
      "https://share.google/PoSVSkgVHOiKcBocQ",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@nitro.ng",
      availableLanguage: "English",
    },
    slogan: "Your content deserves a bigger audience",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    description: "Content promotion and digital marketing platform for Nigerian creators and businesses. Manage campaigns, track results, Naira pricing.",
    // Must agree with <html lang>. Telling Google the page is English while it
    // is served in French is the kind of contradiction that gets a whole
    // hreflang cluster discounted.
    inLanguage: locale || "en",
  };

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    applicationCategory: "BusinessApplication",
    operatingSystem: "All",
    description: "Digital marketing and content promotion platform for Nigerian creators, artists, agencies, and businesses. Manage your social media campaigns from one clean dashboard. Naira pricing, fast results, human support.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NGN",
      description: "Free to sign up. Flexible campaign budgets in Naira.",
    },
    featureList: [
      "Campaign service categories across major social platforms",
      "Cleanest marketing dashboard in Nigeria",
      "Naira pricing, no USD conversion",
      "Performance tracking and analytics",
      "3-tier campaign quality: Budget (no refill), Standard (30-day refill), Premium (lifetime refill)",
      "Human support on WhatsApp",
      "API access for developers and agencies",
      "Bulk campaign tools for large projects",
      "Refill coverage on qualifying campaigns",
      "Bank transfer, card, and crypto payments",
    ],
    screenshot: "https://nitro.ng/opengraph-image",
    creator: { "@type": "Organization", name: "The Nitro NG" },
  };

  // lang and dir are both load-bearing.
  //
  // dir, because postcss-rtlcss scopes every rule that has a physical side to
  // [dir=ltr] or [dir=rtl]: a document with no dir attribute matches neither and
  // loses its padding, margins and alignment entirely.
  //
  // lang, because a page that claims to be English while showing Arabic gets
  // offered for translation by the browser, which is how "تابع التسليم" once
  // came back as "Follow the prayer" in the middle of a modal.
  //
  // On /fr, /sw and /ar the server knows both from the URL. Everywhere else it
  // cannot — the choice lives in localStorage — so it sends the English default
  // and components/locale.jsx corrects it on mount. Either way the first paint,
  // and every crawler, gets a laid-out page in a language it was told about.
  return (
    <html lang={locale || 'en-NG'} dir={meta?.dir || 'ltr'} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://sentry.io" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:py-2 focus:px-4 focus:rounded-lg focus:bg-[#c47d8e] focus:text-white focus:text-sm focus:font-semibold focus:no-underline">Skip to main content</a>
        <AnalyticsScripts />
        {/* Currency and language wrap the whole body, not just the page inside
            the nav. The cookie banner and anything else mounted at the root are
            chrome a customer reads too, and while the provider lived further
            down they sat outside it — useT() fell back to English there, so the
            banner stayed English in every language. */}
        <LocaleProvider initialLang={locale} initialMessages={locale ? ROUTE_MESSAGES[locale] : undefined}>
          <CookieBanner />
          <CAPIPageView />
          <Heartbeat />
          <main id="main-content">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
