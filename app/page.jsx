'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

function LoadingScreen() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem("nitro-theme");
      if (s === "night" || s === "dark") setDark(true);
      else if (s === "day" || s === "light") setDark(false);
      else { const h = new Date().getHours(); setDark(h < 7 || h >= 18); }
    } catch {}
  }, []);
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#090c15" : "#f0ede8", transition: "background .3s" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#c47d8e,#a3586b)", display: "inline-flex", alignItems: "center", justifyContent: "center", animation: "pulse 1.5s ease infinite" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    </div>
  );
}

const Landing = dynamic(() => import('@/components/landing-page'), { ssr: false, loading: () => <LoadingScreen /> });

export default function HomePage() {
  return <Landing />;
}
