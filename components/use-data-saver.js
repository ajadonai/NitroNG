'use client';
import { useEffect, useState } from 'react';

/**
 * Is this visitor on a connection worth being careful with?
 *
 * No toggle, deliberately. A Data-Saver switch in settings is wrong twice over:
 * the thing it would turn off — the aurora, the twinkle, the transitions — costs
 * CPU and battery rather than data, so the name is a lie; and a setting nobody
 * finds helps nobody. Meanwhile the actual data eater is invisible to the
 * person paying for it: the dashboard polls every 45 and 60 seconds whether or
 * not anything has changed.
 *
 * So the browser is asked instead of the user.
 *
 *   `saveData` is the OS-level Data Saver, which Chrome on Android exposes —
 *   which is to say, exactly our audience. Somebody who has turned that on has
 *   already answered this question for every site they visit, and asking again
 *   in our settings page is asking them to say it twice.
 *
 *   `effectiveType` is the browser's own read of measured round-trip time and
 *   throughput, not the radio's advertised generation. A phone showing 4G on a
 *   congested Lagos cell reports "3g" here, which is the honest answer and the
 *   one worth acting on.
 *
 * Both are Chromium-only. Safari and Firefox report nothing, so they get the
 * full experience — which is the right default: this narrows an experience on
 * evidence, and no evidence means no narrowing.
 *
 * It re-reads on `change`, because a connection is not a fact about a session.
 * Somebody walks out of the office onto mobile data mid-order.
 *
 * SSR renders `false` and the first client paint matches, so nothing hydrates
 * into a different tree — the effect moves it afterwards if the connection says
 * so.
 */
export function useDataSaver() {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const conn = typeof navigator !== 'undefined'
      ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
      : null;
    if (!conn) return undefined;

    const read = () => {
      const constrained = conn.saveData === true
        || conn.effectiveType === '2g'
        || conn.effectiveType === 'slow-2g'
        || conn.effectiveType === '3g';
      setSaving(constrained);
      // Stamped on the root so CSS can answer without every component
      // threading a prop down to the atmosphere layer, which is mounted as a
      // sibling of the page and cannot be told anything by it.
      document.documentElement.toggleAttribute('data-saver', constrained);
    };

    read();
    conn.addEventListener?.('change', read);
    return () => conn.removeEventListener?.('change', read);
  }, []);

  return saving;
}

/**
 * A polling interval, stretched when the connection is constrained.
 *
 * Stretched rather than stopped: a wallet that never updates is a bug report,
 * and somebody watching for a deposit to land is the last person to strand. The
 * factor is deliberately large — tripling a 60-second poll is 40 fewer requests
 * an hour, which is the whole point, and 3 minutes is still a live page.
 *
 * Not applied to the crypto deposit poll. That one runs for a few minutes while
 * somebody stares at the screen waiting for a payment to confirm, and the data
 * it saves is measured in kilobytes against the cost of a person thinking their
 * money has vanished.
 */
export const SAVER_FACTOR = 3;
export function pollEvery(ms, saving) {
  return saving ? ms * SAVER_FACTOR : ms;
}
