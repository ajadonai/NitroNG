'use client';
import { useState, useEffect } from "react";
import { useToast } from "./toast";
import { formatNaira } from '../lib/money';

/**
 * Admin → Reseller pricing.
 *
 * Its own page rather than a section of Pricing, and the reason is not filing.
 * Pricing answers "what does a service cost a customer" — brackets, tier
 * multipliers, the dollar rate. This answers "what is a reseller to us", which
 * is a different question with a different reader: the rungs, what holds them,
 * and the margin that must survive the discount. Bolting it onto Pricing put
 * two unrelated decisions behind one card and made the ladder look like a
 * footnote to the markup.
 *
 * It reads the same `markup_brackets` the pricing page writes, so the bands are
 * one definition and cannot drift. Everything here is inert until the ladder is
 * switched on at the bottom.
 */
const naira = (n) => formatNaira(n, { round: false });

const DEF_TIERS = [
  { id: "T1", name: "Starter", threshold: 10000000, pct: 10 },
  { id: "T2", name: "Trade", threshold: 25000000, pct: 15 },
  { id: "T3", name: "Bulk", threshold: 50000000, pct: 20 },
  { id: "T4", name: "Scale", threshold: 100000000, pct: 25 },
  { id: "T5", name: "Wholesale", threshold: 200000000, pct: 30 },
];
const DEF_BRACKETS = [
  { min: 0, max: 20, multiplier: 10, label: "Micro" },
  { min: 20, max: 200, multiplier: 5, label: "Low" },
  { min: 200, max: 1000, multiplier: 3.65, label: "Mid" },
  { min: 1000, max: 5000, multiplier: 2.25, label: "High" },
  { min: 5000, max: 20000, multiplier: 1.9, label: "Premium" },
  { min: 20000, max: 999999999, multiplier: 1.5, label: "Ultra" },
];
const DEFAULTS = { tiers: DEF_TIERS, caps: { Ultra: 22 }, seat: 100000000, floor: 10, live: false };
const DOTS = ["#34d399", "#6ee7b7", "#60a5fa", "#a78bfa", "#e0a458", "#c47d8e"];

/** The most a band can be discounted before it breaks the margin floor. */
const ceilingOf = (mult, floorPct) => (1 - (1 / (1 - Math.min(floorPct, 99) / 100)) / mult) * 100;
const bandRange = (b) => b.max >= 999999999 ? `over ${naira(b.min)}` : b.min === 0 ? `under ${naira(b.max)}` : `${naira(b.min)}–${naira(b.max)}`;
const bandOf = (brackets, costNaira) => brackets.find(b => costNaira >= b.min && costNaira < (b.max >= 999999999 ? Infinity : b.max)) || brackets[brackets.length - 1];

function Num({ value, onChange, width = 64, ...rest }) {
  return (
    <input className="rp-in m" style={{ width }} inputMode="numeric" value={value}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ""))} {...rest} />
  );
}

