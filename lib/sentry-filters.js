/**
 * Errors thrown by somebody else's code inside our page.
 *
 * Three families so far, all raised against Nitro and none ours to fix: the
 * Snapchat in-app browser's injected bridge, crypto-wallet extensions — MetaMask's
 * inpage script rejects a promise on every page it cannot reach its own
 * background worker from, which reached Sentry as an unhandled rejection on
 * /pulse — and, as of 22 Sep on /, a second wallet-style extension with its own
 * claim/login state machine. Nothing of ours ran in any of the three.
 */
const SNAPCHAT_BRIDGE_RE = /SCDynimacBridge/i;
/** MetaMask, Coinbase Wallet, Phantom and friends, by the message they reject with. */
const WALLET_EXTENSION_RE = /Failed to connect to MetaMask|MetaMask extension not found|No Ethereum provider|ethereum provider not found|solana\.disconnect|Cannot redefine property: ethereum/i;
/** Anything whose code lives in an extension, whatever it is called. */
const EXTENSION_URL_RE = /^(chrome|chrome-untrusted|moz|safari-web|safari|ms-browser)-extension:\/\//i;
// A second extension, 7705466381 on 22 Sep: rejects a bare { code, message }
// object with no stack and no readable message anywhere Sentry keeps it, so
// neither WALLET_EXTENSION_RE nor a stack check can see it. What it does leave
// is this exact console trail on every page load, from console.log calls
// inside its own injected content script — none of these four lines exist
// anywhere in Nitro's source, checked before writing this. Matched against
// breadcrumbs rather than the exception, which is the only place the evidence
// survives for this one.
const CLAIM_EXTENSION_BREADCRUMB_RE = /Resetting (login|claim) state|New version detected\. Clearing LocalStorage/i;

export const sentryIgnoreErrors = [
  /Can't find variable: SCDynimacBridge/i,
  /SCDynimacBridge/i,
  /Failed to connect to MetaMask/i,
  /Cannot redefine property: ethereum/i,
];

/** Sentry's denyUrls: drop anything whose stack is rooted in an extension. */
export const sentryDenyUrls = [EXTENSION_URL_RE];

const isNoisyText = (text) => !!text && (SNAPCHAT_BRIDGE_RE.test(text) || WALLET_EXTENSION_RE.test(text));

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

  // The second wallet-style extension: no message, no stack, only its own
  // console trail leading up to the rejection.
  return breadcrumbList(event).some(b => CLAIM_EXTENSION_BREADCRUMB_RE.test(b?.message || ''));
}

export function sentryBeforeSend(event, hint) {
  if (isIgnoredBrowserNoise(event, hint)) return null;
  return event;
}
