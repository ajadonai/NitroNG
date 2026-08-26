/**
 * Copy text without ever throwing. navigator.clipboard.writeText rejects with
 * NotAllowedError when the page is not focused, the gesture is stale, or the
 * browser denies it (Facebook's in-app browser does); an unhandled rejection
 * there used to reach Sentry. Falls back to the selection API, then gives up
 * quietly. Resolves true when the text made it to the clipboard.
 */
export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(el);
    return !!ok;
  } catch {
    return false;
  }
}
