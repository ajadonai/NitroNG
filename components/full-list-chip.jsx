'use client';
import { AUDIENCE_FLAG } from "./service-glyph";

// The full list's badge, in its own file so the reading guide draws its sample
// row with the same chip the list does and the two cannot drift apart again.

/**
 * A fact's colour comes from what kind of fact it is, and every hue here is one
 * the page already owns: the tier palette from New Order (amber Budget, blue
 * Standard, violet Premium) plus the green the order form uses for refill.
 * Nothing new is invented, so a full-list row and a curated card read as the
 * same product.
 *
 * Only the facts worth a glance are coloured. "No refill" and the order size
 * stay neutral — one is a cheaper product, not an error, and the other is a
 * number, not a quality. Keeping them grey is what lets the rest carry weight.
 */
export const CHIP = {
  refill:   { light: { fg: "#059669", bg: "rgba(5,150,105,.1)" },   dark: { fg: "#6ee7b7", bg: "rgba(110,231,183,.13)" } },
  // Nigerian and US accounts carry the colours the curated cards already give
  // those two audiences, so the same audience reads the same on both lists.
  // Every other origin keeps the neutral location blue — inventing a hue per
  // country would turn a row into a flag parade.
  ng:       { light: { fg: "#15803d", bg: "#e8f5ee" },              dark: { fg: "#4ade80", bg: "rgba(74,222,128,.14)" } },
  us:       { light: { fg: "#b91c1c", bg: "#fdeeee" },              dark: { fg: "#f87171", bg: "rgba(248,113,113,.14)" } },
  speed:    { light: { fg: "#b45309", bg: "#fdf3e7" },              dark: { fg: "#e0a458", bg: "rgba(224,164,88,.14)" } },
  quality:  { light: { fg: "#6d28d9", bg: "#f3ecfa" },              dark: { fg: "#a78bfa", bg: "rgba(167,139,250,.14)" } },
  location: { light: { fg: "#1d5fa5", bg: "#eaf1fa" },              dark: { fg: "#7aa2f7", bg: "rgba(122,162,247,.14)" } },
  neutral:  { light: { fg: "#6e6a65", bg: "rgba(0,0,0,.055)" },     dark: { fg: "#a09890", bg: "rgba(255,255,255,.08)" } },
  // Auto services are a different product, not a variation of one: they
  // subscribe to an account and deliver to its future posts. Its own colour
  // because the risk here is somebody reading past it, which is exactly what
  // happened while the badge did not exist.
  auto:     { light: { fg: "#9a3412", bg: "#fdeee3" },              dark: { fg: "#fdba74", bg: "rgba(253,186,116,.15)" } },
};

export function Chip({ kind = "neutral", dark, mono, children }) {
  const c = CHIP[kind][dark ? "dark" : "light"];
  return (
    <span className={`inline-flex items-center gap-[5px] rounded-[5px] px-[6px] py-[1.5px] text-[10.5px] font-semibold whitespace-nowrap${mono ? " m" : ""}`}
      style={{ color: c.fg, background: c.bg, ...(AUDIENCE_FLAG[kind] ? { paddingInlineStart: 3 } : {}), ...(mono ? { fontFamily: "'JetBrains Mono', monospace" } : {}) }}>
      {AUDIENCE_FLAG[kind] && <span className="inline-flex rounded-[2px] overflow-hidden" style={{ boxShadow: "0 0 0 .5px rgba(0,0,0,.18)" }}>{AUDIENCE_FLAG[kind]}</span>}
      {children}
    </span>
  );
}
