/**
 * The look of an opened card. Services set the pattern — an accent frame,
 * lifted off the list — and order history follows it so an opened thing reads
 * the same everywhere. The header keeps a deeper tint than the body it opens,
 * so the row you clicked stays legible as the lid of the card.
 */
export function openCardFrame(t, dark) {
  return {
    margin: '6px 8px',
    borderRadius: 14,
    border: `1.5px solid ${t.accent}`,
    boxShadow: '0 6px 20px rgba(196,125,142,.16)',
    background: dark ? 'rgba(196,125,142,.05)' : 'rgba(196,125,142,.025)',
    overflow: 'hidden',
  };
}

export function openCardHeader(dark) {
  return { background: dark ? 'rgba(196,125,142,.16)' : 'rgba(196,125,142,.09)' };
}
