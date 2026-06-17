"use client";
import { ThemeProvider, useTheme } from "../shared-nav";

function Inner({ token }) {
  const { t } = useTheme();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: t.bg }}>
      <div className="w-full max-w-[440px] mx-4 rounded-2xl p-8" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-center mb-6">
          <div className="serif text-2xl font-semibold" style={{ color: t.text }}>Join Pit Crew</div>
          <p className="text-sm mt-2" style={{ color: t.muted }}>Coming in Phase 2</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage({ token }) {
  return <ThemeProvider storageKey="nitro-theme"><Inner token={token} /></ThemeProvider>;
}
