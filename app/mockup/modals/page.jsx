'use client';
import { useState, useEffect } from 'react';

const MODAL_TOKENS = {
  dark: {
    bg: "#0e1120",
    border: "rgba(255,255,255,.22)",
    shadow: "0 20px 60px rgba(0,0,0,.4)",
    backdrop: "rgba(0,0,0,.45)",
  },
  light: {
    bg: "#fff",
    border: "rgba(0,0,0,.14)",
    shadow: "0 20px 60px rgba(0,0,0,.1)",
    backdrop: "rgba(0,0,0,.45)",
  },
};

const TOKEN_TABLE = [
  { prop: "Dark bg", normalized: "#0e1120", current: ["#0e1120", "#111628", "#111728", "#141821", "rgba(17,22,40,.98)"] },
  { prop: "Light bg", normalized: "#fff", current: ["#fff", "#ffffff", "rgba(255,255,255,.98)"] },
  { prop: "Backdrop", normalized: "rgba(0,0,0,.45)", current: ["rgba(0,0,0,.4)", "rgba(0,0,0,.5)", "bg-black/40", "bg-black/50"] },
  { prop: "Backdrop blur", normalized: "blur(4px)", current: ["none", "blur(4px)", "blur(8px)"] },
  { prop: "Border (dark)", normalized: "rgba(255,255,255,.22)", current: ["rgba(255,255,255,.18)", ".14", ".12", ".1", "t.cardBorder"] },
  { prop: "Border (light)", normalized: "rgba(0,0,0,.14)", current: ["rgba(0,0,0,.14)", ".12", ".1", ".08", "t.surfaceBorder"] },
  { prop: "Border width", normalized: "1px", current: ["0.5px", "1px", "1.5px"] },
  { prop: "Border radius", normalized: "rounded-2xl (16px)", current: ["rounded-2xl", "rounded-[20px]", "rounded-[14px]"] },
  { prop: "Shadow (dark)", normalized: "0 20px 60px rgba(0,0,0,.4)", current: [".5", ".38", ".3"] },
  { prop: "Shadow (light)", normalized: "0 20px 60px rgba(0,0,0,.1)", current: [".1", ".12", ".3"] },
  { prop: "Max width", normalized: "420px", current: ["380px", "400px", "420px", "440px"] },
  { prop: "Padding", normalized: "p-6", current: ["p-5", "p-6", "px-8 py-9"] },
  { prop: "Z-index", normalized: "z-50 / z-[300] confirm", current: ["z-50", "z-[100]", "z-[300]"] },
  { prop: "Entrance", normalized: "backdrop fade + dialog bounce", current: ["none", "fade", "bounce-in"] },
];

function ModalShell({ dark, children, maxW = 420 }) {
  const t = dark ? MODAL_TOKENS.dark : MODAL_TOKENS.light;
  return (
    <div className="rounded-2xl p-6 w-full animate-[modalBounce_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ maxWidth: maxW, background: t.bg, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      {children}
    </div>
  );
}

function MockConfirm({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const soft = dark ? "#a09b95" : "#555250";
  const accent = "#c47d8e";
  return (
    <ModalShell dark={dark}>
      <div className="text-center">
        <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mx-auto mb-4" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        </div>
        <div className="text-[17px] font-semibold mb-1.5" style={{ color: text }}>Cancel this order?</div>
        <div className="text-sm leading-[1.65] mb-5" style={{ color: soft }}>₦4,800 will be refunded to your wallet. This can't be undone.</div>
        <div className="flex gap-2.5">
          <button className="flex-1 py-3 rounded-[10px] text-[15px] font-semibold cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", color: soft, border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}>Cancel</button>
          <button className="flex-1 py-3 rounded-[10px] text-[15px] font-semibold cursor-pointer text-white" style={{ background: "#dc2626", border: `1px solid ${dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.3)"}` }}>Confirm</button>
        </div>
      </div>
    </ModalShell>
  );
}

