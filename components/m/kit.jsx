"use client";

// ── StatCard ──
export function StatCard({ label, value, caption, captionUp, t }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="text-[10.5px] font-semibold tracking-[1px] uppercase" style={{ color: t.muted }}>{label}</div>
      <div className="m text-[27px] font-semibold mt-[7px] tracking-tight" style={{ color: t.text }}>{value}</div>
      {caption && <div className="text-[11.5px] mt-[5px]" style={{ color: captionUp ? t.green : t.soft }}>{caption}</div>}
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

// ── TierBadge + TierProgress ──
const TIER_INFO = { starter: { rate: 5, next: "Growth", nextThreshold: 30 }, growth: { rate: 7, next: "Pro", nextThreshold: 100 }, pro: { rate: 10, next: null, nextThreshold: null } };

export function TierProgress({ tier, activeCount, t }) {
  const info = TIER_INFO[tier] || TIER_INFO.starter;
  const maxMarker = 100;
  const pct = Math.min(100, (activeCount / maxMarker) * 100);
  const starterReached = activeCount >= 0;
  const growthReached = activeCount >= 30;
  const proReached = activeCount >= 100;
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-[13px]" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="flex items-baseline justify-between">
        <div><span className="serif text-2xl font-semibold" style={{ color: t.text }}>{tierName}</span> <span className="m text-xs" style={{ color: t.muted }}>· {info.rate}% pot</span></div>
        {info.next && <span className="text-[12.5px]" style={{ color: t.soft }}><b style={{ color: t.accent }}>{activeCount}</b>/{info.nextThreshold} active to <b style={{ color: t.accent }}>{info.next}</b></span>}
      </div>
      <div>
        <div className="relative h-[9px] rounded-full overflow-visible" style={{ background: t.surfaceBrd }}>
          <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: t.grad }} />
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[13px] h-[13px] rounded-full z-[2]" style={{ left: "0%", background: starterReached ? t.accent : t.bg, border: `2px solid ${starterReached ? t.accent : t.surfaceBorder}` }} />
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[13px] h-[13px] rounded-full z-[2]" style={{ left: "30%", background: growthReached ? t.accent : t.bg, border: `2px solid ${growthReached ? t.accent : t.surfaceBorder}` }} />
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[13px] h-[13px] rounded-full z-[2]" style={{ left: "100%", background: proReached ? t.accent : t.bg, border: `2px solid ${proReached ? t.accent : t.surfaceBorder}` }} />
        </div>
        <div className="relative h-0">
          <span className="absolute top-[10px] -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ left: "0%", color: t.muted }}>Starter · 5%</span>
          <span className="absolute top-[10px] -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ left: "30%", color: t.muted }}>Growth · 7%</span>
          <span className="absolute top-[10px] text-[10px] whitespace-nowrap" style={{ left: "100%", transform: "translateX(-100%)", color: t.muted }}>Pro · 10%</span>
        </div>
      </div>
    </div>
  );
}

// ── LinkPill ──
export function LinkPill({ slug, onCopy, t }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(`https://nitro.ng/?via=${slug}`);
    onCopy?.();
  };
  return (
    <div className="inline-flex items-center gap-2 rounded-[10px] py-[7px] px-[11px] text-[12.5px]" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <span className="m"><span style={{ color: t.text }}>nitro.ng/?</span><span style={{ color: t.accent }}>via={slug}</span></span>
      <button onClick={handleCopy} className="bg-transparent border-none flex cursor-pointer p-[2px]" style={{ color: t.muted }} title="Copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
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
    <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[10px] italic font-bold cursor-help relative group" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", color: dark ? "#8a8580" : "#757170" }} title="Commissions are held for 7 days to cover refunds. After that they're approved and payable.">
      i
    </span>
  );
}
