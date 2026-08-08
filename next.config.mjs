import { withSentryConfig } from "@sentry/nextjs";
import {
  getApplicationUrl,
  shouldValidateProductionBuild,
  validateProductionBuildEnv,
} from "./lib/env.js";

validateProductionBuildEnv();
const applicationUrl = getApplicationUrl(process.env, {
  production: shouldValidateProductionBuild(),
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/services/\\[platform\\]/opengraph-image': ['./assets/og-fonts/**/*'],
    '/services/\\[platform\\]/\\[type\\]/opengraph-image': ['./assets/og-fonts/**/*'],
    '/blog/\\[slug\\]/opengraph-image': ['./assets/og-fonts/**/*'],
  },
  allowedDevOrigins: ['192.168.1.11', '192.168.1.12', '192.168.1.15', '192.168.1.16'],
  async redirects() {
    return [
      // Creator Economy Index vanity URL
      { source: '/index', destination: '/blog/creator-economy-index-edition-one', statusCode: 301 },
      // Merged blog posts — 301 losers into winners
      { source: '/blog/why-instagram-followers-drop-after-buying', destination: '/blog/why-smm-followers-drop-how-to-avoid-it', permanent: true },
      { source: '/blog/best-smm-panel-nigeria-2026-comparison', destination: '/blog/best-smm-panel-nigeria', permanent: true },
      { source: '/blog/grow-instagram-nigeria-2026', destination: '/blog/how-to-grow-instagram-account-nigeria', permanent: true },
      { source: '/blog/is-buying-social-media-followers-safe', destination: '/blog/will-instagram-ban-me-for-buying-followers', permanent: true },
      { source: '/blog/is-smm-safe', destination: '/blog/will-instagram-ban-me-for-buying-followers', permanent: true },
      // Help docs moved from /blog to /help
      { source: '/blog/order-status-guide', destination: '/help/order-status-guide', permanent: true },
      { source: '/blog/how-to-add-funds', destination: '/help/how-to-add-funds', permanent: true },
      { source: '/blog/how-to-use-bulk-orders', destination: '/help/how-to-use-bulk-orders', permanent: true },
      { source: '/blog/how-to-place-your-first-order', destination: '/help/how-to-place-your-first-order', permanent: true },
      { source: '/blog/getting-started-first-order', destination: '/help/getting-started-first-order', permanent: true },
      { source: '/blog/how-to-find-the-right-link', destination: '/help/how-to-find-the-right-link', permanent: true },
      { source: '/blog/referral-program', destination: '/help/referral-program', permanent: true },
      { source: '/blog/leaderboard', destination: '/help/leaderboard', permanent: true },
      { source: '/blog/5-tips-to-master-nitro', destination: '/help/5-tips-to-master-nitro', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP — restrict scripts to self, styles inline + self, no unsafe eval
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' https://plausible.io https://*.contentsquare.net https://static.cloudflareinsights.com https://connect.facebook.net${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.neon.tech https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://plausible.io https://*.contentsquare.net https://www.facebook.com https://connect.facebook.net",
              "frame-src 'self' https://www.facebook.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://www.facebook.com",
            ].join('; '),
          },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS — force HTTPS for 1 year
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // CORS — API routes
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: applicationUrl },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG || undefined,
  project: process.env.SENTRY_PROJECT || undefined,
  authToken: process.env.SENTRY_AUTH_TOKEN || undefined,
  sourcemaps: {
    // CI verifies the complete Sentry configuration without publishing build artifacts.
    disable: process.env.GITHUB_ACTIONS === 'true',
  },
});
