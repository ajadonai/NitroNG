'use client';
import { useT } from "./locale";

// The concierge offer — "we can order for you" — in its two shapes. Its own
// module because both New Order and the Full list need it, and the full list
// is imported by New Order: keeping it there made the two files import each
// other.

const WA_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35zM12.05 21.8h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 01-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 016.99 2.9 9.82 9.82 0 012.9 7c0 5.45-4.45 9.87-9.9 9.87z"/></svg>;

export const waHelpLink = (waNumber, context, email) => `https://wa.me/${waNumber}?text=${encodeURIComponent(
  (context ? `Hi! I want to order ${context} on Nitro. Can you help me place it?` : "Hi! I'd like to place an order on Nitro. Can you help me?")
  + (email ? `\n\nMy account: ${email}` : ""),
)}`;

/** On a phone the wa.me link opens the app and leaves an empty tab behind, so
 *  hand off in place there. Desktop keeps the new tab. */
export const openInPlaceOnPhone = e => {
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    e.preventDefault();
    window.location.href = e.currentTarget.href;
  }
};

/**
 * The concierge offer: we place it for them. Used as a quiet inline link in
 * empty states, where there is nothing else on screen to compete with.
 */
export function NotSureHelp({ waNumber, dark, context, email }) {
  const tr = useT();
  if (!waNumber) return null;
  return (
    <a
      href={waHelpLink(waNumber, context, email)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openInPlaceOnPhone}
      className="nudge-btn inline-flex items-center gap-2 py-1.5 px-3 rounded-full text-[13px] font-semibold no-underline"
      style={{ color: dark ? "#4ade80" : "#15803d", background: dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.1)", border: `1px solid ${dark ? "rgba(37,211,102,.3)" : "rgba(22,163,74,.25)"}` }}
    >
      {WA_ICON}
      {tr("We can order for you")}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dir-flip shrink-0 opacity-70"><polyline points="9 18 15 12 9 6" /></svg>
    </a>
  );
}

/**
 * The same offer as a card, sitting directly under the tier chips of whichever
 * service is open. That is the moment people hesitate, and it costs no scrolling
 * to find.
 */
export function OrderForMeCard({ waNumber, dark, context, email }) {
  const tr = useT();
  if (!waNumber) return null;
  return (
    <a
      href={waHelpLink(waNumber, context, email)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => { e.stopPropagation(); openInPlaceOnPhone(e); }}
      className="nudge-btn mt-2 inline-flex items-center gap-2 py-1.5 px-3 rounded-full text-[12.5px] no-underline"
      style={{ color: dark ? "#a8a29a" : "#6b6660", background: dark ? "rgba(37,211,102,.1)" : "rgba(37,211,102,.08)", border: `1px solid ${dark ? "rgba(37,211,102,.26)" : "rgba(22,163,74,.22)"}` }}
    >
      <span className="shrink-0 flex" style={{ color: "#25d366" }}>{WA_ICON}</span>
      <span>{tr("Not sure?")} <b className="font-semibold" style={{ color: dark ? "#4ade80" : "#15803d" }}>{tr("We can order for you")}</b></span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dir-flip shrink-0 opacity-60"><polyline points="9 18 15 12 9 6" /></svg>
    </a>
  );
}
