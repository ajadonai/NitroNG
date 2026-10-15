/**
 * Errors thrown by somebody else's code inside our page.
 *
 * Three families so far, all raised against Nitro and none ours to fix: the
 * Snapchat in-app browser's injected bridge, crypto-wallet extensions — MetaMask's
 * inpage script rejects a promise on every page it cannot reach its own
 * background worker from, which reached Sentry as an unhandled rejection on
 * /pulse — and a second wallet-style extension with its own claim/login state
 * machine, seen on / (22 Sep) and again on /dashboard (28 Sep) via a different
 * branch of the same version check. Nothing of ours ran in any of the three.
 */
const SNAPCHAT_BRIDGE_RE = /SCDynimacBridge/i;
/** MetaMask, Coinbase Wallet, Phantom and friends, by the message they reject with. */
const WALLET_EXTENSION_RE = /Failed to connect to MetaMask|MetaMask extension not found|No Ethereum provider|ethereum provider not found|solana\.disconnect|Cannot redefine property: ethereum/i;
/** Anything whose code lives in an extension, whatever it is called. */
const EXTENSION_URL_RE = /^(chrome|chrome-untrusted|moz|safari-web|safari|ms-browser)-extension:\/\//i;
// A second extension, issue 7705466381: rejects a bare { code, message }
// object with no stack and no readable message anywhere Sentry keeps it, so
// neither WALLET_EXTENSION_RE nor a stack check can see it. What it does leave
// is a console trail from its own injected content script — none of these
// lines exist anywhere in Nitro's source, checked before writing this.
// Matched against breadcrumbs rather than the exception, which is the only
// place the evidence survives for this one.
//
// The first fix (22 Sep) only matched the branch where it detects a new
// version and resets its state, and missed 28 Sep's report entirely: same
// issue ID, but the OTHER branch of the same version check ("Version numbers
// match. No need to clear") carries none of those words. `test true` /
// `test false` is the one line both reports actually share — logged first, on
// every load, before either branch runs — so it is the anchor now rather than
// a detail of whichever branch happened to be reported first.
const CLAIM_EXTENSION_BREADCRUMB_RE = /^test (true|false)$|Resetting (login|claim) state|New version detected\. Clearing LocalStorage|Version numbers match\. No need to clear/i;

// Meta's in-app browser — the one Facebook and Instagram open links in — injects
// its own contact-autofill bridge and throws inside it. Issue 7611051755: a
// customer tapped the WhatsApp number field on /dashboard, the bridge went to
// fill it for them, and read `.value` off undefined in its own forEach. Our
// field is an ordinary <input>; nothing of ours is on that stack.
//
// None of these strings exist anywhere in Nitro's source — checked before this
// was written, the same way the Snapchat bridge above was.
const META_IAB_RE = /setContactAutofillValuesFromBridge|hxp-chat-suppression|IAB unified bridge/i;

// A third-party script evaluating a string, which our CSP refuses in production
// on purpose. Issue 7794248971, on the landing page: the stack is a blob worker
// — `blob:app:///<uuid>`, one line, a megabyte wide — which is how UX-analytics
// vendors ship their worker, and Nitro creates no workers at all. Its blobs are
// CSV and JSON downloads.
//
// It is filtered rather than fixed because there is no version of fixing it on
// our side: the alternative is granting 'unsafe-eval' to every script on the
// site to satisfy one vendor's bundle, which is a far worse trade than losing
// whatever part of their replay needs eval.
//
// Deliberately narrow — it must match THEIR eval, not a future one of ours. It
// wants the CSP message AND a blob frame, so an eval violation from a script of
// ours would still be reported.
const CSP_EVAL_RE = /violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source/i;
const BLOB_FRAME_RE = /^blob:/i;

export const sentryIgnoreErrors = [
  /Can't find variable: SCDynimacBridge/i,
  /SCDynimacBridge/i,
  /Failed to connect to MetaMask/i,
  /Cannot redefine property: ethereum/i,
];

