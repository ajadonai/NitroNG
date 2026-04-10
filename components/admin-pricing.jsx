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

const DEFAULT_SETTINGS = {
  markup_brackets: JSON.stringify(DEFAULT_BRACKETS),
  markup_margin_floor: "50",
  markup_floor_ceiling: "5000",
  markup_ng_bonus: "25",
  markup_usd_rate: "1600",
};

function calcSellPrice(costPer1k, brackets, floorPct, floorCeiling) {
  const bracket = brackets.find(b => costPer1k >= b.min && costPer1k < (b.max === Infinity ? 999999999 : b.max)) || brackets[brackets.length - 1];
  let sell = Math.round(costPer1k * bracket.multiplier);
  if (costPer1k < floorCeiling) {
    const minSell = Math.round(costPer1k / (1 - floorPct / 100));
    if (sell < minSell) sell = minSell;
  }
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
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [simCost, setSimCost] = useState(500);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        const s = d.settings;
        try { if (s.markup_brackets) setBrackets(JSON.parse(s.markup_brackets)); } catch {}
        if (s.markup_margin_floor) setFloorPct(Number(s.markup_margin_floor));
        if (s.markup_floor_ceiling) setFloorCeiling(Number(s.markup_floor_ceiling));
        if (s.markup_ng_bonus) setNgBonus(Number(s.markup_ng_bonus));
        if (s.markup_usd_rate) setUsdRate(Number(s.markup_usd_rate));
      }
    });
  }, []);

  const saveSettings = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: {
          markup_brackets: JSON.stringify(brackets),
          markup_margin_floor: String(floorPct),
          markup_floor_ceiling: String(floorCeiling),
          markup_ng_bonus: String(ngBonus),
          markup_usd_rate: String(usdRate),
        }})
      });
      setMsg(res.ok ? { ok: true, text: "Pricing settings saved" } : { ok: false, text: "Failed to save" });
    } catch { setMsg({ ok: false, text: "Request failed" }); }
    setSaving(false);
  };

  const recalculate = async () => {
    if (!await confirm({ title: "Recalculate All Prices", message: "This will overwrite ALL existing tier sell prices using the current bracket formula. Any custom prices you've manually set will be replaced. Are you sure?", confirmLabel: "Recalculate All", danger: true })) return;
    setRecalculating(true); setMsg(null);
    try {
      await saveSettings();
      const res = await fetch("/api/admin/service-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate-prices" })
      });
      const data = await res.json();
      setMsg(res.ok
        ? { ok: true, text: `Done! ${data.updated || 0} prices recalculated.` }
        : { ok: false, text: data.error || "Recalculation failed" });
    } catch { setMsg({ ok: false, text: "Request failed" }); }
    setRecalculating(false);
  };

  const resetDefaults = () => {
    setBrackets(DEFAULT_BRACKETS);
    setFloorPct(50);
    setFloorCeiling(5000);
    setNgBonus(25);
    setUsdRate(1600);
    setMsg({ ok: true, text: "Reset to defaults (not saved yet)" });
  };

  const simSell = calcSellPrice(simCost, brackets, floorPct, floorCeiling);
  const simSellNG = Math.round(simSell * (1 + ngBonus / 100));
  const simProfit = simSell - simCost;
  const simMargin = simSell > 0 ? Math.round((simProfit / simSell) * 100) : 0;
  const simBracket = brackets.find(b => simCost >= b.min && simCost < (b.max === Infinity ? 999999999 : b.max));

  const cardStyle = {
    background: dark ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.85)",
    border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
    padding: 20, borderRadius: 14,
    boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)",
  };
  const tipStyle = {
    padding: "12px 16px", borderRadius: 10, marginBottom: 16,
    background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)",
    borderLeft: "3px solid #c47d8e",
    fontSize: 13, color: t.textMuted, lineHeight: 1.6,
  };
  const inputStyle = {
    padding: "7px 10px", borderRadius: 8,
    background: dark ? "#0d1020" : "#fff",
    border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`,
    color: t.text, fontSize: 14, textAlign: "right",
    fontFamily: "'JetBrains Mono',monospace",
  };

  return (
    <div style={{ padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: t.text, margin: "0 0 4px" }}>Pricing Engine</h2>
      <p style={{ fontSize: 14, color: t.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>
        Control how sell prices are calculated from MTP costs. Uses a bracket system — cheaper services get higher markups, expensive services get lower markups.
      </p>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.ok ? (dark ? "rgba(110,231,183,.08)" : "#f0fdf4") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), fontSize: 13 }}>{msg.text}</div>}

      <div style={tipStyle}>
        <div style={{ fontWeight: 600, color: dark ? "#e5c1ca" : "#8b5e6b", marginBottom: 4 }}>How pricing works</div>
        When a service costs ₦X from MTP, the bracket tells us the multiplier. Cost × multiplier = sell price. Cheap services (views, basic likes) get 2-3× markup because customers don't notice small price differences. Expensive services (premium comments, reviews) get 1.35-1.5× because customers are price-sensitive at higher amounts.
      </div>

      {/* Brackets */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Price Brackets</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Each bracket defines a cost range and its markup multiplier. Services are automatically assigned based on their MTP cost.</div>
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 8, marginBottom: 10, fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8 }}>
            <span>Cost Range (per 1K)</span>
            <span style={{ textAlign: "right" }}>Multiplier</span>
            <span style={{ textAlign: "right" }}>Example</span>
          </div>
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", marginBottom: 10 }} />
          {brackets.map((b, i) => {
            const exCost = b.min === 0 ? 10 : b.min;
            const exSell = Math.round(exCost * b.multiplier);
            const colors = ["#34d399", "#6ee7b7", "#60a5fa", "#a78bfa", "#e0a458", "#c47d8e"];
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: i < brackets.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i] || "#888", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: t.text }}>₦{b.min.toLocaleString()} – {b.max === Infinity ? "∞" : `₦${b.max.toLocaleString()}`}</span>
                  <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>({b.label})</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <input value={b.multiplier} type="number" step="0.05" min="1" max="10" onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 1) { const next = [...brackets]; next[i] = { ...b, multiplier: v }; setBrackets(next); } }} style={{ ...inputStyle, width: 60 }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>×</span>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: t.textSoft, fontFamily: "'JetBrains Mono',monospace" }}>₦{exCost} → ₦{exSell}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Margin Floor */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Margin Floor</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Safety net — ensures you never sell too cheaply. Only applies to services below the cost ceiling.</div>
        <div style={cardStyle}>
          <div style={tipStyle}>
            <div style={{ fontWeight: 600, color: dark ? "#e5c1ca" : "#8b5e6b", marginBottom: 4 }}>What is this?</div>
            If a bracket calculates a sell price where your profit margin falls below {floorPct}%, the floor raises the price automatically. It only applies under ₦{floorCeiling.toLocaleString()} cost — expensive services use the bracket alone so they stay competitive.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text, minWidth: 140 }}>Minimum margin</span>
              <input value={floorPct} onChange={e => setFloorPct(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} type="number" style={{ ...inputStyle, width: 60 }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>%</span>
              <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>You keep at least {floorPct}% of every sale</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: t.text, minWidth: 140 }}>Applies under</span>
              <span style={{ fontSize: 13, color: t.textMuted }}>₦</span>
              <input value={floorCeiling} onChange={e => setFloorCeiling(Math.max(0, Number(e.target.value) || 0))} type="number" style={{ ...inputStyle, width: 80 }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>cost per 1K</span>
              <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>Above this, bracket multiplier alone</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nigerian Bonus */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Nigerian Service Bonus</span>
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Extra markup on Nigerian-targeted services, applied on top of the bracket price.</div>
        <div style={{ ...cardStyle, borderColor: dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.1)" }}>
          <div style={{ ...tipStyle, background: dark ? "rgba(74,222,128,.06)" : "rgba(22,163,74,.04)", borderLeftColor: dark ? "#4ade80" : "#16a34a" }}>
            <div style={{ fontWeight: 600, color: dark ? "#4ade80" : "#16a34a", marginBottom: 4 }}>Why charge more?</div>
            Nigerian-sourced engagement is more valuable — local followers and comments look authentic and perform better with location-based algorithms.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: t.text, minWidth: 140 }}>Bonus markup</span>
            <input value={ngBonus} onChange={e => setNgBonus(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} type="number" style={{ ...inputStyle, width: 60 }} />
            <span style={{ fontSize: 13, color: t.textMuted }}>%</span>
            <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>Added on top of bracket price</span>
          </div>
        </div>
      </div>

      {/* Exchange Rate */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Exchange Rate</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>MTP costs are in USD. This converts to Naira before applying brackets.</div>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: t.text, minWidth: 140 }}>USD → NGN</span>
            <span style={{ fontSize: 13, color: t.textMuted }}>₦</span>
            <input value={usdRate} onChange={e => setUsdRate(Math.max(1, Number(e.target.value) || 0))} type="number" style={{ ...inputStyle, width: 80 }} />
            <span style={{ fontSize: 12, color: t.textSoft, marginLeft: "auto" }}>$1 = ₦{usdRate.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Price Simulator</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Test how your settings affect real prices. Enter any cost to preview.</div>
        <div style={{ ...cardStyle, background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.02)", borderColor: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: t.text }}>MTP cost per 1K:</span>
            <span style={{ fontSize: 14, color: t.textMuted }}>₦</span>
            <input value={simCost} onChange={e => setSimCost(Math.max(0, Number(e.target.value) || 0))} type="number" style={{ ...inputStyle, width: 90 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              ["Sell Price", `₦${simSell.toLocaleString()}`, t.accent],
              ["Profit", `₦${simProfit.toLocaleString()}`, dark ? "#6ee7b7" : "#059669"],
              ["Margin", `${simMargin}%`, simMargin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626")],
              ["NG Price", `₦${simSellNG.toLocaleString()}`, dark ? "#4ade80" : "#16a34a"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: 14, borderRadius: 10, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .8, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: t.text }}>Breakdown:</strong>{" "}
            Cost ₦{simCost.toLocaleString()} → <strong>{simBracket?.label || "?"}</strong> bracket ({simBracket?.multiplier || "?"}×) → ₦{Math.round(simCost * (simBracket?.multiplier || 1)).toLocaleString()}.
            {simCost < floorCeiling && simMargin >= floorPct && ` Floor: ${simMargin}% ≥ ${floorPct}% — OK.`}
            {simCost < floorCeiling && simMargin < floorPct && ` Floor: below ${floorPct}%, raised to ₦${simSell.toLocaleString()}.`}
            {simCost >= floorCeiling && ` Above ₦${floorCeiling.toLocaleString()} — floor skipped.`}
            {` Nigerian: +${ngBonus}% = ₦${simSellNG.toLocaleString()}.`}
          </div>
        </div>
      </div>

      {/* Quick Reference */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Quick Reference</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Common service types with current settings.</div>
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 60px", gap: 6, fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
            <span>Service</span><span style={{ textAlign: "right" }}>Cost</span><span style={{ textAlign: "right" }}>Sell</span><span style={{ textAlign: "right" }}>Margin</span>
          </div>
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", marginBottom: 8 }} />
          {[["Basic Views", 2], ["Budget Likes", 50], ["Std Followers", 800], ["Prm Followers", 3000], ["Custom Comments", 12000], ["Premium Reviews", 50000]].map(([name, cost]) => {
            const sell = calcSellPrice(cost, brackets, floorPct, floorCeiling);
            const margin = Math.round(((sell - cost) / sell) * 100);
            return (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 60px", gap: 6, padding: "6px 0", fontSize: 13, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"}` }}>
                <span style={{ color: t.text }}>{name}</span>
                <span style={{ textAlign: "right", color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>₦{cost.toLocaleString()}</span>
                <span style={{ textAlign: "right", color: t.accent, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>₦{sell.toLocaleString()}</span>
                <span style={{ textAlign: "right", color: margin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{margin}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <button onClick={saveSettings} disabled={saving} style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Settings"}</button>
        <button onClick={recalculate} disabled={recalculating} style={{ padding: "11px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626", fontSize: 14, fontWeight: 600, cursor: recalculating ? "wait" : "pointer", opacity: recalculating ? .5 : 1 }}>{recalculating ? "Recalculating..." : "Recalculate All Prices"}</button>
        <button onClick={resetDefaults} style={{ padding: "11px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: "transparent", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Reset to Defaults</button>
      </div>
      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
        <strong>Save</strong> stores your bracket settings. <strong>Recalculate</strong> applies the formula to ALL service tiers — custom prices will be overwritten. <strong>Reset</strong> restores defaults without saving.
      </div>
    </div>
  );
}
