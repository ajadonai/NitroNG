const SNAPCHAT_BRIDGE_RE = /SCDynimacBridge/i;

export const sentryIgnoreErrors = [
  /Can't find variable: SCDynimacBridge/i,
  /SCDynimacBridge/i,
];

export function isIgnoredBrowserNoise(event, hint) {
  const original = hint?.originalException;
  const originalMessage = typeof original === 'string' ? original : original?.message;
  if (originalMessage && SNAPCHAT_BRIDGE_RE.test(originalMessage)) return true;

  const exceptionValues = event?.exception?.values || [];
  return exceptionValues.some(ex => {
    const value = ex?.value || '';
    const type = ex?.type || '';
    const frames = ex?.stacktrace?.frames || [];
    return (
      SNAPCHAT_BRIDGE_RE.test(value) ||
      SNAPCHAT_BRIDGE_RE.test(type) ||
      frames.some(frame => SNAPCHAT_BRIDGE_RE.test(frame?.filename || '') || SNAPCHAT_BRIDGE_RE.test(frame?.function || ''))
    );
  });
}

export function sentryBeforeSend(event, hint) {
  if (isIgnoredBrowserNoise(event, hint)) return null;
  return event;
}
