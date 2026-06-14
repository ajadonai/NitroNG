'use client';
import { useState, useEffect } from 'react';

const TYPES = {
  success: {
    bgD: "rgba(16,32,22,.95)", bgL: "rgba(236,253,245,.97)",
    brdD: "rgba(110,231,183,.35)", brdL: "rgba(5,150,105,.3)",
    colD: "#6ee7b7", colL: "#059669",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  error: {
    bgD: "rgba(32,16,16,.95)", bgL: "rgba(254,242,242,.97)",
    brdD: "rgba(252,165,165,.35)", brdL: "rgba(220,38,38,.25)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  },
  warning: {
    bgD: "rgba(32,28,16,.95)", bgL: "rgba(255,251,235,.97)",
    brdD: "rgba(251,191,36,.35)", brdL: "rgba(217,119,6,.25)",
    colD: "#fbbf24", colL: "#d97706",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  info: {
    bgD: "rgba(16,20,32,.95)", bgL: "rgba(239,246,255,.97)",
    brdD: "rgba(96,165,250,.35)", brdL: "rgba(37,99,235,.25)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
};

const SAMPLES = [
  { type: "success", title: "Order cancelled", desc: "NTR-376, ₦4,800 refunded" },
  { type: "error", title: "Insufficient balance", desc: "You need ₦1,200 more to place this order" },
  { type: "info", title: "Still processing", desc: "2,500 of 5,000 delivered" },
  { type: "warning", title: "Transfer pending", desc: "You already have a pending bank transfer" },
  { type: "success", title: "Payment successful", desc: "₦5,000 credited to your wallet" },
  { type: "error", title: "Connection error", desc: "Check your internet and try again" },
  { type: "success", title: "Password updated", desc: "Your new password is active" },
  { type: "info", title: "Cart full", desc: "50 row limit reached" },
];

function ToastCurrent({ t, dark }) {
  const tt = TYPES[t.type];
  return (
    <div
      className="rounded-[14px] overflow-hidden backdrop-blur-[20px] shadow-[0_8px_32px_rgba(0,0,0,.25),0_2px_8px_rgba(0,0,0,.1)]"
      style={{
        background: dark ? tt.bgD : tt.bgL,
        border: `1.5px solid ${dark ? tt.brdD : tt.brdL}`,
        width: "100%",
      }}
    >
      <div className="flex gap-2.5 items-center py-3 px-3.5">
        <div className="shrink-0" style={{ color: dark ? tt.colD : tt.colL }}>{tt.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
          {t.desc && <div className="text-[13px] mt-0.5" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
        </div>
        <button className="bg-transparent p-0.5 shrink-0 opacity-50 cursor-pointer border-none" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="h-0.5 relative overflow-hidden">
        <div className="h-full w-3/4 opacity-30" style={{ background: dark ? tt.colD : tt.colL }} />
      </div>
    </div>
  );
}

function ToastA({ t, dark }) {
  const tt = TYPES[t.type];
  const col = dark ? tt.colD : tt.colL;
  return (
    <div
      className="rounded-xl overflow-hidden backdrop-blur-[20px] shadow-[0_4px_24px_rgba(0,0,0,.12),0_1px_4px_rgba(0,0,0,.06)] flex"
      style={{
        background: dark ? "rgba(20,20,24,.92)" : "rgba(255,255,255,.95)",
        border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"}`,
        width: "100%",
      }}
    >
      <div className="w-[3px] shrink-0 rounded-l-xl" style={{ background: col }} />
      <div className="flex-1 flex gap-3 items-center py-3 px-3.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${col}18`, color: col }}>
          {tt.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
          {t.desc && <div className="text-[13px] mt-0.5" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
        </div>
        <button className="bg-transparent p-0.5 shrink-0 opacity-40 hover:opacity-80 cursor-pointer border-none transition-opacity" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}

function ToastB({ t, dark }) {
  const tt = TYPES[t.type];
  const col = dark ? tt.colD : tt.colL;
  return (
    <div
      className="rounded-2xl overflow-hidden backdrop-blur-[20px] shadow-[0_8px_32px_rgba(0,0,0,.15),0_2px_8px_rgba(0,0,0,.06)]"
      style={{
        background: dark ? "rgba(20,20,24,.92)" : "rgba(255,255,255,.95)",
        width: "100%",
      }}
    >
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${col}, ${col}88)` }} />
      <div className="flex gap-3 items-start py-3.5 px-4">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${col}15`, color: col }}>
          {tt.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold leading-tight" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
          {t.desc && <div className="text-[13px] mt-1 leading-snug" style={{ color: dark ? "#a09b95" : "#6b6966" }}>{t.desc}</div>}
        </div>
        <button className="bg-transparent p-1 shrink-0 opacity-40 hover:opacity-80 cursor-pointer border-none transition-opacity rounded-md hover:bg-[rgba(128,128,128,.1)]" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}

function ToastC({ t, dark }) {
  const tt = TYPES[t.type];
  const col = dark ? tt.colD : tt.colL;
  return (
    <div
      className="rounded-xl overflow-hidden backdrop-blur-[20px] shadow-[0_4px_20px_rgba(0,0,0,.1),0_1px_4px_rgba(0,0,0,.04)]"
      style={{
        background: dark ? tt.bgD : tt.bgL,
        border: `1px solid ${dark ? tt.brdD : tt.brdL}`,
        width: "100%",
      }}
    >
      <div className="flex gap-3 items-center py-3.5 px-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${col}20`, color: col }}>
          {tt.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
          {t.desc && <div className="text-[13px] mt-0.5" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
        </div>
        <button className="bg-transparent p-0.5 shrink-0 opacity-40 cursor-pointer border-none" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="h-[3px] relative overflow-hidden mx-4 mb-3 rounded-full" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>
        <div className="h-full w-3/4 rounded-full" style={{ background: col, opacity: 0.5 }} />
      </div>
    </div>
  );
}

const DESIGNS = [
  { key: "current", label: "Current", desc: "Tinted bg, thin bottom progress bar, tight spacing", Component: ToastCurrent },
  { key: "a", label: "Design A", desc: "Left accent bar, neutral surface, icon badge", Component: ToastA },
  { key: "b", label: "Design B", desc: "Top color bar, larger icon, more padding, no border", Component: ToastB },
  { key: "c", label: "Design C", desc: "Tinted bg, rounded icon, thick progress track", Component: ToastC },
];

export default function ToastPreview() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState("current");

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
  const textSoft = dark ? "#a09b95" : "#555250";
  const textMuted = dark ? "#8a8580" : "#757170";
  const accent = "#c47d8e";
  const surface = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.7)";
  const surfaceBrd = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";

  if (!mounted) return null;

  const activeDes = DESIGNS.find(d => d.key === selected);

  return (
    <div className="min-h-dvh" style={{ background: bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-[20px] border-b" style={{ background: dark ? "rgba(8,11,20,.85)" : "rgba(244,241,237,.85)", borderColor: surfaceBrd }}>
        <div className="max-w-[1100px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[3px] mb-1" style={{ color: accent }}>Component Design</div>
              <h1 className="text-xl font-bold" style={{ color: text }}>Toast Visual Redesign</h1>
              <p className="text-[13px] mt-0.5" style={{ color: textMuted }}>Compare design directions across all 4 types</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompare(!compare)}
                className="py-2 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border-none transition-all"
                style={{
                  background: compare ? `${accent}20` : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"),
                  color: compare ? accent : textMuted,
                  border: `1px solid ${compare ? `${accent}40` : "transparent"}`,
                }}
              >
                {compare ? "Single view" : "Compare all"}
              </button>
              <button
                onClick={() => {
                  setDark(!dark);
                  try { localStorage.setItem("nitro-theme", !dark ? "night" : "day"); } catch {}
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer border-none"
                style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)", color: textSoft }}
              >
                {dark
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Design selector tabs (single view mode) */}
          {!compare && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {DESIGNS.map(d => {
                const active = selected === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setSelected(d.key)}
                    className="py-2 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border-none whitespace-nowrap transition-all"
                    style={{
                      background: active ? `${accent}20` : "transparent",
                      color: active ? accent : textMuted,
                      border: `1px solid ${active ? `${accent}40` : "transparent"}`,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1100px] mx-auto px-6 py-8">

        {compare ? (
          /* ── COMPARE ALL MODE ── */
          <div className="space-y-12">
            {DESIGNS.map(des => (
              <div key={des.key}>
                <div className="mb-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="text-base font-bold" style={{ color: text }}>{des.label}</h2>
                    {des.key === "current" && (
                      <span className="text-[10px] font-bold uppercase tracking-[1px] py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: textMuted }}>Current</span>
                    )}
                  </div>
                  <p className="text-[13px]" style={{ color: textMuted }}>{des.desc}</p>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
                  {SAMPLES.map((t, i) => (
                    <des.Component key={i} t={t} dark={dark} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── SINGLE VIEW MODE ── */
          <div>
            <div className="mb-6">
              <h2 className="text-base font-bold mb-1" style={{ color: text }}>{activeDes.label}</h2>
              <p className="text-[13px]" style={{ color: textMuted }}>{activeDes.desc}</p>
            </div>

            {/* Desktop mock: fixed position preview */}
            <div className="mb-10">
              <div className="text-[11px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: accent }}>Desktop position (top right)</div>
              <div className="rounded-2xl overflow-hidden relative" style={{ background: dark ? "#0c0f18" : "#eae7e3", border: `1px solid ${surfaceBrd}`, height: 380 }}>
                {/* Fake page content */}
                <div className="absolute inset-0 p-6">
                  <div className="h-3 w-32 rounded-full mb-3" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }} />
                  <div className="h-2.5 w-48 rounded-full mb-6" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }} />
                  <div className="grid grid-cols-3 gap-3">
                    {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)" }} />)}
                  </div>
                  <div className="h-40 mt-3 rounded-xl" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }} />
                </div>
                {/* Toast stack */}
                <div className="absolute top-4 right-4 w-[340px] flex flex-col gap-2.5">
                  <activeDes.Component t={SAMPLES[0]} dark={dark} />
                  <activeDes.Component t={SAMPLES[1]} dark={dark} />
                </div>
              </div>
            </div>

            {/* Mobile mock */}
            <div className="mb-10">
              <div className="text-[11px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: accent }}>Mobile position (top, edge to edge)</div>
              <div className="mx-auto rounded-[28px] overflow-hidden relative" style={{ width: 320, height: 560, background: dark ? "#0c0f18" : "#eae7e3", border: `1px solid ${surfaceBrd}` }}>
                {/* Status bar */}
                <div className="h-11 flex items-end justify-center pb-1">
                  <div className="w-20 h-[5px] rounded-full" style={{ background: dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)" }} />
                </div>
                {/* Fake page */}
                <div className="px-4 pt-2">
                  <div className="h-3 w-24 rounded-full mb-2" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }} />
                  <div className="h-2.5 w-36 rounded-full mb-4" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }} />
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)" }} />)}
                  </div>
                </div>
                {/* Toast */}
                <div className="absolute top-12 left-3 right-3">
                  <activeDes.Component t={SAMPLES[4]} dark={dark} />
                </div>
              </div>
            </div>

            {/* All types grid */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: accent }}>All types</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
                {SAMPLES.map((t, i) => (
                  <div key={i} className="rounded-2xl p-4" style={{ background: surface, border: `1px solid ${surfaceBrd}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[1px] py-0.5 px-2 rounded-md" style={{
                        color: dark ? TYPES[t.type].colD : TYPES[t.type].colL,
                        background: `${dark ? TYPES[t.type].colD : TYPES[t.type].colL}15`,
                      }}>{t.type}</span>
                    </div>
                    <activeDes.Component t={t} dark={dark} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
