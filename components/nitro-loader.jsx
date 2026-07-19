'use client';
/* Nitro branded loader — "Mark draw, Echo trails" edition.
   Approved 10 Jul 2026. Copy this file to components/nitro-loader.jsx unchanged.
   Pairs with the CSS in globals-additions.css (append to app/globals.css).

   Usage:
     <NitroLoader size={56} />        full color, page/section loads
     <NitroLoader size={16} mono />   single color via currentColor, buttons/inline
     <NitroLoader size={16} mono ariaHidden />  when visible loading text sits beside it */

const MARK = "M4.8 44.98 L4.8 26.8 A9.61 9.61 0 0 1 24.02 26.8 L24.02 39.15 A9.6 9.6 0 0 0 43.22 39.15 L43.22 6.82";
/* Pink lead, then red/green/yellow echoes.
   Red, green, and yellow are placeholder hexes: swap for the exact social template values when Trip supplies them. */
const COLORS = ["#c47d8e", "#e05252", "#34a97b", "#ecc94b"];

export default function NitroLoader({ size = 32, mono = false, ariaHidden = false, className = "" }) {
  const sw = size <= 18 ? 8 : 9.65;
  const ink = (cls, stroke, key) => (
    <path key={key} className={"nl-ink" + (cls ? " " + cls : "")} pathLength="100" d={MARK} strokeWidth={sw} stroke={stroke} />
  );
  const a11y = ariaHidden ? { "aria-hidden": "true" } : { role: "status", "aria-label": "Loading" };
  return (
    <svg
      className={("nl " + className).trim()}
      width={size}
      height={size}
      viewBox="-1 0 50 54"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
    >
      <path d={MARK} strokeWidth={sw} stroke="currentColor" opacity=".13" />
      {mono
        ? ink("", "currentColor", "m")
        : [ink("nl-d3", COLORS[3], 3), ink("nl-d2", COLORS[2], 2), ink("nl-d1", COLORS[1], 1), ink("", COLORS[0], 0)]}
    </svg>
  );
}
