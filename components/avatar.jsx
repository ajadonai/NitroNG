'use client';
import { useId, useState } from "react";
import { useT } from "./locale";

/**
 * `ring` is opt-in rather than always on: in the nav the avatar sits inside
 * `.dash-avatar-btn`, which already carries the ring, and a second one there
 * would read as a double border. Standalone avatars — the account menu, the
 * profile page, list rows — pass it. The ring comes from `.nitro-ringed` so
 * the `.dark` cascade picks the right hairline without a prop to keep in sync.
 *
 * With no photo it draws the figure from the offset-print icon set (Trip's
 * pick, 17 Oct 2026): a rose figure printed on a soft tile, no initials. Its
 * colours are the .nitro-av-* rules in globals.css, so dark mode follows.
 */
export function Avatar({ src, size = 32, rounded = "full", ring = false }) {
  const tr = useT();
  // useId's characters are not safe inside url(#…) in every browser.
  const clip = 'av' + useId().replace(/[^\w-]/g, '');
  const [imgError, setImgError] = useState(false);
  const photo = src && !imgError;
  const borderRadius = rounded === "full" ? "50%" : typeof rounded === "number" ? rounded : rounded;

  return (
    <div className={ring ? "nitro-ringed" : undefined} style={{
      width: size,
      height: size,
      borderRadius,
      background: photo ? "linear-gradient(135deg, #c47d8e, #8b5e6b)" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {photo ? (
        <img
          src={src}
          alt={tr("User avatar")}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
          <defs><clipPath id={clip}><circle cx="20" cy="20" r="18.5" /></clipPath></defs>
          <circle className="nitro-av-tile" cx="20" cy="20" r="18.5" />
          <g clipPath={`url(#${clip})`}>
            <g className="nitro-av-print" transform="translate(1.6 1.6)"><circle cx="20" cy="15.5" r="5.6" /><path d="M9.5 31.5c.8-5.6 5-9 10.5-9s9.7 3.4 10.5 9V40h-21z" /></g>
            <g className="nitro-av-fig" fill="none" strokeWidth="2" strokeLinecap="round"><circle cx="20" cy="15.5" r="5.6" /><path d="M9.5 31.5c.8-5.6 5-9 10.5-9s9.7 3.4 10.5 9" /></g>
          </g>
          <circle className="nitro-av-ring" cx="20" cy="20" r="18.5" fill="none" strokeWidth="1.2" />
        </svg>
      )}
    </div>
  );
}

export function BotAvatar({ size = 32 }) {
  const iconSize = Math.round(size * 0.52);
  const radius = Math.round(size * 0.28);

  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="rgba(255,255,255,.75)" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="7" width="18" height="13" rx="3" />
        <rect x="10" y="2" width="4" height="5" rx="2" />
        <circle cx="8.5" cy="13.5" r="2" fill="rgba(124,58,237,.5)" />
        <circle cx="15.5" cy="13.5" r="2" fill="rgba(124,58,237,.5)" />
      </svg>
    </div>
  );
}
