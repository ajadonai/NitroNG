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
import CAPIPageView from '@/components/capi-tracker';
import Heartbeat from '@/components/heartbeat';
import AnalyticsScripts from '@/components/analytics-scripts';

export const metadata = {
  title: {
    default: "The Nitro NG | Your Content Deserves a Bigger Audience",
    template: '%s | The Nitro NG',
  },
  description: "Nitro helps Nigerian creators, artists, and businesses reach a wider audience. 35+ content-promotion service categories across major platforms. Naira pricing, fast results, human support.",
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

export default function RootLayout({ children }) {
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
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://nitro.ng/services/{search_term_string}",
      "query-input": "required name=search_term_string",
    },
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
      "35+ campaign service categories across major platforms",
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

  const ratingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "The Nitro NG",
    description: "Digital marketing platform helping Nigerian creators and businesses promote their content and reach wider audiences.",
    brand: { "@type": "Brand", name: "The Nitro NG" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      ratingCount: "850",
    },
    review: [
      { "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: "5" }, author: { "@type": "Person", name: "Nigerian Creator" }, reviewBody: "Best marketing dashboard I've used in Nigeria. Campaigns launch in minutes and everything is in Naira." },
      { "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: "5" }, author: { "@type": "Person", name: "Lagos Business Owner" }, reviewBody: "Cleanest dashboard I've seen. No clutter, no confusion. I manage all my clients' promotions from one place." },
    ],
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

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://nitro.ng" },
      { "@type": "ListItem", position: 2, name: "Services", item: "https://nitro.ng/services" },
      { "@type": "ListItem", position: 3, name: "Pricing", item: "https://nitro.ng/pricing" },
      { "@type": "ListItem", position: 4, name: "About", item: "https://nitro.ng/about" },
      { "@type": "ListItem", position: 5, name: "Blog", item: "https://nitro.ng/blog" },
      { "@type": "ListItem", position: 6, name: "FAQ", item: "https://nitro.ng/faq" },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://sentry.io" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ratingSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(navSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:py-2 focus:px-4 focus:rounded-lg focus:bg-[#c47d8e] focus:text-white focus:text-sm focus:font-semibold focus:no-underline">Skip to main content</a>
        <AnalyticsScripts />
        <CookieBanner />
        <CAPIPageView />
        <Heartbeat />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
