'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";

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
  const inpStyle = { background: dark ? "rgba(255,255,255,.08)" : "#fff", borderWidth: "0.5px", borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.18)", color: dark ? "#e5e5e5" : "#1a1a1a", fontFamily: "'JetBrains Mono',monospace", width };
  return <input
    value={raw}
    inputMode={decimal ? "decimal" : "numeric"}
    className="py-[9px] px-3 rounded-lg text-[15px] outline-none text-right"
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
    <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-[1.6] mb-4" style={{ background: green ? (dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)") : (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)"), borderLeft: `3px solid ${green ? (dark ? "#4ade80" : "#16a34a") : "#c47d8e"}`, color: dark ? "#888" : "#666" }}>
      {children}
    </div>
  );
}

function Row({ label, hint, children, dark }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: dark ? "#e5e5e5" : "#1a1a1a" }}>{label}</div>
        {hint && <div className="text-xs mt-0.5" style={{ color: dark ? "#555" : "#999" }}>{hint}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

export default function AdminPricingPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [brackets, setBrackets] = useState(DEF_BRACKETS);
  const [floorPct, setFloorPct] = useState(50);
  const [floorCeiling, setFloorCeiling] = useState(5000);
  const [ngBonus, setNgBonus] = useState(25);
  const [usdRate, setUsdRate] = useState(1600);
  const [tierMults, setTierMults] = useState({ Budget: 1.0, Standard: 1.15, Premium: 1.35 });
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
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
    setSaving(true);
    try { const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack() }) }); if (r.ok) toast.success("Settings saved", ""); else toast.error("Failed to save", ""); } catch { toast.error("Request failed", "Check your connection"); }
    setSaving(false);
  };

  const recalc = async () => {
    if (!await confirm({ title: "Recalculate All Prices", message: "This overwrites ALL existing tier sell prices with the current bracket formula. Custom prices will be replaced.", confirmLabel: "Recalculate All", danger: true })) return;
    setRecalcing(true);
    try { await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack() }) });
      const r = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate-prices" }) }); const d = await r.json();
      if (r.ok) toast.success("Prices recalculated", `${d.updated || 0} tiers updated`); else toast.error("Failed", d.error || ""); } catch { toast.error("Request failed", "Check your connection"); }
    setRecalcing(false);
  };

  const reset = () => { setBrackets(DEF_BRACKETS); setFloorPct(50); setFloorCeiling(5000); setNgBonus(25); setUsdRate(1600); toast.info("Reset to defaults", "Not saved yet"); };

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
  const cardS = { background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` };
  const divS = { background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" };

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pricing Engine</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Bracket-based markup — cheap services get higher markups, expensive services stay competitive</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      {/* ═══ BRACKETS ═══ */}
      <div className="adm-card p-5 mb-4" style={cardS}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Price brackets</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Services are assigned to a bracket based on MTP cost. Cost × multiplier = sell price.</div>
        <div className="set-card-divider" style={divS} />
        <Tip dark={dark}>Cheap services (₦0–200) get 2.5–3× markup because customers don't notice small price differences. Expensive services (₦5K+) get 1.35–1.5× to stay competitive at higher price points.</Tip>

        {brackets.map((b, i) => {
          const exCost = b.min === 0 ? 10 : b.min;
          return (
            <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < brackets.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` : "none" }}>
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i] }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: t.text }}>₦{b.min.toLocaleString()} – {!b.max || b.max >= 999999999 ? "∞" : `₦${b.max.toLocaleString()}`}</div>
                <div className="text-xs" style={{ color: t.textSoft }}>{b.label} · ₦{exCost} → ₦{Math.round(exCost * b.multiplier)}</div>
              </div>
              <NumInput dark={dark} value={b.multiplier} decimal min={1} max={10} fallback={1} width={64} onChange={v => { const n = [...brackets]; n[i] = { ...b, multiplier: v }; setBrackets(n); }} />
              <span className="text-sm w-3" style={{ color: t.textMuted }}>×</span>
            </div>
          );
        })}
      </div>

      {/* ═══ MARGIN FLOOR ═══ */}
      <div className="adm-card p-5 mb-4" style={cardS}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Margin floor</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Safety net — ensures cheap services never sell at razor-thin margins.</div>
        <div className="set-card-divider" style={divS} />
        <Tip dark={dark}>If a bracket calculates a margin below {floorPct}%, the sell price is raised automatically. Only applies to services costing less than ₦{floorCeiling.toLocaleString()} — expensive services use the bracket multiplier alone.</Tip>

        <Row dark={dark} label="Minimum margin" hint={`You keep at least ${floorPct}% of every sale`}>
          <NumInput dark={dark} value={floorPct} onChange={setFloorPct} min={0} max={90} fallback={50} width={64} />
          <span className="text-sm" style={{ color: t.textMuted }}>%</span>
        </Row>
        <Row dark={dark} label="Cost ceiling" hint="Floor only applies below this cost per 1K">
          <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
          <NumInput dark={dark} value={floorCeiling} onChange={setFloorCeiling} min={0} max={999999} fallback={5000} width={80} />
        </Row>
      </div>

      {/* ═══ TIER MULTIPLIERS ═══ */}
      <div className="adm-card p-5 mb-4" style={cardS}>
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
            <span className="text-sm" style={{ color: t.textMuted }}>×</span>
          </Row>
        ))}
      </div>

      {/* ═══ NG BONUS + RATE ═══ */}
      <div className="adm-grid-2 mb-4">
        <div className="adm-card p-5" style={cardS}>
          <div className="set-card-title" style={{ color: t.textMuted }}>🇳🇬 Nigerian bonus</div>
          <div className="set-card-desc" style={{ color: t.textMuted }}>Extra markup on Nigerian-targeted services.</div>
          <div className="set-card-divider" style={divS} />
          <Tip dark={dark} green>Nigerian engagement is premium — local followers look authentic and perform better with geo-targeted algorithms.</Tip>
          <Row dark={dark} label="Bonus markup" hint="Added on top of the bracket sell price">
            <NumInput dark={dark} value={ngBonus} onChange={setNgBonus} min={0} max={200} fallback={25} width={64} />
            <span className="text-sm" style={{ color: t.textMuted }}>%</span>
          </Row>
        </div>

        <div className="adm-card p-5" style={cardS}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Exchange rate</div>
          <div className="set-card-desc" style={{ color: t.textMuted }}>MTP costs are in USD — this converts to Naira.</div>
          <div className="set-card-divider" style={divS} />
          <Row dark={dark} label="USD → NGN" hint={`$1 = ₦${usdRate.toLocaleString()}`}>
            <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
            <NumInput dark={dark} value={usdRate} onChange={setUsdRate} min={1} max={999999} fallback={1600} width={80} />
          </Row>
        </div>
      </div>

      {/* ═══ SIMULATOR ═══ */}
      <div className="adm-card p-5 mb-4" style={cardS}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Price simulator</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>Test any MTP cost to see the calculated sell price, profit, and margin.</div>
        <div className="set-card-divider" style={divS} />

        <Row dark={dark} label="MTP cost per 1K" hint="Enter any value to preview">
          <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
          <NumInput dark={dark} value={simCost} onChange={setSimCost} min={0} max={999999} fallback={500} width={90} />
        </Row>

        <div className="grid grid-cols-3 gap-2.5 my-4">
          {[
            ["Budget", `₦${simBudget.toLocaleString()}`, dark ? "#f59e0b" : "#d97706"],
            ["Standard", `₦${simStandard.toLocaleString()}`, dark ? "#60a5fa" : "#2563eb"],
            ["Premium", `₦${simPremium.toLocaleString()}`, dark ? "#a78bfa" : "#7c3aed"],
          ].map(([label, val, color]) => (
            <div key={label} className="py-3 px-2 rounded-[10px] text-center" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>{label}</div>
              <div className="text-lg font-semibold" style={{ color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            ["Margin", `${simMargin}%`, simMargin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626")],
            ["🇳🇬 Std", `₦${simNG.toLocaleString()}`, dark ? "#4ade80" : "#16a34a"],
            ["Base", `₦${simSell.toLocaleString()}`, t.textMuted],
          ].map(([label, val, color]) => (
            <div key={label} className="py-2.5 px-2 rounded-[10px] text-center" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-[.5px] mb-[3px]" style={{ color: t.textMuted }}>{label}</div>
              <div className="text-[15px] font-semibold" style={{ color, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
            </div>
          ))}
        </div>

        <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>
          ₦{simCost.toLocaleString()} → <strong style={{ color: t.text }}>{simB?.label}</strong> ({simB?.multiplier}×) → ₦{Math.round(simCost * (simB?.multiplier || 1)).toLocaleString()}
          {simCost < floorCeiling && simMargin >= floorPct && `. Floor: ${simMargin}% ≥ ${floorPct}% pass`}
          {simCost < floorCeiling && simMargin < floorPct && `. Floor raised price to ₦${simSell.toLocaleString()}`}
          {simCost >= floorCeiling && ". Floor skipped (above ceiling)"}
          {`. 🇳🇬 +${ngBonus}% = ₦${simNG.toLocaleString()}`}
        </div>
      </div>

      {/* ═══ QUICK REFERENCE ═══ */}
      <div className="adm-card p-5 mb-5" style={cardS}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Quick reference</div>
        <div className="set-card-desc" style={{ color: t.textMuted }}>How common service types price out with current settings.</div>
        <div className="set-card-divider" style={divS} />

        {[["Basic Views", 2], ["Budget Likes", 50], ["Standard Followers", 800], ["Premium Followers", 3000], ["Custom Comments", 12000], ["Premium Reviews", 50000]].map(([name, cost], i, arr) => {
          const sell = calcSell(cost, brackets, floorPct, floorCeiling);
          const margin = Math.round(((sell - cost) / sell) * 100);
          return (
            <div key={name} className="flex items-center py-2.5 gap-2" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` : "none" }}>
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[brackets.findIndex(b => cost >= b.min && cost < (b.max))] }} />
              <div className="flex-1 text-sm font-medium" style={{ color: t.text }}>{name}</div>
              <span className="text-[13px] w-[65px] text-right" style={{ color: t.textMuted }}>₦{cost.toLocaleString()}</span>
              <span className="text-[13px] w-3 text-center" style={{ color: t.textMuted }}>→</span>
              <span className="text-[13px] font-semibold w-[75px] text-right" style={{ color: t.accent }}>₦{sell.toLocaleString()}</span>
              <span className="text-xs w-9 text-right" style={{ color: margin >= floorPct ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{margin}%</span>
            </div>
          );
        })}
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div className="flex gap-2.5 flex-wrap">
        <button onClick={save} disabled={saving} className="py-2.5 px-6 rounded-[10px] border-none text-sm font-semibold transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Settings"}</button>
        <button onClick={recalc} disabled={recalcing} className="py-2.5 px-6 rounded-[10px] text-sm font-semibold transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)"}`, background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626", cursor: recalcing ? "wait" : "pointer", opacity: recalcing ? .5 : 1 }}>{recalcing ? "Recalculating..." : "Recalculate All Prices"}</button>
        <button onClick={reset} className="py-2.5 px-6 rounded-[10px] bg-transparent text-sm font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`, color: t.textMuted }}>Reset Defaults</button>
      </div>
      <div className="text-xs mt-2 leading-[1.5]" style={{ color: t.textSoft }}><strong style={{ color: t.textMuted }}>Save</strong> stores settings. <strong style={{ color: t.textMuted }}>Recalculate</strong> applies formula to all tiers — custom prices are overwritten. <strong style={{ color: t.textMuted }}>Reset</strong> restores defaults without saving.</div>
    </div>
  );
}
