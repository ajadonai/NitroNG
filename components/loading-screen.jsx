'use client';
import { useEffect, useState } from 'react';
import NitroLoader from './nitro-loader';

export default function LoadingScreen() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("nitro-theme") : null;
      if (s === "night") setDark(true);
      else if (s === "day") setDark(false);
      else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
    } catch { const h = new Date().getHours(); setDark(h >= 19 || h < 6); }
  }, []);

  const bg = dark ? "#090c15" : "#f4f1ed";

  return (
    <div className="h-dvh flex items-center justify-center" style={{ background: bg }}>
      <NitroLoader size={72} />
    </div>
  );
}
