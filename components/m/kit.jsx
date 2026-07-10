"use client";
import { useState, useEffect } from "react";

// ── Modal ──
export function Modal({ open, onClose, title, subtitle, dark, t, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] backdrop-blur-[4px] flex items-center justify-center p-4 animate-[modalFadeIn_.2s_ease]"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]"
        onClick={e => e.stopPropagation()}
        style={{
          background: dark ? "#0e1120" : "#fff",
          border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`,
          boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)",
        }}
      >
        <div className="py-3 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.08)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
          <div>
            <div className="text-[13px] font-semibold tracking-[0.3px] uppercase" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{title}</div>
            {subtitle && <div className="text-[11.5px] mt-[2px]" style={{ color: dark ? "#a09b95" : "#555250" }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none cursor-pointer text-[18px] leading-none" style={{ color: dark ? "#a09b95" : "#555250" }}>×</button>
        </div>
        <div className="p-5 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

// ── StatCard ──
export function StatCard({ label, value, caption, captionUp, dark, t }) {
  return (
    <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>{label}</div>
      </div>
      <div className="py-[14px] px-[18px]">
        <div className="m text-[24px] font-semibold tracking-tight" style={{ color: t.text }}>{value}</div>
        {caption && <div className="text-[11.5px] mt-[4px]" style={{ color: captionUp ? t.green : t.soft }}>{caption}</div>}
      </div>
    </div>
  );
}

// ── StatusBadge ──
const STATUS_STYLES = (t, dark) => ({
  approved: { color: t.green, bg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" },
  held:     { color: dark ? "#fcd34d" : "#b45309", bg: dark ? "rgba(250,204,21,.12)" : "rgba(250,204,21,.08)" },
  voided:   { color: t.red, bg: dark ? "rgba(239,68,68,.08)" : "rgba(239,68,68,.06)" },
  pending:  { color: t.soft, bg: t.surface, border: t.surfaceBrd },
  requested:{ color: dark ? "#fcd34d" : "#b45309", bg: dark ? "rgba(250,204,21,.12)" : "rgba(250,204,21,.08)" },
  processing:{ color: dark ? "#a5b4fc" : "#4f46e5", bg: dark ? "rgba(165,180,252,.1)" : "rgba(79,70,229,.06)" },
  completed:{ color: t.green, bg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" },
  paid:     { color: t.green, bg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" },
  rejected: { color: t.red, bg: dark ? "rgba(239,68,68,.08)" : "rgba(239,68,68,.06)" },
  active:   { color: t.green, bg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" },
  suspended:{ color: t.red, bg: dark ? "rgba(239,68,68,.08)" : "rgba(239,68,68,.06)" },
  invited:  { color: t.soft, bg: t.surface, border: t.surfaceBrd },
  expired:  { color: dark ? "#fcd34d" : "#b45309", bg: dark ? "rgba(250,204,21,.12)" : "rgba(250,204,21,.08)" },
});

export function StatusBadge({ status, label, dark, t }) {
  const s = STATUS_STYLES(t, dark)[status] || STATUS_STYLES(t, dark).pending;
  return (
    <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold py-1 px-2.5 rounded-full" style={{ color: s.color, background: s.bg, ...(s.border ? { border: `1px solid ${s.border}` } : {}) }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── TierProgress ──
const TIER_ICONS = {
  starter: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  growth: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  pro: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 3h12l4 6-10 13L2 9z"/></svg>,
};
const DEFAULT_TIER_CONFIG = {
  starter: { rate: 30, min: 0 },
  growth: { rate: 40, min: 30 },
  pro: { rate: 50, min: 100 },
  leadSplit: 40,
};

export function TierProgress({ tier, activeCount, tierConfig, links, dark, t }) {
  const cfg = tierConfig || DEFAULT_TIER_CONFIG;
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const currentRate = cfg[tier]?.rate || cfg.starter.rate;
  const linkCount = links?.length || 0;

  const steps = [
    { key: "starter", label: "Starter", rate: cfg.starter?.rate || 30, min: 0, icon: TIER_ICONS.starter },
    { key: "growth", label: "Growth", rate: cfg.growth?.rate || 40, min: cfg.growth?.min || 30, icon: TIER_ICONS.growth },
    { key: "pro", label: "Pro", rate: cfg.pro?.rate || 50, min: cfg.pro?.min || 100, icon: TIER_ICONS.pro },
  ];
  const currentIdx = steps.findIndex(s => s.key === tier);
  const nextStep = steps[currentIdx + 1] || null;
  const remaining = nextStep ? Math.max(0, nextStep.min - activeCount) : 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="py-[10px] px-[18px] flex items-center gap-2" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>{tierName} Tier</div>
        <span className="text-[10.5px] font-semibold py-[1px] px-[6px] rounded-md" style={{ color: t.accent, background: t.accentLight }}>{currentRate}%</span>
        {linkCount > 0 && (
          <span className="text-[10.5px] font-medium" style={{ color: t.soft }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline -mt-px mr-[3px]"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {linkCount}
          </span>
        )}
        <span className="relative group ml-auto cursor-help shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-10" style={{ background: "rgba(0,0,0,.85)" }}>
            You earn {currentRate}% of profit on every sale
          </span>
        </span>
      </div>

      <div className="py-5 px-5 flex flex-col gap-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12.5px] font-semibold" style={{ color: t.text }}>
              {nextStep ? `${activeCount} / ${nextStep.min} referrals` : `${activeCount} referrals`}
            </span>
            {nextStep && (
              <span className="text-[11.5px] font-medium" style={{ color: t.accent }}>{remaining} to {nextStep.label}</span>
            )}
            {tier === "pro" && (
              <span className="text-[11.5px] font-medium" style={{ color: t.green }}>Max tier</span>
            )}
          </div>

          <div className="relative" style={{ height: 28 }}>
            <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)" }}>
              <div className="h-full rounded-lg transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(2, tier === "pro" ? 100 : (activeCount / steps[steps.length - 1].min) * 100)}%`, background: t.grad }} />
            </div>

            {steps.slice(1).map((s) => {
              const pos = (s.min / steps[steps.length - 1].min) * 100;
              const reached = activeCount >= s.min;
              return (
                <div key={s.key} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
                  <div className="w-[3px] h-full rounded-full" style={{ background: reached ? "rgba(255,255,255,.4)" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)") }} />
                </div>
              );
            })}
          </div>

          <div className="flex mt-2">
            {steps.map((s, i) => {
              const reached = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={s.key} className="flex-1" style={{ textAlign: i === 0 ? "left" : i === steps.length - 1 ? "right" : "center" }}>
                  <span className="text-[10.5px] font-semibold" style={{ color: isCurrent ? t.accent : reached ? t.soft : t.muted }}>
                    {s.label} · {s.rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {linkCount > 0 && <LinkSelector links={links} dark={dark} t={t} />}
      </div>
    </div>
  );
}

// ── LinkSelector ──
function LinkSelector({ links, dark, t }) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const slug = links[selected]?.slug;
  const url = `https://nitro.ng/?via=${slug}`;
  const multi = links.length > 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl overflow-visible" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)"}` }}>
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: t.grad }} />
      <div className="pl-4 pr-3 py-3 flex flex-col gap-2.5">
        {multi && (
          <div className="flex gap-1">
            {links.map((l, i) => (
              <button key={l.slug} onClick={() => { setSelected(i); setCopied(false); }}
                className="py-[4px] px-[10px] rounded-md text-[10.5px] font-semibold border-none cursor-pointer transition-all duration-150"
                style={{ background: i === selected ? t.grad : "transparent", color: i === selected ? "#fff" : t.muted, fontFamily: "inherit" }}
              >{l.name}{!l.enabled && " ·off"}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" className="shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span className="m text-[13px] flex-1 truncate">
            <span style={{ color: t.soft }}>nitro.ng/</span>
            <span style={{ color: t.accent, fontWeight: 700 }}>?via={slug}</span>
          </span>
          <button onClick={handleCopy} className="flex items-center gap-1.5 py-[6px] px-3 rounded-lg text-[11px] font-semibold border-none cursor-pointer shrink-0 transition-all duration-150" style={{ background: copied ? t.green : t.grad, color: "#fff", fontFamily: "inherit" }}>
            {copied
              ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
              : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EmptyState ──
export function EmptyState({ icon, title, subtitle, action, t }) {
  return (
    <div className="flex flex-col items-center text-center gap-[9px] py-[38px] px-5">
      <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center" style={{ background: t.accentLight, color: t.accent }}>
        {icon || <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>}
      </div>
      <h4 className="text-[15px] font-semibold" style={{ color: t.text }}>{title}</h4>
      {subtitle && <p className="text-[12.5px] max-w-[280px]" style={{ color: t.muted }}>{subtitle}</p>}
      {action}
    </div>
  );
}

// ── ErrorBanner ──
export function ErrorBanner({ message, onRetry, t }) {
  return (
    <div className="flex items-center gap-[10px] py-3 px-[14px] rounded-xl text-[13px]" style={{ color: t.red, background: `${t.red}12`, border: `1px solid ${t.red}` }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="bg-transparent border-none font-semibold cursor-pointer" style={{ color: t.red }}>Retry</button>}
    </div>
  );
}

// ── Skeleton ──
export function Skeleton({ w, h = 14, dark, className = "" }) {
  const a = dark === false ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.07)";
  const b = dark === false ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.12)";
  return <div className={`rounded-md ${className}`} style={{ width: w || "100%", height: h, background: `linear-gradient(90deg, ${a} 25%, ${b} 37%, ${a} 63%)`, backgroundSize: "400% 100%", animation: "skel-shimmer 1.8s ease infinite" }} />;
}

// ── HoldTooltip ──
export function HoldTooltip({ dark }) {
  return (
    <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[10px] italic font-bold cursor-help relative group" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", color: dark ? "#8a8580" : "#757170" }} title="Earnings are held for 7 days to cover refunds. After that they're approved and payable.">
      i
    </span>
  );
}
