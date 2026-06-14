'use client';
import { useState, useEffect } from 'react';

const ALERT_TYPES = {
  success: {
    bgD: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.06)",
    brdD: "rgba(110,231,183,.28)", brdL: "rgba(5,150,105,.2)",
    colD: "#6ee7b7", colL: "#059669",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  error: {
    bgD: "rgba(252,165,165,.1)", bgL: "rgba(220,38,38,.06)",
    brdD: "rgba(252,165,165,.28)", brdL: "rgba(220,38,38,.2)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  },
  warning: {
    bgD: "rgba(251,191,36,.1)", bgL: "rgba(217,119,6,.06)",
    brdD: "rgba(251,191,36,.28)", brdL: "rgba(217,119,6,.2)",
    colD: "#fbbf24", colL: "#d97706",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  info: {
    bgD: "rgba(96,165,250,.1)", bgL: "rgba(37,99,235,.06)",
    brdD: "rgba(96,165,250,.28)", brdL: "rgba(37,99,235,.2)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
};

const BANNER_TYPES = {
  info: {
    bgD: "rgba(196,125,142,.12)", bgL: "rgba(196,125,142,.07)",
    brdD: "rgba(196,125,142,.3)", brdL: "rgba(196,125,142,.2)",
    colD: "#e0a0b0", colL: "#8b5e6b",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
  warning: {
    bgD: "rgba(251,191,36,.12)", bgL: "rgba(217,119,6,.07)",
    brdD: "rgba(251,191,36,.3)", brdL: "rgba(217,119,6,.2)",
    colD: "#fcd34d", colL: "#d97706",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  success: {
    bgD: "rgba(110,231,183,.12)", bgL: "rgba(5,150,105,.07)",
    brdD: "rgba(110,231,183,.3)", brdL: "rgba(5,150,105,.2)",
    colD: "#6ee7b7", colL: "#059669",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  urgent: {
    bgD: "rgba(252,165,165,.12)", bgL: "rgba(220,38,38,.07)",
    brdD: "rgba(252,165,165,.3)", brdL: "rgba(220,38,38,.2)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  },
};

function InlineAlert({ type, text, dark, dismissible, cta }) {
  const t = ALERT_TYPES[type] || ALERT_TYPES.info;
  const col = dark ? t.colD : t.colL;
  return (
    <div className="flex items-start gap-3 py-3 px-3.5 rounded-xl overflow-hidden relative" style={{
      background: dark ? t.bgD : t.bgL,
      border: `1px solid ${dark ? t.brdD : t.brdL}`,
    }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: col }} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-1" style={{ background: `${col}18` }}>
        {t.icon(col)}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[13px] font-medium leading-snug" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{text}</div>
        {cta && (
          <button className="mt-2 py-1.5 px-3 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: `${col}18`, color: col, border: `1px solid ${dark ? t.brdD : t.brdL}` }}>{cta}</button>
        )}
      </div>
      {dismissible && (
        <button className="bg-transparent border-none cursor-pointer p-1 shrink-0 opacity-50 hover:opacity-80" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}

function AnnouncementBanner({ type, text, dark, action }) {
  const t = BANNER_TYPES[type] || BANNER_TYPES.info;
  const col = dark ? t.colD : t.colL;
  return (
    <div className="rounded-xl overflow-hidden relative" style={{
      background: dark ? t.bgD : t.bgL,
      border: `1px solid ${dark ? t.brdD : t.brdL}`,
    }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: col }} />
      <div className="flex items-center gap-2.5 py-2.5 px-4 pl-5 pr-10 justify-center relative">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${col}18` }}>
          {t.icon(col)}
        </div>
        <div className="text-[13px] md:text-sm font-medium" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>
          {text}
          {action && (
            <span className="text-[12px] md:text-[13px] font-semibold ml-1.5 cursor-pointer hover:underline" style={{ color: col }}>{action}</span>
          )}
        </div>
        <button className="bg-transparent border-none cursor-pointer p-1.5 opacity-50 hover:opacity-80 absolute right-2 top-1/2 -translate-y-1/2" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}

const INLINE_SAMPLES = [
  { type: "success", text: "Settings saved", dismissible: false },
  { type: "success", text: "Password updated successfully", dismissible: false },
  { type: "error", text: "Could not save configuration. Check your connection and try again.", dismissible: true },
  { type: "error", text: "Invalid credentials. Please check your email and password.", dismissible: false },
  { type: "warning", text: "Insufficient balance. You need ₦1,200 more to place these orders.", dismissible: true, cta: "Top up wallet" },
  { type: "warning", text: "You already have a pending bank transfer", dismissible: false },
  { type: "info", text: "Your account has been created. Check your email for a verification link.", dismissible: true },
  { type: "info", text: "3 rewarded, 1 failed", dismissible: false },
];

const BANNER_SAMPLES = [
  { type: "info", text: "New services added. Check out *TikTok Views* and *Threads Followers*.", action: "View services →" },
  { type: "warning", text: "Scheduled maintenance on *June 20th* at 2:00 AM. Orders may be delayed.", action: "Learn more →" },
  { type: "success", text: "Your referral bonus of *₦500* has been credited to your wallet." },
  { type: "urgent", text: "Instagram services temporarily paused due to provider issues. *ETA: 2 hours*." },
];

export default function AlertPreview() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("nitro-theme") || "auto";
      const h = new Date().getHours();
      if (s === "night") setDark(true);
      else if (s === "day") setDark(false);
      else setDark(h >= 19 || h < 7);
    } catch {}
    setMounted(true);
  }, []);

  const bg = dark ? "#080b14" : "#f4f1ed";
  const text = dark ? "#f5f3f0" : "#1a1917";
  const textMuted = dark ? "#8a8580" : "#757170";
  const accent = "#c47d8e";
  const surface = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.7)";
  const surfaceBrd = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";

  if (!mounted) return null;

  return (
    <div className="min-h-dvh" style={{ background: bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-[20px] border-b" style={{ background: dark ? "rgba(8,11,20,.85)" : "rgba(244,241,237,.85)", borderColor: surfaceBrd }}>
        <div className="max-w-[900px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[3px] mb-1" style={{ color: accent }}>Component Design</div>
              <h1 className="text-xl font-bold" style={{ color: text }}>Alert Banners</h1>
              <p className="text-[13px] mt-0.5" style={{ color: textMuted }}>Inline alerts + announcement banners, normalized</p>
            </div>
            <button
              onClick={() => { setDark(!dark); try { localStorage.setItem("nitro-theme", !dark ? "night" : "day"); } catch {} }}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer border-none"
              style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)", color: textMuted }}
            >
              {dark
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-8">

        {/* ── INLINE ALERTS ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold" style={{ color: text }}>Inline Alerts</h2>
            <span className="text-[10px] font-semibold py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: textMuted }}>17 instances across 9 files</span>
          </div>
          <p className="text-[13px] mb-5" style={{ color: textMuted }}>Form results, validation errors, status messages. Left accent bar + icon badge + text.</p>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 400px), 1fr))" }}>
            {INLINE_SAMPLES.map((s, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: surface, border: `1px solid ${surfaceBrd}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[1px] py-0.5 px-2 rounded-md" style={{
                    color: dark ? ALERT_TYPES[s.type].colD : ALERT_TYPES[s.type].colL,
                    background: `${dark ? ALERT_TYPES[s.type].colD : ALERT_TYPES[s.type].colL}15`,
                  }}>{s.type}{s.dismissible ? " · dismissible" : ""}</span>
                </div>
                <InlineAlert type={s.type} text={s.text} dark={dark} dismissible={s.dismissible} cta={s.cta} />
              </div>
            ))}
          </div>
        </div>

        {/* ── ANNOUNCEMENT BANNERS ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold" style={{ color: text }}>Announcement Banners</h2>
            <span className="text-[10px] font-semibold py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: textMuted }}>announcement-banner.jsx</span>
          </div>
          <p className="text-[13px] mb-5" style={{ color: textMuted }}>Global dismissible banners. Dashboard mode (rounded) shown here.</p>

          <div className="flex flex-col gap-3">
            {BANNER_SAMPLES.map((s, i) => (
              <AnnouncementBanner key={i} type={s.type} text={s.text.replace(/\*([^*]+)\*/g, '$1')} dark={dark} action={s.action} />
            ))}
          </div>
        </div>

        {/* ── DESIGN TOKENS ── */}
        <div className="mb-12">
          <h2 className="text-base font-bold mb-4" style={{ color: text }}>Normalized Tokens</h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${surfaceBrd}` }}>
            <div className="py-3 px-5 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: accent, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", borderBottom: `1px solid ${surfaceBrd}` }}>Inline alerts</div>
            <div className="p-5 text-[13px] leading-relaxed" style={{ color: textMuted }}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div><span className="font-semibold" style={{ color: text }}>Radius:</span> rounded-xl (12px)</div>
                <div><span className="font-semibold" style={{ color: text }}>Padding:</span> py-3 px-3.5</div>
                <div><span className="font-semibold" style={{ color: text }}>Left bar:</span> 3px solid (type color)</div>
                <div><span className="font-semibold" style={{ color: text }}>Border:</span> 1px solid (type color, 20-28% opacity)</div>
                <div><span className="font-semibold" style={{ color: text }}>Icon:</span> 14px in 28px rounded-lg badge</div>
                <div><span className="font-semibold" style={{ color: text }}>Text:</span> 13px font-medium</div>
                <div><span className="font-semibold" style={{ color: text }}>Background:</span> type color at 6-10% opacity</div>
                <div><span className="font-semibold" style={{ color: text }}>CTA button:</span> type-colored, bordered</div>
              </div>
            </div>
            <div className="py-3 px-5 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: accent, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", borderTop: `1px solid ${surfaceBrd}`, borderBottom: `1px solid ${surfaceBrd}` }}>Announcement banners</div>
            <div className="p-5 text-[13px] leading-relaxed" style={{ color: textMuted }}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div><span className="font-semibold" style={{ color: text }}>Radius:</span> rounded-xl (12px)</div>
                <div><span className="font-semibold" style={{ color: text }}>Padding:</span> py-2.5 px-4</div>
                <div><span className="font-semibold" style={{ color: text }}>Left bar:</span> 3px solid (type color)</div>
                <div><span className="font-semibold" style={{ color: text }}>Border:</span> 1px solid (type color, 20-30% opacity)</div>
                <div><span className="font-semibold" style={{ color: text }}>Icon:</span> 14px in 24px rounded-md badge</div>
                <div><span className="font-semibold" style={{ color: text }}>Layout:</span> centered, close button absolute right</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── IN CONTEXT ── */}
        <div>
          <h2 className="text-base font-bold mb-4" style={{ color: text }}>In Context</h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}>
            <div className="p-5">
              <div className="text-base font-semibold mb-1" style={{ color: text }}>Account Settings</div>
              <div className="text-[13px] mb-4" style={{ color: textMuted }}>Manage your account preferences</div>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold mb-1" style={{ color: textMuted }}>Display Name</label>
                <div className="w-full py-2.5 px-3 rounded-lg text-sm" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: text }}>John Doe</div>
              </div>
              <div className="mb-4">
                <label className="block text-[13px] font-semibold mb-1" style={{ color: textMuted }}>Email</label>
                <div className="w-full py-2.5 px-3 rounded-lg text-sm" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: text }}>john@example.com</div>
              </div>

              <InlineAlert type="success" text="Profile updated" dark={dark} dismissible={false} />

              <div className="mt-4">
                <button className="py-2.5 px-5 rounded-lg text-sm font-semibold cursor-pointer text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", border: `1px solid ${dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.3)"}` }}>Save Changes</button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}>
            <div className="p-5">
              <div className="text-base font-semibold mb-4" style={{ color: text }}>Login</div>
              <div className="mb-3">
                <div className="w-full py-2.5 px-3 rounded-lg text-sm" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: textMuted }}>admin@nitro.ng</div>
              </div>
              <div className="mb-3">
                <div className="w-full py-2.5 px-3 rounded-lg text-sm" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: textMuted }}>••••••••</div>
              </div>
              <InlineAlert type="error" text="Invalid credentials. Please check your email and password." dark={dark} dismissible={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
