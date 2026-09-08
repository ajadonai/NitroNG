import * as Sentry from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent } from './lib/monitoring-redaction.js';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Local development does not report. Four issues were raised on 8 Sep 2026,
  // all four from this machine's dev server mid-edit — a hook added before its
  // import, a const used above its declaration — each one alive for seconds and
  // already fixed by the time anybody looked. They still had to be read and
  // dismissed one by one, which is exactly the cost of a noisy alert channel:
  // the real one is harder to spot. A dev error is already on the terminal in
  // front of whoever caused it.
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  debug: false,
  sendDefaultPii: false,
  ignoreErrors: [
    /Java object is gone/,
    /Object Not Found Matching Id/,
    /Can't find variable: FileReader/,
    /webkit\.messageHandlers/,
  ],
  denyUrls: [
    /^app:\/\//,
  ],
  beforeSend(event) {
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (frames?.some(f => /^app:\/\//.test(f.filename) && !/^\/?_next\//.test(f.filename))) return null;
    const msg = event.exception?.values?.map(v => v.value).join(" ") || "";
    if (/Java object is gone|Object Not Found Matching Id|webkit\.messageHandlers|Can't find variable: FileReader/.test(msg)) return null;
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb: scrubSentryBreadcrumb,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
