'use client';
import React from "react";

// Nitro brand mark — double-ring N
// Usage: <NitroLogo size={32} /> or <NitroLogo size={48} variant="icon" />
export default function NitroLogo({ size = 32, variant = "mark", color, style = {} }) {
  const s = size;

  // Icon variant: solid N on gradient rounded square (for app icon, favicon, small contexts)
  if (variant === "icon") {
    const r = Math.round(s * 0.25);
    const pad = s * 0.22;
    const nLeft = s * 0.28, nRight = s * 0.72;
    const nTop = pad, nBot = s - pad;
    const barW = s * 0.06;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style}>
        <defs>
          <linearGradient id={`ng-${s}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c47d8e"/>
            <stop offset="100%" stopColor="#8b5e6b"/>
          </linearGradient>
        </defs>
        <rect width={s} height={s} rx={r} fill={`url(#ng-${s})`}/>
        <path
          d={`M${nLeft},${nBot} L${nLeft},${nTop} L${nLeft+barW},${nTop} L${nLeft+barW},${nBot-s*0.14} L${nRight-barW},${nTop} L${nRight},${nTop} L${nRight},${nBot} Z`}
          fill="#fff" opacity="0.95"
        />
      </svg>
    );
  }

  // Mark variant: double-ring N (the primary brand mark)
  const cx = s / 2, cy = s / 2;
  const outerR = s * 0.44;
  const innerR = s * 0.34;
  const nH = s * 0.30;
  const nW = s * 0.18;
  const sw = Math.max(2, s * 0.035);
  const ringSw = Math.max(1.5, s * 0.025);
  const innerSw = Math.max(0.5, s * 0.01);
  const strokeColor = color || "url(#nmg)";
  const ringOpacity = color ? 0.4 : 1;
  const innerRingOpacity = color ? 0.15 : 0.35;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style}>
      <defs>
        <linearGradient id="nmg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c47d8e"/>
          <stop offset="100%" stopColor="#8b5e6b"/>
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={strokeColor} strokeWidth={ringSw} opacity={ringOpacity}/>
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={strokeColor} strokeWidth={innerSw} opacity={innerRingOpacity}/>
      <path
        d={`M${cx-nW},${cy+nH} L${cx-nW},${cy-nH} L${cx+nW},${cy+nH} L${cx+nW},${cy-nH}`}
        fill="none" stroke={strokeColor} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
