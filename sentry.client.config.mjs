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
  beforeSend(event) {
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (frames?.some(f => /^app:\/\//.test(f.filename) && !/^\/?_next\//.test(f.filename))) return null;
    const msg = event.exception?.values?.map(v => v.value).join(" ") || "";
    if (/Java object is gone|Object Not Found Matching Id|webkit\.messageHandlers|Can't find variable: FileReader/.test(msg)) return null;
    return event;
  },
});
