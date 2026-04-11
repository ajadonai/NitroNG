'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";

const DEF_BRACKETS = [
  { min: 0, max: 20, multiplier: 3, label: "Micro" },
  { min: 20, max: 200, multiplier: 2.5, label: "Low" },
  { min: 200, max: 1000, multiplier: 2, label: "Mid" },
  { min: 1000, max: 5000, multiplier: 1.7, label: "High" },
  { min: 5000, max: 20000, multiplier: 1.5, label: "Premium" },
  { min: 20000, max: 999999999, multiplier: 1.35, label: "Ultra" },
];
const COLORS = ["#34d399","#6ee7b7","#60a5fa","#a78bfa","#e0a458","#c47d8e"];

function calcSell(cost, brackets, floorPct, floorCeiling) {
  if (!brackets || !brackets.length) return 0;
  const b = brackets.find(b => cost >= b.min && cost < (b.max)) || brackets[brackets.length - 1];
  let sell = Math.round(cost * b.multiplier);
  const clamped = Math.min(floorPct, 99);
  if (cost < floorCeiling && clamped > 0) { const min = Math.round(cost / (1 - clamped / 100)); if (sell < min) sell = min; }
  return sell;
}

/* Number input — defined outside parent so React doesn't remount on every render */
function NumInput({ value, onChange, min = 0, max = 999999, fallback, width = 64, decimal, dark }) {
  const [raw, setRaw] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setRaw(String(value)); }, [value]);
  const inpStyle = { padding: "9px 12px", borderRadius: 8, background: dark ? "rgba(255,255,255,.04)" : "#fff", borderWidth: "0.5px", borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", color: dark ? "#e5e5e5" : "#1a1a1a", fontSize: 15, fontFamily: "'JetBrains Mono',monospace", outline: "none", textAlign: "right", boxSizing: "border-box", width };
  return <input
    value={raw}
    inputMode={decimal ? "decimal" : "numeric"}
    style={inpStyle}
    onFocus={() => { focused.current = true; }}
    onChange={e => {
      const v = e.target.value;
      if (v === "" || (decimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/).test(v)) {
        setRaw(v);
        const n = decimal ? parseFloat(v) : parseInt(v, 10);
        if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
      }
    }}
    onBlur={() => {
      focused.current = false;
      const n = decimal ? parseFloat(raw) : parseInt(raw, 10);
      if (isNaN(n) || raw === "") { const fb = fallback !== undefined ? fallback : min; onChange(fb); setRaw(String(fb)); }
      else { const clamped = Math.min(max, Math.max(min, n)); onChange(clamped); setRaw(String(clamped)); }
    }}
  />;
}

