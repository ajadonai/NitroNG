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
import Script from 'next/script';
import SentryInit from '@/components/sentry-init';
import CookieBanner from '@/components/cookie-banner';

export const metadata = {
  title: {
    default: "The Nitro NG — Grow Your Socials | Nigeria's Growth Hub",
    template: '%s | The Nitro NG',
  },
  description: "Real engagement across Instagram, TikTok, YouTube and 35+ platforms. Naira pricing, instant delivery, 24/7 support. Built for Nigerian creators and businesses.",
  keywords: ['social media growth Nigeria', 'grow Instagram followers Nigeria', 'grow TikTok Nigeria', 'YouTube subscribers Nigeria', 'social media marketing Nigeria', 'Instagram growth service', 'TikTok growth Nigeria', 'Nigerian creators', 'Naira SMM', 'instant delivery', 'real engagement Nigeria'],
  authors: [{ name: 'The Nitro NG', url: 'https://nitro.ng' }],
  creator: 'The Nitro NG',
  publisher: 'The Nitro NG',
  metadataBase: new URL('https://nitro.ng'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'The Nitro NG | Your Socials Deserve Better Numbers',
    description: 'Grow your Instagram, TikTok, YouTube and 35+ platforms. Instant delivery, Naira pricing, built for Nigerian creators.',
    url: 'https://nitro.ng',
    siteName: 'The Nitro NG',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Nitro NG | Your Socials Deserve Better Numbers',
    description: 'We handle the numbers so you can handle the content. 35+ platforms, Naira pricing, instant delivery.',
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

export default function RootLayout({ children }) {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Nitro NG",
    url: "https://nitro.ng",
    logo: "https://nitro.ng/icon-512.png",
    description: "Digital growth company built for the Nigerian market. Grow your social media presence across Instagram, TikTok, YouTube and 35+ platforms with instant delivery and Naira pricing.",
    sameAs: [
      "https://instagram.com/Nitro.ng",
      "https://instagram.com/TheNitroNg",
      "https://twitter.com/TheNitroNG",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@nitro.ng",
      availableLanguage: "English",
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Nitro NG",
    url: "https://nitro.ng",
  };

  const ratingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "The Nitro NG",
    description: "Social media growth platform for Nigerian creators and businesses",
    brand: { "@type": "Brand", name: "The Nitro NG" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      ratingCount: "850",
    },
  };

  const navSchema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "SiteNavigationElement", name: "Create Account", url: "https://nitro.ng/signup" },
      { "@type": "SiteNavigationElement", name: "Log In", url: "https://nitro.ng/login" },
      { "@type": "SiteNavigationElement", name: "Sign Up", url: "https://nitro.ng/signup" },
      { "@type": "SiteNavigationElement", name: "Pricing", url: "https://nitro.ng/pricing" },
      { "@type": "SiteNavigationElement", name: "Services", url: "https://nitro.ng/services" },
      { "@type": "SiteNavigationElement", name: "About", url: "https://nitro.ng/about" },
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ratingSchema) }} />
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