/** Sentry's denyUrls: drop anything whose stack is rooted in an extension. */
export const sentryDenyUrls = [EXTENSION_URL_RE];

const isNoisyText = (text) => !!text && (SNAPCHAT_BRIDGE_RE.test(text) || WALLET_EXTENSION_RE.test(text) || META_IAB_RE.test(text));

/**
 * A CSP eval violation whose stack is a blob — somebody else's worker bundle.
 * Both halves are required: the message alone would also silence our own code
 * if it ever tried to eval, which is something we would want to hear about.
 */
function isThirdPartyEvalViolation(event, hint) {
  const values = event?.exception?.values || [];
  const original = hint?.originalException;
  const text = [
    typeof original === 'string' ? original : original?.message,
    ...values.map(v => v?.value),
  ].filter(Boolean).join(' ');
  if (!CSP_EVAL_RE.test(text)) return false;
  return values.some(ex => (ex?.stacktrace?.frames || []).some(f => BLOB_FRAME_RE.test(f?.filename || '')));
}

// Sentry's SDK has changed this between a bare array and { values: [...] }
// across versions; read whichever shape shows up rather than picking one.
const breadcrumbList = (event) => {
  const b = event?.breadcrumbs;
  return Array.isArray(b) ? b : (Array.isArray(b?.values) ? b.values : []);
};

export function isIgnoredBrowserNoise(event, hint) {
  // A rejected plain object never becomes an exception value, so the only place
  // its message survives is the hint — which is how the MetaMask rejection
  // arrived, logged as "Object captured as promise rejection".
  const original = hint?.originalException;
  const originalMessage = typeof original === 'string' ? original : original?.message;
  if (isNoisyText(originalMessage)) return true;
  if (typeof original?.stack === 'string' && EXTENSION_URL_RE.test(original.stack)) return true;

  const exceptionValues = event?.exception?.values || [];
  const noisyException = exceptionValues.some(ex => {
    const frames = ex?.stacktrace?.frames || [];
    return (
      isNoisyText(ex?.value) ||
      isNoisyText(ex?.type) ||
      frames.some(frame =>
        isNoisyText(frame?.filename) || isNoisyText(frame?.function) ||
        EXTENSION_URL_RE.test(frame?.filename || ''))
    );
  });
  if (noisyException) return true;

  if (isThirdPartyEvalViolation(event, hint)) return true;

  // The second wallet-style extension: no message, no stack, only its own
  // console trail leading up to the rejection. Meta's in-app browser leaves the
  // same kind of trail — its bridge logs before it throws.
  return breadcrumbList(event).some(b => {
    const m = b?.message || '';
    return CLAIM_EXTENSION_BREADCRUMB_RE.test(m) || META_IAB_RE.test(m);
  });
}

/**
 * Sentry rewrites a bundle's path to `app:///…`, and our own chunks land under
 * `app:///_next/`. Anything else on that scheme was injected into the page by
 * something that is not Nitro, and is not ours to fix.
 *
 * This lived inline in instrumentation-client.js as
 *
 *   /^app:\/\//.test(f.filename) && !/^\/?_next\//.test(f.filename)
 *
 * where the second test read the WHOLE filename for a leading `_next/`. Our own
 * frames begin `app:///_next/`, so they failed it and matched the rule — the
 * guard meant to drop injected scripts was dropping Nitro's own client errors
 * with them. The prefix is part of the comparison now.
 */
export function hasForeignAppFrame(event) {
  const frames = event?.exception?.values?.flatMap(v => v?.stacktrace?.frames || []) || [];
  return frames.some(f => {
    const name = f?.filename || '';
    return /^app:\/\//i.test(name) && !/^app:\/\/\/_next\//i.test(name);
  });
}

export function sentryBeforeSend(event, hint) {
  if (isIgnoredBrowserNoise(event, hint)) return null;
  return event;
}
