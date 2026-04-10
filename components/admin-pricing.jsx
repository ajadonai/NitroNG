'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

const DEFAULT_BRACKETS = [
  { min: 0, max: 20, multiplier: 3, label: "Micro" },
  { min: 20, max: 200, multiplier: 2.5, label: "Low" },
  { min: 200, max: 1000, multiplier: 2, label: "Mid" },
  { min: 1000, max: 5000, multiplier: 1.7, label: "High" },
  { min: 5000, max: 20000, multiplier: 1.5, label: "Premium" },
  { min: 20000, max: Infinity, multiplier: 1.35, label: "Ultra" },
];

function calcSell(cost, brackets, floorPct, floorCeiling) {
  const b = brackets.find(b => cost >= b.min && cost < (b.max === Infinity ? 999999999 : b.max)) || brackets[brackets.length - 1];
  let sell = Math.round(cost * b.multiplier);
  if (cost < floorCeiling) { const min = Math.round(cost / (1 - floorPct / 100)); if (sell < min) sell = min; }
  return sell;
}

export default function AdminPricingPage({ dark, t }) {
  const confirm = useConfirm();
  const [brackets, setBrackets] = useState(DEFAULT_BRACKETS);
  const [floorPct, setFloorPct] = useState(50);
  const [floorCeiling, setFloorCeiling] = useState(5000);
  const [ngBonus, setNgBonus] = useState(25);
  const [usdRate, setUsdRate] = useState(1600);
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [simCost, setSimCost] = useState(500);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (!d.settings) return;
      const s = d.settings;
      try { if (s.markup_brackets) setBrackets(JSON.parse(s.markup_brackets)); } catch {}
      if (s.markup_margin_floor) setFloorPct(Number(s.markup_margin_floor));
      if (s.markup_floor_ceiling) setFloorCeiling(Number(s.markup_floor_ceiling));
      if (s.markup_ng_bonus) setNgBonus(Number(s.markup_ng_bonus));
      if (s.markup_usd_rate) setUsdRate(Number(s.markup_usd_rate));
    });
  }, []);

  const allSettings = () => ({
    markup_brackets: JSON.stringify(brackets),
    markup_margin_floor: String(floorPct),
    markup_floor_ceiling: String(floorCeiling),
    markup_ng_bonus: String(ngBonus),
    markup_usd_rate: String(usdRate),
  });

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: allSettings() }) });
      setMsg(r.ok ? { ok: true, text: "Pricing settings saved" } : { ok: false, text: "Failed to save" });
    } catch { setMsg({ ok: false, text: "Request failed" }); }
    setSaving(false);
  };

  const recalc = async () => {
    if (!await confirm({ title: "Recalculate All Prices", message: "This overwrites ALL existing tier sell prices with the bracket formula. Any custom prices you've manually set will be replaced.", confirmLabel: "Recalculate All", danger: true })) return;
    setRecalcing(true); setMsg(null);
    try {
      await save();
      const r = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate-prices" }) });
      const d = await r.json();
      setMsg(r.ok ? { ok: true, text: `${d.updated || 0} prices recalculated` } : { ok: false, text: d.error || "Failed" });
    } catch { setMsg({ ok: false, text: "Request failed" }); }
    setRecalcing(false);
  };

  const reset = () => { setBrackets(DEFAULT_BRACKETS); setFloorPct(50); setFloorCeiling(5000); setNgBonus(25); setUsdRate(1600); setMsg({ ok: true, text: "Reset to defaults — not saved yet" }); };

  const simSell = calcSell(simCost, brackets, floorPct, floorCeiling);
  const simNG = Math.round(simSell * (1 + ngBonus / 100));
  const simProfit = simSell - simCost;
  const simMargin = simSell > 0 ? Math.round((simProfit / simSell) * 100) : 0;
  const simBracket = brackets.find(b => simCost >= b.min && simCost < (b.max === Infinity ? 999999999 : b.max));

  const cardBg = dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`;
  const divBg = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const inpS = { padding: "8px 10px", borderRadius: 8, background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 14, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", outline: "none" };
  const bracketColors = ["#34d399", "#6ee7b7", "#60a5fa", "#a78bfa", "#e0a458", "#c47d8e"];

  const Tip = ({ title, children, green }) => (
    <div style={{ padding: "12px 16px", borderRadius: 10, background: green ? (dark ? "rgba(74,222,128,.06)" : "rgba(22,163,74,.04)") : (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)"), borderLeft: `3px solid ${green ? (dark ? "#4ade80" : "#16a34a") : "#c47d8e"}`, fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
      {title && <div style={{ fontWeight: 600, color: green ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#e5c1ca" : "#8b5e6b"), marginBottom: 4 }}>{title}</div>}
      {children}
    </div>
  );

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pricing Engine</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Bracket-based pricing — cheaper services get higher markups, expensive services stay competitive</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.ok ? "✓" : "⚠️"} {msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button></div>}

      {/* ═══ PRICE BRACKETS ═══ */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd, marginBottom: 20 }}>
        <div className="adm-card-header">
          <span className="adm-card-title" style={{ color: t.textMuted }}>Price brackets</span>
        </div>
        <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
        <div style={{ padding: 16 }}>
          <Tip title="How brackets work">
            Each service falls into a bracket based on its MTP cost. The bracket's multiplier sets the sell price: Cost × Multiplier = Sell Price. Cheap services (views, basic likes) get higher markups because customers don't notice ₦5 vs ₦15. Expensive services (premium comments, reviews) get lower markups to stay competitive.
          </Tip>
          <div style={{ marginTop: 16 }}>
            {brackets.map((b, i) => {
              const exCost = b.min === 0 ? 10 : b.min;
              const exSell = Math.round(exCost * b.multiplier);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < brackets.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none", flexWrap: "wrap" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: bracketColors[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: t.text, minWidth: 160 }}>₦{b.min.toLocaleString()} – {b.max === Infinity ? "∞" : `₦${b.max.toLocaleString()}`}</span>
                  <span style={{ fontSize: 12, color: t.textMuted, minWidth: 40 }}>{b.label}</span>
                  <input value={b.multiplier} type="number" step="0.05" min="1" max="10" onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 1) { const n = [...brackets]; n[i] = { ...b, multiplier: v }; setBrackets(n); } }} style={{ ...inpS, width: 60 }} />
                  <span style={{ fontSize: 13, color: t.textMuted }}>×</span>
                  <span style={{ fontSize: 12, color: t.textSoft, fontFamily: "'JetBrains Mono',monospace", marginLeft: "auto" }}>₦{exCost} → ₦{exSell}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ MARGIN FLOOR ═══ */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd, marginBottom: 20 }}>
        <div className="adm-card-header">
          <span className="adm-card-title" style={{ color: t.textMuted }}>Margin floor</span>
        </div>
        <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
        <div style={{ padding: 16 }}>
          <Tip title="What is this?">
            Safety net for cheap services. If a bracket produces a margin below {floorPct}%, the price is raised automatically. Only applies to services under ₦{floorCeiling.toLocaleString()} cost — expensive services use the bracket alone so they stay competitive.
          </Tip>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text, minWidth: 150 }}>Minimum margin</span>
              <input value={floorPct} onChange={e => setFloorPct(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} type="number" style={{ ...inpS, width: 60 }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>%</span>
              <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>You keep at least {floorPct}¢ of every ₦1</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text, minWidth: 150 }}>Applies under</span>
              <span style={{ fontSize: 13, color: t.textMuted }}>₦</span>
              <input value={floorCeiling} onChange={e => setFloorCeiling(Math.max(0, Number(e.target.value) || 0))} type="number" style={{ ...inpS, width: 80 }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>per 1K</span>
              <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>Above this → bracket only</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ NG BONUS + RATE ═══ */}
      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        {/* Nigerian bonus */}
        <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
          <div className="adm-card-header">
            <span className="adm-card-title" style={{ color: t.textMuted }}>🇳🇬 Nigerian bonus</span>
          </div>
          <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
          <div style={{ padding: 16 }}>
            <Tip green title="Why charge more?">Nigerian-sourced engagement is premium — local followers look authentic and perform better with location-based algorithms.</Tip>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text }}>Bonus</span>
              <input value={ngBonus} onChange={e => setNgBonus(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} type="number" style={{ ...inpS, width: 60 }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>%</span>
              <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>On top of bracket price</span>
            </div>
          </div>
        </div>

        {/* Exchange rate */}
        <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
          <div className="adm-card-header">
            <span className="adm-card-title" style={{ color: t.textMuted }}>Exchange rate</span>
          </div>
          <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
          <div style={{ padding: 16 }}>
            <Tip title="Currency conversion">MTP costs are in USD. This rate converts to Naira before brackets are applied.</Tip>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text }}>$1 USD</span>
              <span style={{ fontSize: 14, color: t.textMuted }}>=</span>
              <span style={{ fontSize: 13, color: t.textMuted }}>₦</span>
              <input value={usdRate} onChange={e => setUsdRate(Math.max(1, Number(e.target.value) || 0))} type="number" style={{ ...inpS, width: 80 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SIMULATOR ═══ */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd, marginBottom: 20 }}>
        <div className="adm-card-header">
          <span className="adm-card-title" style={{ color: t.textMuted }}>Price simulator</span>
        </div>
        <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: t.text }}>MTP cost per 1K:</span>
            <span style={{ fontSize: 14, color: t.textMuted }}>₦</span>
            <input value={simCost} onChange={e => setSimCost(Math.max(0, Number(e.target.value) || 0))} type="number" style={{ ...inpS, width: 90 }} />
          </div>

          <div className="adm-stats" style={{ marginTop: 0, marginBottom: 16 }}>
            {[
              ["Sell Price", `₦${simSell.toLocaleString()}`, t.accent],
              ["Profit", `₦${simProfit.toLocaleString()}`, dark ? "#6ee7b7" : "#059669"],
              ["Margin", `${simMargin}%`, simMargin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626")],
              ["🇳🇬 Price", `₦${simNG.toLocaleString()}`, dark ? "#4ade80" : "#16a34a"],
            ].map(([label, val, color]) => (
              <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", border: `0.5px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                <div className="dash-stat-label" style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>{label}</div>
                <div className="dash-stat-value" style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, padding: "10px 14px", borderRadius: 8, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.015)" }}>
            <strong style={{ color: t.text }}>Breakdown:</strong>{" "}
            ₦{simCost.toLocaleString()} → <strong>{simBracket?.label}</strong> bracket ({simBracket?.multiplier}×) → ₦{Math.round(simCost * (simBracket?.multiplier || 1)).toLocaleString()}.
            {simCost < floorCeiling && simMargin >= floorPct && ` Floor: ${simMargin}% ≥ ${floorPct}% — OK.`}
            {simCost < floorCeiling && simMargin < floorPct && ` Floor: below ${floorPct}%, raised to ₦${simSell.toLocaleString()}.`}
            {simCost >= floorCeiling && ` Above ₦${floorCeiling.toLocaleString()} — floor skipped.`}
            {` 🇳🇬 +${ngBonus}% = ₦${simNG.toLocaleString()}.`}
          </div>
        </div>
      </div>

      {/* ═══ QUICK REFERENCE ═══ */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd, marginBottom: 20 }}>
        <div className="adm-card-header">
          <span className="adm-card-title" style={{ color: t.textMuted }}>Quick reference</span>
        </div>
        <div className="adm-card-divider" style={{ background: divBg, margin: "12px 0 0" }} />
        <div style={{ padding: "12px 16px" }}>
          {[["Basic Views", 2], ["Budget Likes", 50], ["Std Followers", 800], ["Prm Followers", 3000], ["Custom Comments", 12000], ["Premium Reviews", 50000]].map(([name, cost], i, arr) => {
            const sell = calcSell(cost, brackets, floorPct, floorCeiling);
            const margin = Math.round(((sell - cost) / sell) * 100);
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: t.text, flex: 1, minWidth: 120 }}>{name}</span>
                <span style={{ fontSize: 12, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", width: 70, textAlign: "right" }}>₦{cost.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>→</span>
                <span style={{ fontSize: 12, color: t.accent, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, width: 70, textAlign: "right" }}>₦{sell.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: margin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, fontFamily: "'JetBrains Mono',monospace", width: 40, textAlign: "right" }}>{margin}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <button onClick={save} disabled={saving} className="adm-btn-primary" style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Settings"}</button>
        <button onClick={recalc} disabled={recalcing} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626", fontSize: 14, fontWeight: 600, cursor: recalcing ? "wait" : "pointer", opacity: recalcing ? .5 : 1 }}>{recalcing ? "Recalculating..." : "Recalculate All Prices"}</button>
        <button onClick={reset} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: "transparent", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Reset Defaults</button>
      </div>
      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}><strong>Save</strong> stores settings. <strong>Recalculate</strong> overwrites all tier prices — custom prices are replaced. <strong>Reset</strong> restores defaults without saving.</div>
    </div>
  );
}
