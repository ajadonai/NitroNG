'use client';
import { useState } from "react";

/**
 * `ring` is opt-in rather than always on: in the nav the avatar sits inside
 * `.dash-avatar-btn`, which already carries the ring, and a second one there
 * would read as a double border. Standalone avatars — the account menu, the
 * profile page, list rows — pass it. The ring comes from `.nitro-ringed` so
 * the `.dark` cascade picks the right hairline without a prop to keep in sync.
 */
export function Avatar({ src, size = 32, rounded = "full", ring = false, dark, t }) {
  const [imgError, setImgError] = useState(false);
  const iconSize = Math.round(size * 0.55);
  const borderRadius = rounded === "full" ? "50%" : typeof rounded === "number" ? rounded : rounded;

  return (
    <div className={ring ? "nitro-ringed" : undefined} style={{
      width: size,
      height: size,
      borderRadius,
      background: "linear-gradient(135deg, #c47d8e, #8b5e6b)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {src && !imgError ? (
        <img
          src={src}
          alt="User avatar"
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="rgba(255,255,255,.7)" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4.5" />
          <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" />
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