function Tip({ children, green, dark }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: green ? (dark ? "rgba(74,222,128,.05)" : "rgba(22,163,74,.03)") : (dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.03)"), borderLeft: `3px solid ${green ? (dark ? "#4ade80" : "#16a34a") : "#c47d8e"}`, fontSize: 13, color: dark ? "#888" : "#666", lineHeight: 1.6, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function Row({ label, hint, children, dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: dark ? "#e5e5e5" : "#1a1a1a" }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: dark ? "#555" : "#999", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function AdminPricingPage({ dark, t }) {
  const confirm = useConfirm();
  const [brackets, setBrackets] = useState(DEF_BRACKETS);
  const [floorPct, setFloorPct] = useState(50);
  const [floorCeiling, setFloorCeiling] = useState(5000);
  const [ngBonus, setNgBonus] = useState(25);
  const [usdRate, setUsdRate] = useState(1600);
  const [tierMults, setTierMults] = useState({ Budget: 1.0, Standard: 1.15, Premium: 1.35 });
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [simCost, setSimCost] = useState(500);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (!d.settings) return; const s = d.settings;
      try {
        if (s.markup_brackets) {
          const parsed = JSON.parse(s.markup_brackets);
          setBrackets(parsed.map(b => ({ ...b, max: b.max == null ? 999999999 : b.max })));
        }
      } catch {}
      if (s.markup_margin_floor) setFloorPct(Number(s.markup_margin_floor));
      if (s.markup_floor_ceiling) setFloorCeiling(Number(s.markup_floor_ceiling));
      if (s.markup_ng_bonus) setNgBonus(Number(s.markup_ng_bonus));
      if (s.markup_usd_rate) setUsdRate(Number(s.markup_usd_rate));
      try { if (s.markup_tier_multipliers) setTierMults(JSON.parse(s.markup_tier_multipliers)); } catch {}
    });
  }, []);

  const pack = () => ({ markup_brackets: JSON.stringify(brackets), markup_margin_floor: String(floorPct), markup_floor_ceiling: String(floorCeiling), markup_ng_bonus: String(ngBonus), markup_usd_rate: String(usdRate), markup_tier_multipliers: JSON.stringify(tierMults) });

  const save = async () => {
    setSaving(true); setMsg(null);
    try { const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack() }) }); setMsg(r.ok ? { ok: 1, text: "Settings saved" } : { text: "Failed to save" }); } catch { setMsg({ text: "Request failed" }); }
    setSaving(false);
  };

  const recalc = async () => {
    if (!await confirm({ title: "Recalculate All Prices", message: "This overwrites ALL existing tier sell prices with the current bracket formula. Custom prices will be replaced.", confirmLabel: "Recalculate All", danger: true })) return;
    setRecalcing(true); setMsg(null);
    try { await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack() }) });
      const r = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate-prices" }) }); const d = await r.json();
      setMsg(r.ok ? { ok: 1, text: `${d.updated || 0} prices recalculated` } : { text: d.error || "Failed" }); } catch { setMsg({ text: "Request failed" }); }
    setRecalcing(false);
  };

  const reset = () => { setBrackets(DEF_BRACKETS); setFloorPct(50); setFloorCeiling(5000); setNgBonus(25); setUsdRate(1600); setMsg({ ok: 1, text: "Reset to defaults — not saved yet" }); };

  // Simulator
  const simSell = calcSell(simCost, brackets, floorPct, floorCeiling);
  const simBudget = Math.round(simSell * (tierMults.Budget || 1));
  const simStandard = Math.round(simSell * (tierMults.Standard || 1.15));
  const simPremium = Math.round(simSell * (tierMults.Premium || 1.35));
  const simNG = Math.round(simStandard * (1 + ngBonus / 100));
  const simProfit = simStandard - simCost;
  const simMargin = simStandard > 0 ? Math.round((simProfit / simStandard) * 100) : 0;
  const simB = brackets.find(b => simCost >= b.min && simCost < (b.max));

  // Shared styles
  const cardS = { background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` };
  const divS = { background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" };

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pricing Engine</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Bracket-based markup — cheap services get higher markups, expensive services stay competitive</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.ok ? "✓" : "⚠️"} {msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", border: "none", fontSize: 16, cursor: "pointer" }}>✕</button></div>}

      {/* ═══ BRACKETS ═══ */}
      <div className="adm-card" style={{ ...cardS, padding: 20, marginBottom: 16 }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Price brackets</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Services are assigned to a bracket based on MTP cost. Cost × multiplier = sell price.</div>
        <div className="set-card-divider" style={divS} />
        <Tip dark={dark}>Cheap services (₦0–200) get 2.5–3× markup because customers don't notice small price differences. Expensive services (₦5K+) get 1.35–1.5× to stay competitive at higher price points.</Tip>

        {brackets.map((b, i) => {
          const exCost = b.min === 0 ? 10 : b.min;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < brackets.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>₦{b.min.toLocaleString()} – {!b.max || b.max >= 999999999 ? "∞" : `₦${b.max.toLocaleString()}`}</div>
                <div style={{ fontSize: 12, color: t.textSoft }}>{b.label} · ₦{exCost} → ₦{Math.round(exCost * b.multiplier)}</div>
              </div>
              <NumInput dark={dark} value={b.multiplier} decimal min={1} max={10} fallback={1} width={64} onChange={v => { const n = [...brackets]; n[i] = { ...b, multiplier: v }; setBrackets(n); }} />
              <span style={{ fontSize: 14, color: t.textMuted, width: 12 }}>×</span>
            </div>
          );
        })}
      </div>

      {/* ═══ MARGIN FLOOR ═══ */}
      <div className="adm-card" style={{ ...cardS, padding: 20, marginBottom: 16 }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Margin floor</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Safety net — ensures cheap services never sell at razor-thin margins.</div>
        <div className="set-card-divider" style={divS} />
        <Tip dark={dark}>If a bracket calculates a margin below {floorPct}%, the sell price is raised automatically. Only applies to services costing less than ₦{floorCeiling.toLocaleString()} — expensive services use the bracket multiplier alone.</Tip>

        <Row dark={dark} label="Minimum margin" hint={`You keep at least ${floorPct}% of every sale`}>
          <NumInput dark={dark} value={floorPct} onChange={setFloorPct} min={0} max={90} fallback={50} width={64} />
          <span style={{ fontSize: 14, color: t.textMuted }}>%</span>
        </Row>
        <Row dark={dark} label="Cost ceiling" hint="Floor only applies below this cost per 1K">
          <span style={{ fontSize: 14, color: t.textMuted }}>₦</span>
          <NumInput dark={dark} value={floorCeiling} onChange={setFloorCeiling} min={0} max={999999} fallback={5000} width={80} />
        </Row>
      </div>

      {/* ═══ TIER MULTIPLIERS ═══ */}
      <div className="adm-card" style={{ ...cardS, padding: 20, marginBottom: 16 }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Tier multipliers</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Applied on top of the bracket price. Guarantees Budget &lt; Standard &lt; Premium.</div>
        <div className="set-card-divider" style={divS} />
        <Tip dark={dark}>Budget is the base price (1.0×). Standard and Premium multiply on top. Example: bracket gives ₦1,000 → Budget stays ₦1,000, Standard at 1.15× = ₦1,150, Premium at 1.35× = ₦1,350.</Tip>
        {[
          ["Budget", "Base tier — cheapest option", "Budget"],
          ["Standard", "Recommended tier — quality balance", "Standard"],
          ["Premium", "Highest quality — most expensive", "Premium"],
        ].map(([label, hint, key]) => (
          <Row key={key} dark={dark} label={label} hint={hint}>
            <NumInput dark={dark} value={tierMults[key] || 1} onChange={v => setTierMults(prev => ({ ...prev, [key]: v }))} min={0.5} max={5} fallback={key === "Budget" ? 1 : key === "Standard" ? 1.15 : 1.35} width={64} decimal />
            <span style={{ fontSize: 14, color: t.textMuted }}>×</span>
          </Row>
        ))}
      </div>

      {/* ═══ NG BONUS + RATE ═══ */}
      <div className="adm-grid-2" style={{ marginBottom: 16 }}>
        <div className="adm-card" style={{ ...cardS, padding: 20 }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>🇳🇬 Nigerian bonus</div>
          <div className="set-card-desc" style={{ color: t.textMuted }}>Extra markup on Nigerian-targeted services.</div>
          <div className="set-card-divider" style={divS} />
          <Tip dark={dark} green>Nigerian engagement is premium — local followers look authentic and perform better with geo-targeted algorithms.</Tip>
          <Row dark={dark} label="Bonus markup" hint="Added on top of the bracket sell price">
            <NumInput dark={dark} value={ngBonus} onChange={setNgBonus} min={0} max={200} fallback={25} width={64} />
            <span style={{ fontSize: 14, color: t.textMuted }}>%</span>
          </Row>
        </div>

        <div className="adm-card" style={{ ...cardS, padding: 20 }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Exchange rate</div>
          <div className="set-card-desc" style={{ color: t.textMuted }}>MTP costs are in USD — this converts to Naira.</div>
          <div className="set-card-divider" style={divS} />
          <Row dark={dark} label="USD → NGN" hint={`$1 = ₦${usdRate.toLocaleString()}`}>
            <span style={{ fontSize: 14, color: t.textMuted }}>₦</span>
            <NumInput dark={dark} value={usdRate} onChange={setUsdRate} min={1} max={999999} fallback={1600} width={80} />
          </Row>
        </div>
      </div>

      {/* ═══ SIMULATOR ═══ */}
      <div className="adm-card" style={{ ...cardS, padding: 20, marginBottom: 16 }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Price simulator</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Test any MTP cost to see the calculated sell price, profit, and margin.</div>
        <div className="set-card-divider" style={divS} />

        <Row dark={dark} label="MTP cost per 1K" hint="Enter any value to preview">
          <span style={{ fontSize: 14, color: t.textMuted }}>₦</span>
          <NumInput dark={dark} value={simCost} onChange={setSimCost} min={0} max={999999} fallback={500} width={90} />
        </Row>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "16px 0" }}>
          {[
            ["Budget", `₦${simBudget.toLocaleString()}`, dark ? "#f59e0b" : "#d97706"],
            ["Standard", `₦${simStandard.toLocaleString()}`, dark ? "#60a5fa" : "#2563eb"],
            ["Premium", `₦${simPremium.toLocaleString()}`, dark ? "#a78bfa" : "#7c3aed"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ padding: "12px 8px", borderRadius: 10, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            ["Margin", `${simMargin}%`, simMargin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626")],
            ["🇳🇬 Std", `₦${simNG.toLocaleString()}`, dark ? "#4ade80" : "#16a34a"],
            ["Base", `₦${simSell.toLocaleString()}`, t.textMuted],
          ].map(([label, val, color]) => (
            <div key={label} style={{ padding: "10px 8px", borderRadius: 10, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          ₦{simCost.toLocaleString()} → <strong style={{ color: t.text }}>{simB?.label}</strong> ({simB?.multiplier}×) → ₦{Math.round(simCost * (simB?.multiplier || 1)).toLocaleString()}
          {simCost < floorCeiling && simMargin >= floorPct && `. Floor: ${simMargin}% ≥ ${floorPct}% ✓`}
          {simCost < floorCeiling && simMargin < floorPct && `. Floor raised price to ₦${simSell.toLocaleString()}`}
          {simCost >= floorCeiling && ". Floor skipped (above ceiling)"}
          {`. 🇳🇬 +${ngBonus}% = ₦${simNG.toLocaleString()}`}
        </div>
      </div>

      {/* ═══ QUICK REFERENCE ═══ */}
      <div className="adm-card" style={{ ...cardS, padding: 20, marginBottom: 20 }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Quick reference</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>How common service types price out with current settings.</div>
        <div className="set-card-divider" style={divS} />

        {[["Basic Views", 2], ["Budget Likes", 50], ["Standard Followers", 800], ["Premium Followers", 3000], ["Custom Comments", 12000], ["Premium Reviews", 50000]].map(([name, cost], i, arr) => {
          const sell = calcSell(cost, brackets, floorPct, floorCeiling);
          const margin = Math.round(((sell - cost) / sell) * 100);
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[brackets.findIndex(b => cost >= b.min && cost < (b.max))], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.text }}>{name}</div>
              <span style={{ fontSize: 13, color: t.textMuted, width: 65, textAlign: "right" }}>₦{cost.toLocaleString()}</span>
              <span style={{ fontSize: 13, color: t.textMuted, width: 12, textAlign: "center" }}>→</span>
              <span style={{ fontSize: 13, color: t.accent, fontWeight: 600, width: 75, textAlign: "right" }}>₦{sell.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: margin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), width: 36, textAlign: "right" }}>{margin}%</span>
            </div>
          );
        })}
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={save} disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Settings"}</button>
        <button onClick={recalc} disabled={recalcing} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626", fontSize: 14, fontWeight: 600, cursor: recalcing ? "wait" : "pointer", opacity: recalcing ? .5 : 1 }}>{recalcing ? "Recalculating..." : "Recalculate All Prices"}</button>
        <button onClick={reset} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: "transparent", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Reset Defaults</button>
      </div>
      <div style={{ fontSize: 12, color: t.textSoft, marginTop: 8, lineHeight: 1.5 }}><strong style={{ color: t.textMuted }}>Save</strong> stores settings. <strong style={{ color: t.textMuted }}>Recalculate</strong> applies formula to all tiers — custom prices are overwritten. <strong style={{ color: t.textMuted }}>Reset</strong> restores defaults without saving.</div>
    </div>
  );
}
