"use client";
// The Pit's shared frame: the CSS variables every page sets on its root, the one
// stylesheet the shell prints, and the primitives (facts row, card, rows, chips,
// buttons, modal) the six pages are built from.
import { useEffect } from "react";

// ── CSS variables ──
// Solid card colour, never a translucent token, so nothing shows through a card.
export function pitVars(dark, t) {
  return {
    "--card": dark ? "#171126" : "#ffffff",
    "--ink": t.text,
    "--mut": t.muted,
    "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.surfaceBrd,
    "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent,
    "--ok": dark ? "#6ee7b7" : "#0a7d54",
    "--warn": dark ? "#fcd34d" : "#b45309",
    "--bad": dark ? "#fca5a5" : "#c62828",
    "--in": dark ? "#160f22" : "#ffffff",
  };
}

// ── helpers ──
export function initialsOf(name) {
  return (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function ago(iso) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function dateOf(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function longDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── facts row ──
export function Facts({ children }) {
  return <div className="pt-stats">{children}</div>;
}

export function Fact({ value, label, sub, kind, mono = true }) {
  return (
    <div className={"pt-stt" + (kind ? " " + kind : "")}>
      <b className={mono ? "m" : undefined}>{value}</b>
      <span>{label}</span>
      <i>{sub}</i>
    </div>
  );
}

// ── card ──
export function Card({ title, cnt, act, children, className }) {
  return (
    <section className={"pt-card" + (className ? " " + className : "")}>
      <header><h3>{title}</h3>{cnt ? <span className="pt-cnt">{cnt}</span> : null}{act}</header>
      {children}
    </section>
  );
}

export function Chip({ kind, children }) {
  return <span className={"pt-ty" + (kind ? " " + kind : "")}>{children}</span>;
}

export function Empty({ children }) {
  return <div className="pt-empty">{children}</div>;
}

// ── modal ──
// The rule: fixed backdrop that closes on click, page behind locked and inert,
// Escape closes, the surface is solid, and it is a bottom sheet on phones.
export function Modal({ open, onClose, title, sub, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="pt-bd" onClick={onClose}>
      <div className={"pt-md" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="pt-mdh">
          <div className="pt-mdt"><b>{title}</b>{sub ? <i>{sub}</i> : null}</div>
          <button type="button" className="pt-b sm" onClick={onClose}>Close</button>
        </div>
        <div className="pt-mdb">{children}</div>
        {footer ? <div className="pt-mdf">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder, hint, autoFocus }) {
  return (
    <>
      <label className="pt-lbl">{label}</label>
      <input className="pt-in" type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} />
      {hint ? <div className="pt-hint">{hint}</div> : null}
    </>
  );
}

// ── tier ──
// Same steps, same thresholds, same "how many more" arithmetic as before.
const DEFAULT_TIER_CONFIG = { starter: { rate: 30, min: 0 }, growth: { rate: 40, min: 30 }, pro: { rate: 50, min: 100 }, leadSplit: 40 };

export function TierProgress({ tier, activeCount, tierConfig }) {
  const cfg = tierConfig || DEFAULT_TIER_CONFIG;
  const steps = [
    { key: "starter", label: "Starter", rate: cfg.starter?.rate || 30, min: 0 },
    { key: "growth", label: "Growth", rate: cfg.growth?.rate || 40, min: cfg.growth?.min || 30 },
    { key: "pro", label: "Pro", rate: cfg.pro?.rate || 50, min: cfg.pro?.min || 100 },
  ];
  const currentIdx = Math.max(0, steps.findIndex(s => s.key === tier));
  const nextStep = steps[currentIdx + 1] || null;
  const remaining = nextStep ? Math.max(0, nextStep.min - activeCount) : 0;
  const top = steps[steps.length - 1].min || 1;
  const pct = Math.min(100, Math.max(2, nextStep ? (activeCount / top) * 100 : 100));
  return (
    <section className="pt-card">
      <header><h3>Your tier</h3><span className="pt-cnt">your rate goes up with paid referrals</span></header>
      <div className="pt-steps">
        {steps.map((s, i) => (
          <span key={s.key} className={"pt-ts" + (i < currentIdx ? " done" : i === currentIdx ? " on" : "")}>
            <em>{s.label}</em>
            <b className="m">{s.rate}%</b>
            <i>{s.min === 0 ? "from your first" : `from ${s.min} paid`}</i>
          </span>
        ))}
      </div>
      <div className="pt-tbar"><i style={{ width: `${pct}%` }} /></div>
      <div className="pt-tnote">
        <span>{nextStep ? `${remaining} more paid ${remaining === 1 ? "referral" : "referrals"} to ${nextStep.label}.` : "You are on the top tier."}</span>
        <span className="m">{activeCount} paid so far</span>
      </div>
    </section>
  );
}

// ── the one stylesheet ──
export const PIT_CSS = `
.pt{color:var(--ink);min-height:100vh}
.pt *{box-sizing:border-box}
.pt .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pt-wrap{display:grid;grid-template-columns:230px 1fr;min-height:100vh}

.pt-rail{border-right:1px solid var(--line);padding:18px 14px;display:flex;flex-direction:column;gap:2px;background:var(--soft);position:sticky;top:0;height:100vh;overflow-y:auto}
.pt-bhead{display:flex;align-items:flex-start;gap:8px;margin-bottom:14px}
.pt-bhead .pt-brand{flex:1;min-width:0}
.pt-brand{font-size:13px;font-weight:800;letter-spacing:2.5px;color:var(--ac);display:flex;flex-direction:column}
.pt-brand em{font-style:normal;font-size:11px;letter-spacing:.4px;font-weight:600;color:var(--mut);margin-top:2px}
.pt-sec{display:flex;align-items:center;gap:8px;padding:10px 8px 4px}
.pt-sec span{font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--mut)}
.pt-sec::after{content:"";flex:1;height:1px;background:var(--line);opacity:.7}
.pt-it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:500;color:var(--mut);background:none;border:0;width:100%;text-align:left;cursor:pointer;text-decoration:none}
.pt-it i{width:16px;height:16px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}
.pt-it i svg{width:100%;height:100%;stroke:currentColor}
.pt-it:hover{color:var(--ink)}
.pt-it.on{background:var(--card);color:var(--ink);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.pt-it.on i{color:var(--ac)}
.pt-foot{margin-top:auto;display:flex;align-items:center;gap:10px;padding:10px 8px;border-top:1px solid var(--line)}
.pt-foot .pt-tt{flex:1}
.pt-av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;text-decoration:none}
.pt-av.sm{width:30px;height:30px;font-size:10.5px}
.pt-icb{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0}
.pt-icb svg{width:15px;height:15px;stroke:currentColor}
.pt-icb:hover{color:var(--ink)}

.pt-main{padding:22px;display:flex;flex-direction:column;gap:14px;min-width:0}
.pt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.pt-at{font-size:22px;font-weight:700}
.pt-as{font-size:13px;color:var(--mut);margin-top:3px}
.pt-top{display:none}
.pt-tops{display:flex;align-items:center;gap:10px}
.pt-dock{display:none}

.pt-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:transform .15s;text-decoration:none}
.pt-b:hover{transform:translateY(-1px)}
.pt-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.pt-b.sm{height:30px;padding:0 10px;font-size:12px}
.pt-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.pt-b.bad{color:var(--bad)}
.pt-b.full{width:100%}
.pt-lnk{font:inherit;font-size:12px;font-weight:600;color:var(--ac);background:none;border:0;padding:0;cursor:pointer;text-decoration:none;white-space:nowrap}

.pt-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pt-card>header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.pt-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}
.pt-cnt{font-size:11.5px;color:var(--dim);min-width:0;overflow:hidden;text-overflow:ellipsis}
.pt-card>header .pt-lnk,.pt-card>header .pt-b{margin-left:auto}
.pt-cb{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px}
.pt-frow{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--rail)}
.pt-frow:first-child{border-top:0}
.pt-frow>.pt-tt{flex:1}
.pt-frow .pt-b{margin-left:auto}
.pt-note{font-size:12.5px;color:var(--mut);line-height:1.5}
.pt-err{font-size:12.5px;color:var(--bad);line-height:1.5}
.pt-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}

.pt-list{display:flex;flex-direction:column}
.pt-r{display:grid;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px;min-width:0}
.pt-r:first-child{border-top:0}
.pt-lh{display:grid;gap:12px;padding:0 16px;height:32px;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line)}
.pt-lh .r{text-align:right}
.pt-tt{display:flex;flex-direction:column;min-width:0}
.pt-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-tt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-cp{font:inherit;font-size:11.5px;color:var(--mut);background:none;border:0;padding:0;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-cp:hover{color:var(--ac)}
.pt-num{text-align:right;font-weight:700;white-space:nowrap}
.pt-num.ok{color:var(--ok)}
.pt-num.bad{color:var(--bad)}
.pt-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mut);text-align:center;white-space:nowrap;justify-self:start}
.pt-ty.ok{color:var(--ok);border-color:var(--ok)}
.pt-ty.warn{color:var(--warn);border-color:var(--warn)}
.pt-ty.bad{color:var(--bad);border-color:var(--bad)}
.pt-ty.dim{color:var(--dim)}
.pt-acts{display:flex;gap:6px;justify-content:flex-end}
.pt-c{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.pt-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.pt-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}
.pt-stt:first-child{border-left:0}
.pt-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-stt b:not(.m){font-size:15px;font-weight:700}
.pt-stt.ok b{color:var(--ok)}
.pt-stt.warn b{color:var(--warn)}

.pt-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 16px 8px}
.pt-ts{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;border:1px solid var(--line)}
.pt-ts em{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)}
.pt-ts b{font-size:19px;font-weight:800}
.pt-ts i{font-style:normal;font-size:11.5px;color:var(--dim)}
.pt-ts.done{opacity:.6}
.pt-ts.on{border-color:var(--ac)}
.pt-ts.on b{color:var(--ac)}
.pt-tbar{height:6px;border-radius:3px;background:var(--rail);margin:6px 16px 0;overflow:hidden}
.pt-tbar i{display:block;height:100%;background:var(--ac);border-radius:3px}
.pt-tnote{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--mut);padding:8px 16px 14px}

.pt-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pt-srch{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);color:var(--dim);font-size:13px;flex:1;min-width:240px}
.pt-srch svg{width:15px;height:15px;stroke:currentColor;flex-shrink:0}
.pt-srch input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:13px;color:var(--ink)}
.pt-sel{display:inline-flex;align-items:center;height:36px;padding:0 10px;border-radius:10px;background:var(--card);border:1px solid var(--line);font:inherit;font-size:13px;font-weight:600;color:var(--mut);cursor:pointer;outline:none}
.pt-tg{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;background:var(--card);border:1px solid var(--line);font:inherit;font-size:13px;font-weight:600;color:var(--mut);cursor:pointer}
.pt-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.pt-bar .pt-cnt{margin-left:auto;white-space:nowrap}

.pt-pg{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}
.pt-pgn{display:inline-flex;gap:6px;align-items:center}
.pt-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:14px;cursor:pointer}
.pt-ib:disabled{opacity:.4;cursor:not-allowed}

.pt-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:12px 0 6px}
.pt-mdb>.pt-lbl:first-child{margin-top:0}
.pt-in{width:100%;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none}
.pt-in:focus{border-color:var(--ac)}
.pt-hint{font-size:11.5px;color:var(--dim);margin-top:6px}
.pt-hint.ok{color:var(--ok)}
.pt-hint.bad{color:var(--bad)}

.pt-bd{position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.pt-md{width:440px;max-width:100%;max-height:92vh;overflow-y:auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);color:var(--ink)}
.pt-md.wide{width:520px}
.pt-mdh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
.pt-mdt{display:flex;flex-direction:column;min-width:0}
.pt-mdt b{font-size:16px;font-weight:700}
.pt-mdt i{font-style:normal;font-size:12.5px;color:var(--mut);margin-top:2px}
.pt-mdb{display:flex;flex-direction:column}
.pt-mdf{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.pt-mdf .pt-err{margin-right:auto;align-self:center}

@media (max-width:900.98px){
  .pt-wrap{grid-template-columns:1fr;min-height:0}
  .pt-rail{display:none}
  .pt-top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:40}
  .pt-dock{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:90;border-top:1px solid var(--line);background:var(--card)}
  .pt-dk{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 0;font:inherit;font-size:10.5px;font-weight:600;color:var(--mut);background:none;border:0;cursor:pointer}
  .pt-dk i{width:18px;height:18px;display:inline-flex}
  .pt-dk i svg{width:100%;height:100%;stroke:currentColor}
  .pt-dk.on{color:var(--ac)}
  .pt-main{padding:14px 14px 76px;gap:12px}
  .pt-head{padding-bottom:10px}
  .pt-at{font-size:19px}
  .pt-stats{grid-template-columns:1fr 1fr}
  .pt-stt:nth-child(3){border-left:0}
  .pt-stt:nth-child(n+3){border-top:1px solid var(--line)}
  .pt-stt b{font-size:17px}
  .pt-steps{grid-template-columns:1fr}
  .pt-tnote{flex-direction:column;gap:2px}
  .pt-lh{display:none}
  .pt-r{grid-template-columns:1fr auto;grid-template-areas:"tt num" "ty cnt" "act act";gap:6px 10px;padding:12px 14px}
  .pt-r .pt-av{display:none}
  .pt-r .pt-tt{grid-area:tt}
  .pt-r .pt-num{grid-area:num}
  .pt-r .pt-ty{grid-area:ty}
  .pt-r .pt-c{grid-area:cnt;justify-self:end}
  .pt-r .pt-acts{grid-area:act;justify-content:stretch;margin-top:4px}
  .pt-r .pt-acts .pt-b{flex:1}
  .pt-srch{min-width:100%}
  .pt-bar .pt-cnt{margin-left:0}
  .pt-bd{align-items:flex-end;padding:0}
  .pt-md{width:100%;max-width:100%;max-height:92vh;border-radius:16px 16px 0 0;border-bottom:0}
}
`;
