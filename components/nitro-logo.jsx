'use client';
import React, { useId } from "react";

export function NitroWordmark({ height = 18, color = "currentColor", style = {} }) {
  const w = Math.round(height * (1817 / 558));
  return (
    <svg width={w} height={height} viewBox="0 0 1817 558" fill={color} style={style}>
      <path d="M499.027 0.607C527.947-3.336 552.492 12.166 560.13 40.247c4.533 120.349.703 241.581 1.949 362.247-9.564 160.805-220 213.024-304.95 79.281-39.913-62.781-18.585-123.25-24.841-191.312-6.618-72.05-110.308-75.064-123.544-5.359-5.213 69.217 4.873 144.373-.544 212.91C103.259 560.806 17.95 566.902 2.992 507.589 2.742 438.032-2.312 366.707 1.292 297.059 11.332 101.918 269.934 67.875 329.474 242.732c17.927 52.672 4.442 105.571 9.677 158.425 6.437 64.798 110.739 72.141 116.201-7.933L455.443 45.098C458.548 22.954 476.544 3.667 499.027.607z"/>
      <path d="M1599.25 132.742c171.46-12.602 275.71 183.741 182.7 323.989-76.09 114.682-231.52 123.68-321.25 19.127-108.15-125.014-28.49-329.833 138.55-342.116zm6.68 97.389c-97.84 8.159-132.61 134.106-58.49 196.41 51.24 43.063 126.85 26.631 159.12-30.461 42.12-74.52-13.03-173.247-100.63-165.949z"/>
      <path d="M1182.95 428.518c-3.1 3.082-.16 69.149-1.67 80.368-7.21 53.216-92.07 52.196-97.19-3.604V188.977c1.84-26.269 19.83-46.191 45.1-52.31 53.06 3.626 117.88-9.769 167.92 8.998 112.49 42.133 130.01 201.442 27.45 264.993-.48 1.994 6.26 9.7 7.93 11.831 21.96 27.719 59.61 55.505 43.36 95.417-12.71 31.187-56.98 37.238-80.12 13.372-26.06-26.857-48.25-68.877-74.11-96.709-1.93-2.085-3.97-4.057-5.96-6.051h-32.71zm.66-197.454l-1.99 1.995v106.727l1.99 1.995h60.08c3.06 0 14.49-3.377 18.02-4.692 52.58-19.65 36.51-106.047-16.68-106.047h-61.42v.022z"/>
      <path d="M1028.47 229.47c-3.81 2.244-14.46 6.935-18.43 6.935h-72.753v271.499c0 2.833-5.122 14.006-6.958 17.066-18.834 31.866-65.727 31.549-86.283 1.382-2.516-3.671-8.228-17.157-8.228-21.123V236.405h-67.427c-5.734 0-20.579-8.091-25.338-12.034C709.713 196.811 725.918 142.03 768.323 136.274c.612.045 1.202-.091 1.814-.068h233.443c1.75.09 3.47-.068 5.19.068 47.53 3.581 60.76 68.9 19.7 93.196z"/>
      <path d="M636.579 132.725c26.812-3.196 50.406 11.057 57.092 37.28 4.51 109.243.725 219.347 1.949 328.885-5.372 64.186-95.236 65.41-102.829 2.742l.181-326.777c3.695-21.871 21.214-40.456 43.63-43.13h-.023z"/>
    </svg>
  );
}

// Nitro brand mark — double-ring N
// Usage: <NitroLogo size={32} /> or <NitroLogo size={48} variant="icon" />
export default function NitroLogo({ size = 32, variant = "mark", color, style = {} }) {
  const uid = useId();
  const s = size;

  // Icon variant: solid N on gradient rounded square (for app icon, favicon, small contexts)
  if (variant === "icon") {
    const igid = `ng${uid}`;
    const r = Math.round(s * 0.25);
    const pad = s * 0.22;
    const nLeft = s * 0.28, nRight = s * 0.72;
    const nTop = pad, nBot = s - pad;
    const barW = s * 0.06;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style}>
        <defs>
          <linearGradient id={igid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c47d8e"/>
            <stop offset="100%" stopColor="#8b5e6b"/>
          </linearGradient>
        </defs>
        <rect width={s} height={s} rx={r} fill={`url(#${igid})`}/>
        <path
          d={`M${nLeft},${nBot} L${nLeft},${nTop} L${nLeft+barW},${nTop} L${nLeft+barW},${nBot-s*0.14} L${nRight-barW},${nTop} L${nRight},${nTop} L${nRight},${nBot} Z`}
          fill="#fff" opacity="0.95"
        />
      </svg>
    );
  }

  // Mark variant: double-ring N (the primary brand mark)
  const gid = `nmg${uid}`;
  const cx = s / 2, cy = s / 2;
  const outerR = s * 0.44;
  const innerR = s * 0.34;
  const nH = s * 0.30;
  const nW = s * 0.18;
  const sw = Math.max(3, s * 0.09);
  const ringSw = Math.max(1.5, s * 0.035);
  const innerSw = Math.max(0.8, s * 0.015);
  const strokeColor = color || `url(#${gid})`;
  const ringOpacity = color ? 0.4 : 1;
  const innerRingOpacity = color ? 0.15 : 0.35;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="inline-block align-middle" style={style}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
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
