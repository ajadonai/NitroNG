import './globals.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import Script from 'next/script';
import SentryInit from '@/components/sentry-init';
import CookieBanner from '@/components/cookie-banner';

export const metadata = {
  title: {
    default: 'The Nitro NG — #1 SMM Panel in Nigeria',
    template: '%s | The Nitro NG',
  },
  description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement, cheapest rates in Nigeria. 35+ platforms supported.',
  keywords: ['SMM panel', 'buy Instagram followers Nigeria', 'buy TikTok views', 'YouTube subscribers', 'social media marketing', 'SMM panel Nigeria', 'buy followers', 'buy likes', 'Nigerian SMM', 'cheap followers', 'instant delivery'],
  authors: [{ name: 'The Nitro NG', url: 'https://nitro.ng' }],
  creator: 'The Nitro NG',
  publisher: 'The Nitro NG',
  metadataBase: new URL('https://nitro.ng'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'The Nitro NG — #1 SMM Panel in Nigeria',
    description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement, 35+ platforms.',
    url: 'https://nitro.ng',
    siteName: 'The Nitro NG',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'The Nitro NG — #1 SMM Panel in Nigeria',
    description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement.',
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
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080b14',
};

export default function RootLayout({ children }) {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    logo: "https://nitro.ng/icon-512.png",
    description: "Nigeria's #1 SMM Panel. Buy Instagram followers, TikTok views, YouTube subscribers and more.",
    sameAs: [
      "https://instagram.com/Nitro.ng",
      "https://instagram.com/TheNitroNg",
      "https://twitter.com/TheNitroNG",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "TheNitroNG@gmail.com",
      availableLanguage: "English",
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://nitro.ng/dashboard?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const navSchema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "SiteNavigationElement", name: "Create Account", url: "https://nitro.ng/signup" },
      { "@type": "SiteNavigationElement", name: "Log In", url: "https://nitro.ng/login" },
      { "@type": "SiteNavigationElement", name: "Free Instagram Audit", url: "https://nitro.ng/audit" },
      { "@type": "SiteNavigationElement", name: "Blog", url: "https://nitro.ng/blog" },
      { "@type": "SiteNavigationElement", name: "FAQ", url: "https://nitro.ng/faq" },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://sentry.io" crossOrigin="anonymous" />
        <Script src="https://t.contentsquare.net/uxa/326b90ddf7f96.js" strategy="beforeInteractive" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(navSchema) }} />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:py-2 focus:px-4 focus:rounded-lg focus:bg-[#c47d8e] focus:text-white focus:text-sm focus:font-semibold focus:no-underline">Skip to main content</a>
        <Script src="https://plausible.io/js/pa-nE8AS3pS0CWFTGc_htkYL.js" strategy="afterInteractive" />
        <Script id="plausible-init" strategy="afterInteractive">{`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}</Script>

        <SentryInit />
        <CookieBanner />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
