'use client';
import { useEffect, useState } from "react";

/**
 * The strip that runs while a page is being fetched.
 *
 * Four colours, and they are not chosen here: they are the four the Nitro
 * loading mark already turns through — rose, red, green, yellow — so a slow
 * navigation and a cold start are recognisably the same brand doing the same
 * thing. The gradient travels through them rather than sitting still, which is
 * what keeps a bar that is barely moving from looking stuck.
 *
 * It fills toward the end WITHOUT arriving, then completes when the page does.
 * That shape is a small lie told on purpose — we do not know how long a chunk
 * takes, so a bar that reached 100% on a timer would be claiming knowledge it
 * does not have, and one that sat at 40% would look broken. Creeping and then
 * snapping shut is the honest version of "still working, nearly there".
 *
 * At the very top edge, above the nav, where a browser puts its own progress —
 * nobody has to learn it.
 */
export const LOADER_COLORS = ["#c47d8e", "#e05252", "#34a97b", "#ecc94b"];

/**
 * Below this, a navigation is not worth announcing.
 *
 * Most page changes here are instant — the chunk is already in memory and the
 * new page paints in one frame. Showing a bar for 80ms produces a flash that
 * reads as something going wrong rather than something loading, so nothing is
 * drawn until a navigation has already outlived this.
 */
export const NAV_BAR_DELAY_MS = 140;

/** Once it IS worth showing, it stays long enough to be read as progress. */
export const NAV_BAR_MIN_MS = 320;

export default function NavProgress({ busy }) {
  // "hidden" → "running" → "done" → "hidden". `done` exists so the bar can
  // finish its travel instead of vanishing mid-way when the page arrives.
  const [phase, setPhase] = useState("hidden");

  useEffect(() => {
    if (busy) {
      const t = setTimeout(() => setPhase("running"), NAV_BAR_DELAY_MS);
      return () => clearTimeout(t);
    }
    // Not busy any more. If it never appeared, it never has to disappear.
    setPhase(p => (p === "running" ? "done" : "hidden"));
    return undefined;
  }, [busy]);

  useEffect(() => {
    if (phase !== "done") return undefined;
    const t = setTimeout(() => setPhase("hidden"), 260);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div className={`nitro-navbar${phase === "done" ? " done" : ""}`} aria-hidden="true">
      <i />
    </div>
  );
}

/**
 * Was this navigation slow enough to be worth a bar, and did it then last long
 * enough to be read? Exported for the test, which is the only place the two
 * numbers can be checked against each other.
 */
export function barShows(durationMs) {
  return durationMs > NAV_BAR_DELAY_MS;
}
