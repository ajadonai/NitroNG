/**
 * Errors thrown by somebody else's code inside our page.
 *
 * Two families so far, both raised against Nitro and neither ours to fix:
 * the Snapchat in-app browser's injected bridge, and crypto-wallet extensions —
 * MetaMask's inpage script rejects a promise on every page it cannot reach its
 * own background worker from, which reached Sentry as an unhandled rejection on
 * /pulse. Nothing of ours ran in either case.
 */
const SNAPCHAT_BRIDGE_RE = /SCDynimacBridge/i;
/** MetaMask, Coinbase Wallet, Phantom and friends, by the message they reject with. */
const WALLET_EXTENSION_RE = /Failed to connect to MetaMask|MetaMask extension not found|No Ethereum provider|ethereum provider not found|solana\.disconnect|Cannot redefine property: ethereum/i;
/** Anything whose code lives in an extension, whatever it is called. */
const EXTENSION_URL_RE = /^(chrome|chrome-untrusted|moz|safari-web|safari|ms-browser)-extension:\/\//i;

export const sentryIgnoreErrors = [
  /Can't find variable: SCDynimacBridge/i,
  /SCDynimacBridge/i,
  /Failed to connect to MetaMask/i,
  /Cannot redefine property: ethereum/i,
];

/** Sentry's denyUrls: drop anything whose stack is rooted in an extension. */
export const sentryDenyUrls = [EXTENSION_URL_RE];

const isNoisyText = (text) => !!text && (SNAPCHAT_BRIDGE_RE.test(text) || WALLET_EXTENSION_RE.test(text));

export function isIgnoredBrowserNoise(event, hint) {
  // A rejected plain object never becomes an exception value, so the only place
  // its message survives is the hint — which is how the MetaMask rejection
  // arrived, logged as "Object captured as promise rejection".
  const original = hint?.originalException;
  const originalMessage = typeof original === 'string' ? original : original?.message;
  if (isNoisyText(originalMessage)) return true;
  if (typeof original?.stack === 'string' && EXTENSION_URL_RE.test(original.stack)) return true;

  const exceptionValues = event?.exception?.values || [];
  return exceptionValues.some(ex => {
    const frames = ex?.stacktrace?.frames || [];
    return (
      isNoisyText(ex?.value) ||
      isNoisyText(ex?.type) ||
      frames.some(frame =>
        isNoisyText(frame?.filename) || isNoisyText(frame?.function) ||
        EXTENSION_URL_RE.test(frame?.filename || ''))
    );
  });
}

export function sentryBeforeSend(event, hint) {
  if (isIgnoredBrowserNoise(event, hint)) return null;
  return event;
}
