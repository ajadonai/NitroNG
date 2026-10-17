'use client';
import { PlatformIcon } from "./platform-icon";

// A task's platform in the offset print, for the Tasks page and the tasks card
// on Rewards. The platforms PlatformIcon draws use it; the few only tasks have
// get the same printed tile in their own colour. Anything else falls back to
// PlatformIcon's letter tile.
const PRINTED = new Set(["instagram", "tiktok", "youtube", "x", "twitter", "facebook", "telegram", "whatsapp"]);
const EXTRA = {
  nairaland: { c: "#2e8b57", mark: <path d="M4 4h3l5 8.5V4h3v16h-3l-5-8.5V20H4V4z" /> },
  reddit: { c: "#ff4500", mark: <><circle cx="12" cy="12" r="10" /><circle cx="8.5" cy="12.5" r="1.5" fill="#fff" /><circle cx="15.5" cy="12.5" r="1.5" fill="#fff" /><path d="M8.5 16c1 1.5 5.5 1.5 7 0" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" /></> },
  google: { c: "#4285f4", mark: <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" /> },
  trustpilot: { c: "#00b67a", mark: <path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01z" /> },
  blog: { c: "#8b5cf6", line: true, mark: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></> },
};

export function TaskIcon({ platform, dark, size = 38 }) {
  const key = (platform || "").toLowerCase();
  const extra = EXTRA[key];
  if (PRINTED.has(key) || !extra) return <PlatformIcon platform={key} dark={dark} size={size} print />;
  const s = Math.round(size * .5);
  return (
    <div className="ord-platform-icon" style={{ width: size, height: size, borderRadius: Math.round(size * .3), color: extra.c, background: `color-mix(in srgb, ${extra.c} 12%, transparent)`, boxShadow: `2px 2px 0 color-mix(in srgb, ${extra.c} 30%, transparent)` }}>
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" fill={extra.line ? "none" : "currentColor"} stroke={extra.line ? "currentColor" : undefined} strokeWidth={extra.line ? 2 : undefined} strokeLinecap="round">{extra.mark}</svg>
    </div>
  );
}
