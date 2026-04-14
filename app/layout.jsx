import './globals.css';
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import SentryInit from '@/components/sentry-init';
import CookieBanner from '@/components/cookie-banner';

export const metadata = {
  title: {
    default: 'Nitro — #1 SMM Panel in Nigeria',
    template: '%s | Nitro',
  },
  description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement, cheapest rates in Nigeria. 35+ platforms supported.',
  keywords: ['SMM panel', 'buy Instagram followers Nigeria', 'buy TikTok views', 'YouTube subscribers', 'social media marketing', 'SMM panel Nigeria', 'buy followers', 'buy likes', 'Nigerian SMM', 'cheap followers', 'instant delivery'],
  authors: [{ name: 'Nitro', url: 'https://nitro.ng' }],
  creator: 'Nitro',
  publisher: 'Nitro',
  metadataBase: new URL('https://nitro.ng'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Nitro — #1 SMM Panel in Nigeria',
    description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement, 35+ platforms.',
    url: 'https://nitro.ng',
    siteName: 'Nitro',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Nitro — #1 SMM Panel in Nigeria',
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
  verification: {
    // Add these when you set up Google Search Console and Bing Webmaster Tools
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Nitro",
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
    name: "Nitro",
    url: "https://nitro.ng",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://nitro.ng/dashboard?search={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      </head>
      <body>
        <SentryInit />
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
