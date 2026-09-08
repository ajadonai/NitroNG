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
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
});
