"use client";
import { useState } from "react";

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

export function TierProgress({ tier, activeCount, tierConfig, dark, t }) {
  const cfg = tierConfig || DEFAULT_TIER_CONFIG;
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const currentRate = cfg[tier]?.rate || cfg.starter.rate;
  const growthMin = cfg.growth?.min || 30;
  const proMin = cfg.pro?.min || 100;
  const growthReached = activeCount >= growthMin;
  const proReached = activeCount >= proMin;
  const maxMarker = proMin;
  const pct = Math.min(100, (activeCount / maxMarker) * 100);

  const nextTier = tier === "starter" ? "growth" : tier === "growth" ? "pro" : null;
  const nextMin = nextTier ? cfg[nextTier]?.min : null;
  const nextRate = nextTier ? cfg[nextTier]?.rate : null;

  const tiers = [
    { key: "starter", label: "Starter", rate: cfg.starter?.rate || 30, pos: 0, reached: true },
    { key: "growth", label: "Growth", rate: cfg.growth?.rate || 40, pos: (growthMin / maxMarker) * 100, reached: growthReached },
    { key: "pro", label: "Pro", rate: cfg.pro?.rate || 50, pos: 100, reached: proReached },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      {/* Current tier banner */}
      <div className="py-5 px-5 flex items-center gap-4" style={{ background: t.grad }}>
        <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.2)" }}>
          {TIER_ICONS[tier] || TIER_ICONS.starter}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="serif text-[22px] font-semibold text-white italic">{tierName}</span>
            <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wide">Tier</span>
          </div>
          <div className="text-[13px] text-white/80 mt-0.5">
            You earn <b className="m text-white">{currentRate}%</b> of profit on every sale
          </div>
        </div>
      </div>

      <div className="py-5 px-5 flex flex-col gap-4">
        {/* Progress bar */}
        <div>
          {nextTier && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: t.muted }}>Progress to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}</span>
              <span className="m text-[12px] font-semibold" style={{ color: t.accent }}>{activeCount}/{nextMin}</span>
            </div>
          )}
          <div className="relative h-2 rounded-full" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)" }}>
            <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: t.grad }} />
            {tiers.map(({ key, pos, reached }) => (
              <span key={key} className="absolute top-1/2 w-3 h-3 rounded-full z-[2] border-[2.5px]" style={{ left: `${pos}%`, transform: "translate(-50%, -50%)", background: reached ? t.accent : (dark ? "#1a1e2e" : "#fff"), borderColor: reached ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)") }} />
            ))}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-3 gap-2">
          {tiers.map(({ key, label, rate, reached }) => {
            const isCurrent = key === tier;
            return (
              <div key={key} className="rounded-xl py-3 px-2.5 text-center transition-all duration-200" style={{
                background: isCurrent ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent",
                border: `1px solid ${isCurrent ? t.accent + "40" : t.surfaceBrd}`,
              }}>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: reached ? t.accent : t.muted }}>{label}</div>
                <div className="m text-[18px] font-bold" style={{ color: reached ? t.text : t.muted }}>{rate}%</div>
                <div className="text-[10px] mt-0.5" style={{ color: t.muted }}>of profit</div>
              </div>
            );
          })}
        </div>

        {/* Next tier callout */}
        {nextTier && nextMin && (
          <div className="flex items-center gap-2.5 rounded-xl py-2.5 px-3.5" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span className="text-[12px]" style={{ color: t.soft }}>
              <b className="m" style={{ color: t.accent }}>{Math.max(0, nextMin - activeCount)}</b> more active referrals to unlock <b style={{ color: t.text }}>{nextRate}%</b> profit split
            </span>
          </div>
        )}
        {tier === "pro" && (
          <div className="flex items-center gap-2.5 rounded-xl py-2.5 px-3.5" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" className="shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span className="text-[12px]" style={{ color: t.soft }}>Max tier reached — you&apos;re a <b style={{ color: t.green }}>50/50 partner</b> with Nitro</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LinkPill ──
export function LinkPill({ slug, dark, t }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`https://nitro.ng/?via=${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-3 rounded-xl py-3 px-4" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" className="shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <span className="m text-[13px] flex-1 truncate"><span style={{ color: t.soft }}>nitro.ng/?</span><span style={{ color: t.accent, fontWeight: 600 }}>via={slug}</span></span>
      <button onClick={handleCopy} className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] font-semibold border-none cursor-pointer shrink-0 transition-all duration-150" style={{ background: copied ? t.green : t.grad, color: "#fff" }}>
        {copied
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        }
        {copied ? "Copied" : "Copy"}
      </button>
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
export function Skeleton({ w, h = 14, className = "" }) {
  return <div className={`rounded-md ${className}`} style={{ width: w || "100%", height: h, background: "linear-gradient(90deg, var(--skel-a) 25%, var(--skel-b) 37%, var(--skel-a) 63%)", backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite", "--skel-a": "rgba(255,255,255,.07)", "--skel-b": "rgba(255,255,255,.12)" }} />;
}

// ── HoldTooltip ──
export function HoldTooltip({ dark }) {
  return (
    <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[10px] italic font-bold cursor-help relative group" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", color: dark ? "#8a8580" : "#757170" }} title="Earnings are held for 7 days to cover refunds. After that they're approved and payable.">
      i
    </span>
  );
}