function MockFormModal({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const soft = dark ? "#a09b95" : "#555250";
  const muted = dark ? "#8a8580" : "#757170";
  const accent = "#c47d8e";
  const inputBg = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)";
  const inputBrd = dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)";
  return (
    <ModalShell dark={dark}>
      <div className="flex justify-between items-center mb-4">
        <div className="text-base font-semibold" style={{ color: text }}>Configure Flutterwave</div>
        <button className="bg-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: muted, border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="text-[13px] mb-4 leading-normal" style={{ color: muted }}>Enter your API keys. Leave blank to keep existing keys.</div>
      {["Public Key", "Secret Key"].map(label => (
        <div key={label} className="mb-3.5">
          <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: muted }}>{label}</label>
          <div className="text-xs mb-1" style={{ color: muted }}>Current: ••••••••7a3f</div>
          <input type="password" placeholder={`Enter ${label}`} className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${inputBrd}`, background: inputBg, color: text }} readOnly />
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <button className="flex-1 py-[11px] rounded-lg text-sm font-semibold border-none cursor-pointer text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", border: `1px solid ${dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.3)"}` }}>Save Keys</button>
        <button className="py-[11px] px-5 rounded-lg text-sm cursor-pointer bg-transparent flex items-center justify-center" style={{ border: `1px solid ${inputBrd}`, color: muted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </ModalShell>
  );
}

function MockInfoModal({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const muted = dark ? "#8a8580" : "#757170";
  const accent = "#c47d8e";
  return (
    <ModalShell dark={dark}>
      <div className="-mx-6 -mt-6 mb-0 py-4 px-5 flex items-center justify-between rounded-t-2xl" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
        <div className="text-[15px] font-semibold" style={{ color: text }}>How it works</div>
        <button className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)", color: muted }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="pt-5 flex flex-col gap-3.5">
        {[
          { step: "1", title: "Create your account", desc: "Sign up with your email" },
          { step: "2", title: "Add funds", desc: "Top up via bank transfer or card" },
          { step: "3", title: "Place your order", desc: "Pick a platform and service" },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)", color: accent }}>{item.step}</div>
            <div className="pt-0.5">
              <div className="text-[13px] font-semibold mb-0.5" style={{ color: text }}>{item.title}</div>
              <div className="text-[12px] leading-[1.55]" style={{ color: muted }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function MockPaymentModal({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const soft = dark ? "#a09b95" : "#555250";
  const muted = dark ? "#8a8580" : "#757170";
  const green = dark ? "#6ee7b7" : "#059669";
  const inputBrd = dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)";
  return (
    <ModalShell dark={dark}>
      <div className="text-base font-semibold mb-1" style={{ color: text }}>Bank Transfer</div>
      <div className="text-[13px] mb-2" style={{ color: muted }}>Transfer this exact amount to the account below</div>
      <div className="flex items-center justify-between py-2 px-3 rounded-lg mb-2.5" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)"}` }}>
        <span className="text-lg font-bold" style={{ color: green, fontFamily: "'JetBrains Mono', monospace" }}>₦5,000</span>
        <button className="py-[3px] px-2.5 rounded-md bg-transparent text-[11px] font-semibold cursor-pointer border-none" style={{ border: `1px solid ${dark ? "rgba(110,231,183,.3)" : "rgba(5,150,105,.2)"}`, color: green }}>Copy</button>
      </div>
      <div className="rounded-xl mb-3 overflow-hidden" style={{ border: `1px solid ${inputBrd}` }}>
        <div className="p-3.5" style={{ background: dark ? "rgba(255,255,255,.04)" : "transparent" }}>
          {[["Bank", "Wema Bank"], ["Account Number", "8259301746"], ["Account Name", "Nitro Technologies"]].map(([label, val], i) => (
            <div key={i} className={i > 0 ? "mt-2.5" : ""}>
              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: muted }}>{label}</div>
              <div className="text-[15px] font-semibold" style={{ color: text }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer" style={{ border: `1px solid ${inputBrd}`, color: muted }}>Cancel</button>
        <button className="flex-1 py-2.5 rounded-lg border-none text-white text-sm font-semibold cursor-pointer" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", border: `1px solid ${dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.3)"}` }}>I've sent the money</button>
      </div>
    </ModalShell>
  );
}

function MockRewardModal({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const muted = dark ? "#8a8580" : "#757170";
  const accent = "#c47d8e";
  const inputBg = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)";
  const inputBrd = dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)";
  return (
    <ModalShell dark={dark}>
      <div className="flex items-center gap-2 mb-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 010-4h12v4"/><path d="M4 6v12a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg>
        <div className="text-base font-semibold" style={{ color: text }}>Reward User</div>
      </div>
      <div className="text-[13px] mb-4" style={{ color: muted }}>John Doe · john@example.com</div>
      <div className="mb-3">
        <label className="text-[13px] block mb-1" style={{ color: muted }}>Amount (₦)</label>
        <input type="text" placeholder="5000" className="w-full py-[9px] px-3 rounded-lg text-[15px] outline-none box-border" style={{ border: `1px solid ${inputBrd}`, background: inputBg, color: text }} readOnly />
        <div className="flex gap-1 mt-1.5">
          {["₦1,000", "₦2,000", "₦3,000", "₦5,000"].map(q => (
            <button key={q} className="flex-1 py-[5px] rounded-md text-xs font-semibold cursor-pointer" style={{ background: q === "₦5,000" ? `${accent}20` : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), color: q === "₦5,000" ? accent : muted, border: `1px solid ${q === "₦5,000" ? `${accent}40` : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)")}` }}>{q}</button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="text-[13px] block mb-1" style={{ color: muted }}>Note (optional)</label>
        <input placeholder="Leaderboard reward" className="w-full py-[9px] px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${inputBrd}`, background: inputBg, color: text }} readOnly />
      </div>
      <div className="flex gap-2">
        <button className="py-2.5 px-5 rounded-lg text-sm font-medium cursor-pointer bg-transparent flex items-center justify-center" style={{ border: `1px solid ${inputBrd}`, color: muted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button className="flex-1 py-2.5 rounded-lg border-none text-sm font-semibold cursor-pointer text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", border: `1px solid ${dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.3)"}` }}>Send ₦5,000</button>
      </div>
    </ModalShell>
  );
}

function MockDeleteModal({ dark }) {
  const text = dark ? "#f5f3f0" : "#1a1917";
  const muted = dark ? "#8a8580" : "#757170";
  const inputBrd = dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)";
  return (
    <ModalShell dark={dark}>
      <div className="text-lg font-semibold mb-1" style={{ color: text }}>Delete Promotion</div>
      <p className="text-sm mb-5" style={{ color: muted }}>If this promotion has linked orders it will be ended instead. Otherwise it will be permanently deleted.</p>
      <div className="flex gap-2">
        <button className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer" style={{ background: "#dc2626", border: `1px solid ${dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.3)"}` }}>Delete</button>
        <button className="py-2.5 px-5 rounded-lg text-sm cursor-pointer bg-transparent flex items-center justify-center" style={{ border: `1px solid ${inputBrd}`, color: muted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </ModalShell>
  );
}

const MODALS = [
  { key: "confirm", label: "Confirm Dialog", desc: "Dangerous action confirmation", Component: MockConfirm, source: "confirm-dialog.jsx" },
  { key: "form", label: "Form Modal", desc: "Gateway config, add gateway", Component: MockFormModal, source: "admin-pages.jsx" },
  { key: "info", label: "Info Modal", desc: "Tutorial, what to expect", Component: MockInfoModal, source: "dashboard.jsx" },
  { key: "payment", label: "Payment Modal", desc: "Bank transfer, crypto", Component: MockPaymentModal, source: "addfunds-page.jsx" },
  { key: "reward", label: "Reward Modal", desc: "Leaderboard reward", Component: MockRewardModal, source: "admin-leaderboard.jsx" },
  { key: "delete", label: "Delete Modal", desc: "Promotion delete", Component: MockDeleteModal, source: "admin-promotions.jsx" },
];

export default function ModalPreview() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [livePreview, setLivePreview] = useState(null);

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
      <style>{`
        @keyframes modalBounce {
          from { transform: scale(.92) translateY(8px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-[20px] border-b" style={{ background: dark ? "rgba(8,11,20,.85)" : "rgba(244,241,237,.85)", borderColor: surfaceBrd }}>
        <div className="max-w-[1100px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[3px] mb-1" style={{ color: accent }}>Component Design</div>
              <h1 className="text-xl font-bold" style={{ color: text }}>Modal Normalization</h1>
              <p className="text-[13px] mt-0.5" style={{ color: textMuted }}>Unified tokens across all 11 modal instances</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTable(!showTable)}
                className="py-2 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border-none"
                style={{
                  background: showTable ? `${accent}20` : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"),
                  color: showTable ? accent : textMuted,
                  border: `1px solid ${showTable ? `${accent}40` : "transparent"}`,
                }}
              >{showTable ? "Hide changes" : "Show changes"}</button>
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
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-8">

        {/* Token change table */}
        {showTable && (
          <div className="rounded-2xl overflow-hidden mb-10" style={{ border: `1px solid ${surfaceBrd}` }}>
            <div className="py-3 px-5 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: accent, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", borderBottom: `1px solid ${surfaceBrd}` }}>What changes</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${surfaceBrd}` }}>
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: textMuted }}>Property</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: dark ? "#6ee7b7" : "#059669" }}>Normalized</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Current values</th>
                  </tr>
                </thead>
                <tbody>
                  {TOKEN_TABLE.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < TOKEN_TABLE.length - 1 ? `1px solid ${surfaceBrd}` : "none" }}>
                      <td className="py-2 px-4 text-[13px] font-semibold whitespace-nowrap" style={{ color: text }}>{row.prop}</td>
                      <td className="py-2 px-4 text-[13px] font-mono" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{row.normalized}</td>
                      <td className="py-2 px-4 text-[12px]" style={{ color: textMuted }}>{row.current.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 440px), 1fr))" }}>
          {MODALS.map(m => (
            <div key={m.key}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[15px] font-bold" style={{ color: text }}>{m.label}</h2>
                <span className="text-[10px] font-semibold py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: textMuted }}>{m.source}</span>
              </div>
              <div className="rounded-2xl p-6 flex items-center justify-center min-h-[200px] relative" style={{ background: dark ? "rgba(0,0,0,.3)" : "rgba(0,0,0,.04)", backdropFilter: "blur(4px)" }}>
                <m.Component dark={dark} />
              </div>
            </div>
          ))}
        </div>

        {/* Live preview button */}
        <div className="mt-10 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[2px] mb-3" style={{ color: accent }}>Live preview</div>
          <p className="text-[13px] mb-4" style={{ color: textMuted }}>Click any modal type to see it with the backdrop overlay</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {MODALS.map(m => (
              <button key={m.key} onClick={() => setLivePreview(m.key)} className="py-2 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: textMuted }}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Live overlay preview */}
      {livePreview && (() => {
        const m = MODALS.find(x => x.key === livePreview);
        return (
          <div onClick={() => setLivePreview(null)} className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" style={{ background: "rgba(0,0,0,.45)" }}>
            <div onClick={e => e.stopPropagation()}>
              <m.Component dark={dark} />
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
