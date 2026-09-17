'use client';

/**
 * The WhatsApp button, everywhere.
 *
 * Support is WhatsApp, so it appears in 45 files — and each of them drew it by
 * hand. `#25d366` was written 33 times and `#4ade80` another 18, which is two
 * different greens for one brand before counting the tinted variants.
 *
 * Three things this settles:
 *
 *   — **The real green.** It is a brand mark, so the colour is not ours to
 *     tune, and it does not invert in dark mode the way every other control
 *     here does. A brand does not change colour because the page did.
 *   — **Dark ink on it.** White on #25D366 is 1.98:1, which most of the web
 *     ships and nobody can read. Dark is 8.59:1.
 *   — **It stopped being an action colour.** As a tinted pill in an orders row
 *     it sat 23 away from Refund's green, where anything under about 60 reads
 *     as the same colour. Its own brand green is 94 away.
 *
 * Two weights. `filled` when it is the thing to do on the screen; `quiet` when
 * it is one of several actions in a row and a bright green slab would shout
 * over the rest — the fill goes but the glyph keeps the green, so it is still
 * found at a glance.
 */
const GLYPH = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.25-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48 0 1.46 1.06 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.88 9.89M20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42z" />
  </svg>
);

/**
 * @param {string}  href    a wa.me link. Renders a button instead when absent.
 * @param {'filled'|'quiet'} weight
 * @param {'lg'|'md'|'sm'|'round'} size
 */
export function WaButton({
  href, onClick, children, weight = 'filled', size = 'md',
  className = '', label, ...rest
}) {
  const cls = [
    'wa-btn',
    weight === 'quiet' ? 'quiet' : '',
    size === 'md' ? '' : size,
    className,
  ].filter(Boolean).join(' ');

  const inner = <>{GLYPH}{size !== 'round' && children}</>;
  // `round` carries no label, so it needs an accessible name of its own.
  const a11y = size === 'round' ? { 'aria-label': label || 'WhatsApp' } : {};

  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer" {...a11y} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...a11y} {...rest}>
      {inner}
    </button>
  );
}

export { GLYPH as WhatsAppGlyph };
