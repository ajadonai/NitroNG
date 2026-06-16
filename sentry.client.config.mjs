import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  ignoreErrors: [
    /Java object is gone/,
    /Object Not Found Matching Id/,
    /Can't find variable: FileReader/,
    /webkit\.messageHandlers/,
  ],
  denyUrls: [
    /app:\/\/autofill_contact_enhanced/,
    /app:\/\/navigation_performance_logger/,
    /app:\/\/uxa\//,
    /app:\/\/JSBridgeCallback/,
  ],
});