// `dark` is deliberately not taken: this page themes through the CSS tokens and
// a `.dark` descendant selector, so there is nothing for it to branch on.
export default function AdminResellerPricingPage({ t }) {
  const toast = useToast();
  const [s, setS] = useState(DEFAULTS);
  const [brackets, setBrackets] = useState(DEF_BRACKETS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sim, setSim] = useState(25000);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      const v = d?.settings || {};
      const next = { ...DEFAULTS };
      try { if (v.reseller_tiers) next.tiers = JSON.parse(v.reseller_tiers); } catch { /* the drawn ladder */ }
      try { if (v.reseller_band_caps) next.caps = JSON.parse(v.reseller_band_caps); } catch { /* the drawn caps */ }
      if (v.reseller_seat_lifetime) next.seat = Number(v.reseller_seat_lifetime);
      if (v.markup_reseller_margin_floor) next.floor = Number(v.markup_reseller_margin_floor);
      next.live = v.reseller_tiers_live === "true";
      try { if (v.markup_brackets) setBrackets(JSON.parse(v.markup_brackets)); } catch { /* the drawn brackets */ }
      setS(next); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async (next) => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: {
          reseller_tiers: JSON.stringify(next.tiers),
          reseller_band_caps: JSON.stringify(next.caps),
          reseller_seat_lifetime: String(next.seat),
          markup_reseller_margin_floor: String(next.floor),
          reseller_tiers_live: next.live ? "true" : "false",
        } }),
      });
      if (!r.ok) throw new Error();
      setS(next);
      toast.success("Saved", "");
    } catch { toast.error("Could not save", "Check your connection"); }
    finally { setSaving(false); }
  };

  const top = s.tiers[s.tiers.length - 1];
  // A threshold that does not rise, or a rate that falls, inverts the ladder.
  const ladderFault = s.tiers.find((t, i) => i > 0 && (t.threshold <= s.tiers[i - 1].threshold || t.pct < s.tiers[i - 1].pct));
  const overCap = brackets.find(b => { const c = s.caps[b.label]; return c != null && c !== "" && Number(c) > ceilingOf(b.multiplier, s.floor); });

  const simBand = bandOf(brackets, sim);
  const simRetail = Math.round(sim * simBand.multiplier);

  return (
    <div className="rp">
      <style>{CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Reseller pricing</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>
              What a reseller pays instead of the site price, and what they have to spend to get there.
            </div>
          </div>
          <span className={"rp-live" + (s.live ? " on" : "")}>{s.live ? "Ladder is live" : "Ladder is off"}</span>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {!loaded ? <div className="rp-card"><div className="rp-empty">Loading…</div></div> : <>
        <section className="rp-card">
          <header><h3>Tiers</h3><span className="rp-cnt">rolling 30-day spend, at the site price</span></header>
          <p className="rp-hint">
            What a reseller must spend in any 30 days to sit on a rung, and what they get for it. Spend counts
            what the orders <b>would have cost at the site price</b>, so earning a discount never makes the next
            rung harder to reach. Below the first rung is normal pricing.
          </p>
          <div className="rp-rows">
            <div className="rp-row head"><span /><span>Tier</span><span>Spend in 30 days</span><span>Discount</span></div>
            {s.tiers.map((tier, i) => (
              <div className="rp-row" key={tier.id}>
                <span className="rp-n m">{tier.id}</span>
                <span className="rp-nm">{tier.name}</span>
                <span className="rp-f"><em>₦</em><Num width={96} value={Math.round(tier.threshold / 100)}
                  onChange={v => { const n = [...s.tiers]; n[i] = { ...tier, threshold: Math.round(Number(v || 0) * 100) }; setS({ ...s, tiers: n }); }} /></span>
                <span className="rp-f"><Num width={54} value={tier.pct}
                  onChange={v => { const n = [...s.tiers]; n[i] = { ...tier, pct: Number(v || 0) }; setS({ ...s, tiers: n }); }} /><em>%</em></span>
              </div>
            ))}
          </div>
          <p className="rp-note">
            <b>{s.tiers[0]?.name} is the price of admission.</b> A reseller who does not reach {naira(s.tiers[0]?.threshold / 100)} in a
            month is put on normal pricing — the account stays, the discount goes, and clearing it again brings it
            back that night. Nobody is judged before the end of their first full month.
          </p>
          {ladderFault && <div className="rp-bar bad"><span>⚠</span><span>{ladderFault.name} must start above the tier below it and cannot give less. As set, climbing a rung would put a reseller&rsquo;s prices up.</span></div>}
        </section>

        <section className="rp-card">
          <header><h3>Band caps</h3><span className="rp-cnt">the same bands the pricing page uses</span></header>
          <p className="rp-hint">
            A flat discount off retail is not a flat margin, because retail is not a flat markup. The same {top?.pct}% that
            leaves plenty on a cheap service leaves almost nothing on the dearest. A cap is the most <b>any</b> tier may take
            off a band. Leave it empty and the tier&rsquo;s own rate applies.
          </p>
          <div className="rp-rows">
            <div className="rp-row head band"><span /><span>Band</span><span>Cost per 1k</span><span>Safe to</span><span>Cap</span></div>
            {brackets.map((b, i) => {
              const ceil = Math.max(0, ceilingOf(b.multiplier, s.floor));
              const val = s.caps[b.label];
              const bad = val != null && val !== "" && Number(val) > ceil;
              const binds = val != null && val !== "" && Number(val) < (top?.pct ?? 100);
              return (
                <div className="rp-row band" key={b.label || i}>
                  <i className="rp-dot" style={{ background: DOTS[i] || DOTS[5] }} />
                  <span className="rp-nm">{b.label} <small>×{b.multiplier}</small></span>
                  <span className="rp-cnt m">{bandRange(b)}</span>
                  <span className={"rp-ceil" + (binds ? " binds" : "")}>{ceil.toFixed(1)}%</span>
                  <span className="rp-f">
                    <input className={"rp-in m" + (bad ? " bad" : binds ? " warn" : "")} style={{ width: 66 }} inputMode="numeric"
                      value={val ?? ""} placeholder="no cap" aria-label={`${b.label} cap`}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const caps = { ...s.caps };
                        // Empty means no cap. A cap of zero would put every tier
                        // on retail for the band, which is not the same thing.
                        if (raw === "") delete caps[b.label]; else caps[b.label] = Number(raw);
                        setS({ ...s, caps });
                      }} />
                    <em>%</em>
                  </span>
                </div>
              );
            })}
          </div>
          {overCap
            ? <div className="rp-bar bad"><span>⚠</span><span>{overCap.label} cannot carry {s.caps[overCap.label]}%. Above {ceilingOf(overCap.multiplier, s.floor).toFixed(1)}% it breaks the {s.floor}% floor, and at {((1 - 1 / overCap.multiplier) * 100).toFixed(1)}% it sells at what we paid.</span></div>
            : <p className="rp-note">A cap binds <b>every</b> tier, not only the top. Capping just the top would let a lower tier pay less than a higher one.</p>}
        </section>

        <section className="rp-card">
          <header><h3>Try a cost</h3><span className="rp-cnt">what each tier would pay</span></header>
          <div className="rp-sim">
            <label htmlFor="rp-sim">Provider cost per 1k</label>
            <span className="rp-f"><em>₦</em><input id="rp-sim" className="rp-in m" style={{ width: 92 }} inputMode="numeric"
              value={sim} onChange={e => setSim(Number(e.target.value.replace(/[^0-9]/g, "") || 0))} /></span>
            <span className="rp-tag">{simBand.label} · ×{simBand.multiplier}</span>
            <span className="rp-cnt">site price {naira(simRetail)}</span>
          </div>
          <div className="rp-tw">
            <table>
              <thead><tr><th>Tier</th><th>Rate</th><th>Pays</th><th>Price</th><th>Our margin</th></tr></thead>
              <tbody>
                {s.tiers.map(tier => {
                  const cap = s.caps[simBand.label];
                  const eff = Math.min(tier.pct, cap == null || cap === "" ? 100 : Number(cap));
                  const floored = Math.max(Math.ceil(simRetail * (1 - eff / 100)), Math.ceil(sim / (1 - Math.min(s.floor, 99) / 100)));
                  const price = Math.min(simRetail, floored);
                  const margin = price ? (1 - sim / price) * 100 : 0;
                  return (
                    <tr key={tier.id}>
                      <td>{tier.name}</td>
                      <td className="m">{tier.pct}%</td>
                      <td className={"m" + (eff < tier.pct ? " warn" : "")}>{eff}%</td>
                      <td className="m">{naira(price)}</td>
                      <td className={"m" + (margin < s.floor - 0.05 ? " bad" : " ok")}>{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rp-card">
          <header><h3>The safety net</h3></header>
          <div className="rp-rows">
            <div className="rp-row two">
              <span><b>Seat for life after</b><small>Lifetime spend that keeps the bottom rung for good. The seat, not the tier — a dormant reseller on {s.tiers[0]?.pct}% of very little is cheap, on {top?.pct}% it would not be.</small></span>
              <span className="rp-f"><em>₦</em><Num width={100} value={Math.round(s.seat / 100)} onChange={v => setS({ ...s, seat: Math.round(Number(v || 0) * 100) })} /></span>
            </div>
            <div className="rp-row two">
              <span><b>Never below this margin</b><small>The backstop under everything. No tier, cap or custom rate may take a service under it, whatever gets typed anywhere else.</small></span>
              <span className="rp-f"><Num width={54} value={s.floor} onChange={v => setS({ ...s, floor: Number(v || 0) })} /><em>%</em></span>
            </div>
            <div className="rp-row two">
              <span><b>Ladder is live</b><small>{s.live
                ? "Tiers decide every reseller's rate. The flat rate on the Pricing page is ignored."
                : "Set up but switched off. Every reseller pays the flat rate on the Pricing page, and nothing here changes a price."}</small></span>
              <button type="button" className={"rp-sw" + (s.live ? " on" : "")} aria-pressed={s.live}
                onClick={() => setS({ ...s, live: !s.live })}><i /></button>
            </div>
          </div>
        </section>

        <div className="rp-foot">
          <button type="button" className="nb" onClick={() => setS(DEFAULTS)} disabled={saving}>Reset to defaults</button>
          <button type="button" className="nb pri" onClick={() => save(s)} disabled={saving || !!ladderFault || !!overCap}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </>}
    </div>
  );
}

const CSS = `
.rp{display:flex;flex-direction:column;gap:14px;color:var(--t-text)}
.rp *{box-sizing:border-box}
.rp .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rp-live{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:5px 11px;border-radius:999px;
  background:rgba(0,0,0,.05);color:var(--t-text-muted);white-space:nowrap;flex-shrink:0}
.dark .rp-live{background:rgba(255,255,255,.07)}
.rp-live.on{background:rgba(10,125,84,.12);color:#0a7d54}
.dark .rp-live.on{background:rgba(110,231,183,.14);color:#6ee7b7}
.rp-card{background:var(--t-card-bg);border:1px solid var(--t-card-border);border-radius:14px;padding:16px 18px}
.rp-card > header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px}
.rp-card h3{font-size:14.5px;font-weight:700;margin:0}
.rp-cnt{font-size:11.5px;color:var(--t-text-muted)}
.rp-hint{font-size:12.5px;color:var(--t-text-muted);margin:0 0 12px;max-width:74ch;line-height:1.5}
.rp-note{font-size:12.5px;color:var(--t-text-muted);margin:10px 0 0;max-width:74ch;line-height:1.5}
.rp-empty{font-size:13px;color:var(--t-text-muted);padding:10px 0}
.rp-rows{display:flex;flex-direction:column}
.rp-row{display:grid;grid-template-columns:34px 1fr auto auto;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--t-card-border)}
.rp-row.band{grid-template-columns:14px minmax(96px,1fr) auto 64px auto}
.rp-row.two{grid-template-columns:1fr auto;align-items:flex-start}
.rp-row:last-child{border-bottom:none}
.rp-row.head{font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--t-text-muted);padding-bottom:7px}
.rp-row.two b{font-size:13.5px;font-weight:600;display:block}
.rp-row.two small{font-size:11.5px;color:var(--t-text-muted);display:block;margin-top:2px;max-width:62ch;line-height:1.45}
.rp-n{font-size:11px;font-weight:700;color:var(--t-text-muted)}
.rp-nm{font-size:13.5px;font-weight:600}
.rp-nm small{font-size:11.5px;font-weight:400;color:var(--t-text-muted)}
.rp-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.rp-ceil{font-size:12px;color:var(--t-text-muted);text-align:right}
.rp-ceil.binds{color:#854F0B;font-weight:700}
.dark .rp-ceil.binds{color:#e0a458}
.rp-f{display:inline-flex;align-items:center;gap:5px}
.rp-f em{font-style:normal;font-size:12px;color:var(--t-text-muted)}
.rp-in{background:var(--t-input-bg);border:1px solid var(--t-input-border);border-radius:8px;padding:6px 9px;
  font:inherit;font-size:13px;text-align:right;color:var(--t-text);font-family:'JetBrains Mono',ui-monospace,monospace}
.rp-in:focus{outline:none;border-color:var(--t-accent);box-shadow:0 0 0 2px rgba(196,125,142,.18)}
.rp-in.warn{border-color:#854F0B}
.rp-in.bad{border-color:#c62828;box-shadow:0 0 0 1px #c62828}
.rp-in::placeholder{color:var(--t-text-muted);opacity:.7}
.rp-bar{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:10px 12px;border-radius:9px;font-size:12.5px;line-height:1.45}
.rp-bar.bad{background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.22);color:#c62828}
.dark .rp-bar.bad{background:rgba(252,165,165,.1);color:#fca5a5}
.rp-sim{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px}
.rp-sim label{font-size:12.5px;color:var(--t-text-soft)}
.rp-tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(196,125,142,.12);color:var(--t-accent-ink)}
.rp-tw{overflow-x:auto;border:1px solid var(--t-card-border);border-radius:10px}
.rp table{border-collapse:collapse;width:100%;min-width:460px}
.rp th,.rp td{padding:8px 12px;text-align:right;font-size:12.5px;border-bottom:1px solid var(--t-card-border)}
.rp th:first-child,.rp td:first-child{text-align:left}
.rp thead th{font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--t-text-muted);background:rgba(196,125,142,.07)}
.rp tbody tr:last-child td{border-bottom:none}
.rp td.warn{color:#854F0B;font-weight:700}
.dark .rp td.warn{color:#e0a458}
.rp td.ok{color:#0a7d54}
.dark .rp td.ok{color:#6ee7b7}
.rp td.bad{color:#c62828;font-weight:700}
.dark .rp td.bad{color:#fca5a5}
.rp-sw{width:42px;height:24px;border-radius:99px;border:0;background:var(--t-card-border);position:relative;cursor:pointer;padding:0;flex-shrink:0;transition:background .18s}
.rp-sw i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;display:block;transition:transform .18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.rp-sw.on{background:var(--t-accent)}
.rp-sw.on i{transform:translateX(18px)}
.rp-foot{display:flex;justify-content:flex-end;gap:9px}
@media (max-width:640px){
  .rp-row{grid-template-columns:30px 1fr auto;gap:8px}
  .rp-row .rp-f:first-of-type{grid-column:2/-1;justify-content:flex-end}
  .rp-row.band{grid-template-columns:14px 1fr auto}
  .rp-row.band .rp-cnt,.rp-row.band .rp-ceil{display:none}
  .rp-row.head{display:none}
}
`;
