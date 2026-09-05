'use client';
import { useState, useEffect, useRef } from "react";
import { Bone } from "./skeleton";
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
const DEFAULTS = { brackets: DEF_BRACKETS, floorPct: 50, floorCeiling: 5000, ngBonus: 25, resellerDiscount: 20, usdBuffer: 200, fxThreshold: 20, tierMults: { Budget: 1, Standard: 1.15, Premium: 1.35 }, provBonuses: { mtp: 0, dao: 0, jap: 0 } };
const COLORS = ["#34d399", "#6ee7b7", "#60a5fa", "#a78bfa", "#e0a458", "#c47d8e"];
const PROV = [["mtp", "MoreThanPanel"], ["dao", "DaoSMM"], ["jap", "JAP"]];
const naira = (v) => `₦${Math.round(Number(v || 0)).toLocaleString()}`;
const range = (b) => `${naira(b.min)} – ${!b.max || b.max >= 999999999 ? "∞" : naira(b.max)}`;

function calcSell(cost, brackets, floorPct, floorCeiling) {
  if (!brackets || !brackets.length) return 0;
  const b = brackets.find(x => cost >= x.min && cost < x.max) || brackets[brackets.length - 1];
  let sell = Math.round(cost * b.multiplier);
  const clamped = Math.min(floorPct, 99);
  if (cost < floorCeiling && clamped > 0) { const min = Math.round(cost / (1 - clamped / 100)); if (sell < min) sell = min; }
  return sell;
}
function bracketOf(cost, brackets) { return brackets.find(x => cost >= x.min && cost < x.max) || brackets[brackets.length - 1]; }

/* Number input, defined outside the page so React keeps it mounted between renders. */
function NumInput({ value, onChange, min = 0, max = 999999, fallback, width = 64, decimal, className = "" }) {
  const [raw, setRaw] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setRaw(String(value)); }, [value]);
  return <input value={raw} inputMode={decimal ? "decimal" : "numeric"} className={`pr-in m ${className}`} style={{ width }}
    onFocus={() => { focused.current = true; }}
    onChange={e => { const v = e.target.value; if (v === "" || (decimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/).test(v)) { setRaw(v); const n = decimal ? parseFloat(v) : parseInt(v, 10); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))); } }}
    onBlur={() => { focused.current = false; const n = decimal ? parseFloat(raw) : parseInt(raw, 10); if (isNaN(n) || raw === "") { const fb = fallback !== undefined ? fallback : min; onChange(fb); setRaw(String(fb)); } else { const c = Math.min(max, Math.max(min, n)); onChange(c); setRaw(String(c)); } }} />;
}

/* Same behaviour as SettingsModal: the page behind is locked, the backdrop closes. */
function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="pr-ov" onClick={onClose}>
      <div className="pr-md" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="pr-mh"><b>{title}</b><button type="button" className="pr-x" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="pr-mb">{children}</div>
        {footer && <div className="pr-mf">{footer}</div>}
      </div>
    </div>
  );
}

/* A labelled setting row. Lives outside the page so the input inside keeps focus between renders. */
function Row({ label, hint, children }) {
  return <div className="pr-row"><span><b>{label}</b>{hint && <i>{hint}</i>}</span><span className="pr-ctl">{children}</span></div>;
}

const ICONS = {
  br: <path d="M3 6h18M3 12h12M3 18h6" />,
  fl: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  ti: <path d="M4 20h16M6 16l4-8 4 5 4-9" />,
  ng: <><circle cx="12" cy="12" r="9" /><path d="M12 3a15 15 0 010 18M3 12h18" /></>,
  pv: <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />,
  rs: <><path d="M20 7h-9M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>,
  fx: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  rc: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></>,
};

export default function AdminPricingPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [s, setS] = useState(DEFAULTS);
  const [usdMarket, setUsdMarket] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(null);       // which card's modal is up
  const [draft, setDraft] = useState(null);     // a copy of the settings being edited
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [simCost, setSimCost] = useState(500);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (!d.settings) return; const v = d.settings; const next = { ...DEFAULTS };
      try { if (v.markup_brackets) next.brackets = JSON.parse(v.markup_brackets).map(b => ({ ...b, max: b.max == null ? 999999999 : b.max })); } catch {}
      if (v.markup_margin_floor) next.floorPct = Number(v.markup_margin_floor);
      if (v.markup_floor_ceiling) next.floorCeiling = Number(v.markup_floor_ceiling);
      if (v.markup_ng_bonus) next.ngBonus = Number(v.markup_ng_bonus);
      if (v.markup_reseller_discount) next.resellerDiscount = Number(v.markup_reseller_discount);
      if (v.markup_usd_buffer) next.usdBuffer = Number(v.markup_usd_buffer);
      if (v.markup_fx_threshold) next.fxThreshold = Number(v.markup_fx_threshold);
      try { if (v.markup_tier_multipliers) next.tierMults = JSON.parse(v.markup_tier_multipliers); } catch {}
      next.provBonuses = { mtp: Number(v.markup_provider_bonus_mtp || 0), dao: Number(v.markup_provider_bonus_dao || 0), jap: Number(v.markup_provider_bonus_jap || 0) };
      if (v.markup_usd_market) setUsdMarket(Number(v.markup_usd_market));
      setS(next); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const pack = (v) => ({
    markup_brackets: JSON.stringify(v.brackets), markup_margin_floor: String(v.floorPct), markup_floor_ceiling: String(v.floorCeiling),
    markup_ng_bonus: String(v.ngBonus), markup_reseller_discount: String(v.resellerDiscount), markup_usd_buffer: String(v.usdBuffer), markup_fx_threshold: String(v.fxThreshold),
    markup_tier_multipliers: JSON.stringify(v.tierMults),
    markup_provider_bonus_mtp: String(v.provBonuses.mtp || 0), markup_provider_bonus_dao: String(v.provBonuses.dao || 0), markup_provider_bonus_jap: String(v.provBonuses.jap || 0),
  });
  const persist = async (next) => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack(next) }) });
      if (!r.ok) throw new Error();
      setS(next); toast.success("Saved", "Menu prices change when you reprice"); setOpen(null); setDraft(null);
    } catch { toast.error("Not saved", "Check your connection and try again"); }
    setSaving(false);
  };
  const openCard = (id) => { setDraft(JSON.parse(JSON.stringify(s))); setOpen(id); };
  const close = () => { setOpen(null); setDraft(null); };
  const d = (patch) => setDraft(p => ({ ...p, ...patch }));

  const recalc = async () => {
    const ok = await confirm({ title: "Reprice the whole menu?", message: "Every tier price is worked out again from these settings. Prices you have pinned stay as they are; every other price changes.", confirmLabel: "Reprice", danger: true });
    if (!ok) return;
    setRecalcing(true);
    try {
      await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: pack(s) }) });
      const r = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate-prices" }) });
      const res = await r.json();
      if (r.ok) toast.success("Repriced", `${res.updated || 0} tiers changed`); else toast.error("Failed", res.error || "");
    } catch { toast.error("Request failed", "Check your connection"); }
    setRecalcing(false);
  };
  const reset = async () => {
    const ok = await confirm({ title: "Back to the defaults?", message: "Every setting on this page goes back to its default and is saved. Menu prices change when you next reprice.", confirmLabel: "Reset", danger: true });
    if (ok) persist(DEFAULTS);
  };

  // Simulator, always on the saved settings
  const usdRate = usdMarket + s.usdBuffer;
  const base = calcSell(simCost, s.brackets, s.floorPct, s.floorCeiling);
  const sb = bracketOf(simCost, s.brackets);
  const bud = Math.round(base * (s.tierMults.Budget || 1)), std = Math.round(base * (s.tierMults.Standard || 1.15)), prm = Math.round(base * (s.tierMults.Premium || 1.35));
  const ng = Math.round(std * (1 + s.ngBonus / 100)), reseller = Math.ceil(std * (1 - s.resellerDiscount / 100));
  const kept = std > 0 ? Math.round((std - simCost) / std * 100) : 0;
  const profit = simCost > 0 ? Math.round((std - simCost) / simCost * 100) : 0;
  const floorNote = simCost >= s.floorCeiling ? `Not checked, cost is above ${naira(s.floorCeiling)}` : kept >= s.floorPct ? `Passed · ${kept}% kept` : `Raised to keep ${s.floorPct}%`;

  const vars = {
    "--card": dark ? "#171126" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--badbg": dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)",
    "--bud": dark ? "#e0a458" : "#854F0B", "--std": dark ? "#7aa2f7" : "#185FA5", "--stdbg": dark ? "#0f1e30" : "#eef4fb", "--prm": dark ? "#a78bfa" : "#534AB7",
  };
  const pct = (v) => `${Math.round((v - 1) * 100)}%`;
  const cards = [
    { id: "br", title: "Price bands", sub: `Cheap services get a bigger markup than dear ones. ${s.brackets.length} bands, from ${s.brackets[0]?.multiplier}× on the cheapest to ${s.brackets[s.brackets.length - 1]?.multiplier}× on the dearest.` },
    { id: "fl", title: "Minimum profit", sub: `On any service that costs under ${naira(s.floorCeiling)} per 1k, at least ${s.floorPct}% of the price is profit, whatever the band says.` },
    { id: "ti", title: "Tier prices", sub: `Standard costs ${pct(s.tierMults.Standard || 1)} more than Budget. Premium costs ${pct(s.tierMults.Premium || 1)} more.` },
    { id: "ng", title: "Nigerian services", sub: `Priced ${s.ngBonus}% higher than the same service worldwide.` },
    { id: "pv", title: "Provider discounts", sub: PROV.filter(([k]) => s.provBonuses[k]).length ? `Extra ${PROV.filter(([k]) => s.provBonuses[k]).map(([k, n]) => `${s.provBonuses[k]}% kept on ${n}`).join(", ")}.` : "Nothing extra kept on any provider." },
    { id: "rs", title: "Reseller discount", sub: `Resellers pay ${s.resellerDiscount}% less than the site price on every order.` },
    { id: "fx", title: "Dollar rate", sub: usdMarket ? `${naira(usdRate)} to the dollar today: the market rate plus a ${naira(s.usdBuffer)} cushion. Checked every morning.` : `A ${naira(s.usdBuffer)} cushion on the market rate. Checked every morning.` },
    { id: "rc", title: "Reprice the menu", sub: "Work every menu price out again with these settings. Prices you have pinned are left as they are.", danger: true },
  ];
  const foot = (onSave) => <><button type="button" className="pr-b ghost" onClick={close}>Cancel</button><button type="button" className="pr-pri" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save"}</button></>;

  return (
    <div className="pr" style={vars}>
      <style>{CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Pricing</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>How what we pay a provider becomes what a customer pays. Tap a card to change it.</div>
          </div>
          <button type="button" className="pr-b ghost" onClick={reset}>Reset to defaults</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="pr-grid">
        {cards.map(c => (
          <div key={c.id} className={"pr-sc" + (c.danger ? " danger" : "") + (open === c.id ? " on" : "")} role="button" tabIndex={0}
            onClick={() => c.id === "rc" ? recalc() : openCard(c.id)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}>
            <span className="pr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[c.id]}</svg></span>
            <span className="pr-st"><b>{c.title}</b><i>{!loaded ? <Bone dark={dark} w="62%" h={9} style={{ display: "inline-block", verticalAlign: "middle" }} /> : c.id === "rc" && recalcing ? "Repricing…" : c.sub}</i></span>
            <svg className="pr-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        ))}
      </div>

      <div className="pr-tools">
        <section className="pr-card">
          <header><h3>Try a cost</h3><span className="pr-cnt">see what a service would sell for</span></header>
          <div className="pr-cb">
            <Row label="Provider cost per 1k" hint="Recalculates as you type"><em className="pr-u">₦</em><NumInput value={simCost} onChange={setSimCost} min={0} max={999999} fallback={500} width={90} /></Row>
            <div className="pr-tp">
              <div className="pr-t bud"><span>Budget</span><b className="m">{naira(bud)}</b></div>
              <div className="pr-t std on"><span>Standard</span><b className="m">{naira(std)}</b></div>
              <div className="pr-t prm"><span>Premium</span><b className="m">{naira(prm)}</b></div>
            </div>
            <div className="pr-sr"><span>Band</span><b><i className="pr-dot" style={{ background: COLORS[s.brackets.indexOf(sb)] || COLORS[5] }} />{sb?.label} · ×{sb?.multiplier}</b></div>
            <div className="pr-sr"><span>Minimum profit check</span><b className={kept >= s.floorPct || simCost >= s.floorCeiling ? "good" : "low"}>{floorNote}</b></div>
            <div className="pr-sr"><span>Nigerian, Standard</span><b className="m">{naira(ng)}</b></div>
            <div className="pr-sr"><span>Reseller pays, Standard</span><b className="m">{naira(reseller)}</b></div>
            <div className="pr-sr"><span>Profit on cost, Standard</span><b className={"m " + (profit >= 50 ? "good" : "low")}>{profit}%</b></div>
            <div className="pr-steps">
              <span className="pr-lbl">Worked out as</span>
              <ol>
                <li>Cost <b className="m">{naira(simCost)}</b> falls in <b>{sb?.label}</b> ({sb ? range(sb) : "—"})</li>
                <li>× {sb?.multiplier} gives the base <b className="m">{naira(base)}</b>{base > Math.round(simCost * (sb?.multiplier || 1)) ? ", raised by the minimum profit rule" : ""}</li>
                <li>Tiers ×{s.tierMults.Budget || 1} · ×{s.tierMults.Standard || 1.15} · ×{s.tierMults.Premium || 1.35}</li>
                <li>🇳🇬 adds {s.ngBonus}% → <b className="m">{naira(ng)}</b>; resellers take {s.resellerDiscount}% off → <b className="m">{naira(reseller)}</b></li>
              </ol>
            </div>
          </div>
        </section>
        <section className="pr-card">
          <header><h3>Quick reference</h3><span className="pr-cnt">what common services sell for today</span></header>
          <div className="pr-cb">
            {[["Views", 2], ["Likes", 50], ["Followers", 800], ["Premium followers", 3000], ["Custom comments", 12000], ["Reviews", 50000]].map(([name, cost]) => {
              const sell = calcSell(cost, s.brackets, s.floorPct, s.floorCeiling); const k = sell ? Math.round((sell - cost) / sell * 100) : 0;
              return <div key={name} className="pr-qr"><i className="pr-dot" style={{ background: COLORS[s.brackets.indexOf(bracketOf(cost, s.brackets))] || COLORS[5] }} /><span className="pr-qn">{name}</span><span className="m pr-qc">{naira(cost)}</span><span className="pr-ar">→</span><span className="m pr-qs">{naira(sell)}</span><span className={"m pr-qm " + (k >= s.floorPct ? "good" : "low")}>{k}%</span></div>;
            })}
          </div>
        </section>
      </div>

      {draft && (
        <>
          <Modal open={open === "br"} onClose={close} title="Price bands" footer={<><span className="pr-hint pr-mfh">Saving keeps the rule. Menu prices only change when you reprice.</span>{foot(() => persist(draft))}</>}>
            <p className="pr-hint">Find the band the provider cost falls in and multiply. Cheap services can carry a big markup because nobody notices ₦20 becoming ₦200; dear ones stay close to the market.</p>
            <div className="pr-bh"><span /><span>Provider cost per 1k</span><span>Band</span><span>Example</span><span className="r">Multiply by</span></div>
            {draft.brackets.map((b, i) => {
              const ex = b.min === 0 ? 10 : b.min;
              return <div key={i} className="pr-br"><i className="pr-dot" style={{ background: COLORS[i] }} /><span className="pr-rg m">{range(b)}</span><span className="pr-lb">{b.label}</span><span className="pr-ex m">{naira(ex)} → {naira(Math.round(ex * b.multiplier))}</span><span className="pr-ctl"><NumInput value={b.multiplier} decimal min={1} max={10} fallback={1} onChange={v => { const n = [...draft.brackets]; n[i] = { ...b, multiplier: v }; d({ brackets: n }); }} /><em className="pr-u">×</em></span></div>;
            })}
          </Modal>
          <Modal open={open === "fl"} onClose={close} title="Minimum profit" footer={foot(() => persist(draft))}>
            <p className="pr-hint">A safety net for cheap services: if the band would leave less than this, the price is raised until it does not.</p>
            <Row label="Keep at least" hint="Share of the price that is profit"><NumInput value={draft.floorPct} onChange={v => d({ floorPct: v })} min={0} max={90} fallback={50} /><em className="pr-u">%</em></Row>
            <Row label="Only on services costing under" hint="Dearer services use the band as it is"><em className="pr-u">₦</em><NumInput value={draft.floorCeiling} onChange={v => d({ floorCeiling: v })} min={0} max={999999} fallback={5000} width={84} /></Row>
          </Modal>
          <Modal open={open === "ti"} onClose={close} title="Tier prices" footer={foot(() => persist(draft))}>
            <p className="pr-hint">Multiplied onto the band price, so Budget is always cheapest and Premium always dearest.</p>
            {[["Budget", "bud", "The base price", 1], ["Standard", "std", "What most people pick", 1.15], ["Premium", "prm", "Best quality, dearest", 1.35]].map(([k, cls, hint, fb]) => (
              <Row key={k} label={<span className={`pr-tc ${cls}`}>{k}</span>} hint={hint}><NumInput value={draft.tierMults[k] || 1} decimal min={0.5} max={5} fallback={fb} onChange={v => d({ tierMults: { ...draft.tierMults, [k]: v } })} /><em className="pr-u">×</em></Row>
            ))}
          </Modal>
          <Modal open={open === "ng"} onClose={close} title="Nigerian services" footer={foot(() => persist(draft))}>
            <p className="pr-hint">Local followers and likes look real and do better with the platforms, so they carry a premium.</p>
            <Row label="Priced higher by" hint="Added to the finished price"><NumInput value={draft.ngBonus} onChange={v => d({ ngBonus: v })} min={0} max={200} fallback={25} /><em className="pr-u">%</em></Row>
          </Modal>
          <Modal open={open === "pv"} onClose={close} title="Provider discounts" footer={foot(() => persist(draft))}>
            <p className="pr-hint">When a provider gives us a volume discount, keep it: prices to customers stay the same and the margin on that provider grows.</p>
            {PROV.map(([k, n]) => <Row key={k} label={n} hint={k === "jap" ? "Being retired" : k === "mtp" ? "Main provider" : "Second provider"}><NumInput value={draft.provBonuses[k] || 0} decimal min={0} max={50} fallback={0} onChange={v => d({ provBonuses: { ...draft.provBonuses, [k]: v } })} /><em className="pr-u">%</em></Row>)}
          </Modal>
          <Modal open={open === "rs"} onClose={close} title="Reseller discount" footer={foot(() => persist(draft))}>
            <p className="pr-hint">Taken off the finished price, after everything else, so it can only ever remove this much and never gets near cost. Applies to the curated and the full catalogue.</p>
            <Row label="Resellers pay less by" hint={`Standard on the cost you are trying: ${naira(Math.ceil(std * (1 - (draft.resellerDiscount || 0) / 100)))}`}><NumInput value={draft.resellerDiscount} onChange={v => d({ resellerDiscount: v })} min={0} max={90} fallback={20} /><em className="pr-u">%</em></Row>
          </Modal>
          <Modal open={open === "fx"} onClose={close} title="Dollar rate" footer={foot(() => persist(draft))}>
            <Row label="Market rate this morning" hint="Fetched automatically"><b className="m">{usdMarket ? naira(usdMarket) : "—"}</b></Row>
            <Row label="Cushion on top" hint="Covers the rate moving between checks"><em className="pr-u">₦</em><NumInput value={draft.usdBuffer} onChange={v => d({ usdBuffer: v })} min={0} max={1000} fallback={200} width={76} /></Row>
            <Row label="Ignore moves smaller than" hint="So prices do not twitch every day"><em className="pr-u">₦</em><NumInput value={draft.fxThreshold} onChange={v => d({ fxThreshold: v })} min={1} max={500} fallback={20} width={68} /></Row>
            <div className="pr-tot"><span>Rate used for every price</span><b className="m">{naira(usdMarket + (draft.usdBuffer || 0))}<small> / $1</small></b></div>
          </Modal>
        </>
      )}
    </div>
  );
}

const CSS = `
.pr{display:flex;flex-direction:column;gap:16px;color:var(--ink)}
.pr *{box-sizing:border-box}
.pr .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pr .r{text-align:right}
.pr-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;transition:transform .15s}
.pr-b:hover{transform:translateY(-1px)}.pr-b.ghost{background:transparent;color:var(--mut)}
.pr-pri{font:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap}.pr-pri:disabled{opacity:.5;cursor:not-allowed}
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pr-sc{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line);cursor:pointer;outline:none;transition:transform .15s}
.pr-sc:hover{background:var(--soft);transform:translateY(-1px)}.pr-sc.on{background:var(--acbg)}.pr-sc:focus-visible{box-shadow:0 0 0 2px var(--acln)}
.pr-ic{width:36px;height:36px;border-radius:10px;background:var(--acbg);color:var(--ac);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.pr-ic svg{width:16px;height:16px}
.pr-sc.danger .pr-ic{background:var(--badbg);color:var(--bad)}
.pr-st{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.pr-st b{font-size:14px;font-weight:600}.pr-st i{font-style:normal;font-size:12.5px;color:var(--mut);line-height:1.4}
.pr-chev{width:16px;height:16px;color:var(--mut);flex-shrink:0}
.pr-tools{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.pr-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pr-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.pr-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.pr-cnt{font-size:11.5px;color:var(--dim)}
.pr-cb{padding:4px 16px 12px;display:flex;flex-direction:column}
.pr-in{height:32px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);text-align:right;outline:none}.pr-in:focus{border-color:var(--acln)}
.pr-u{font-style:normal;font-size:12px;color:var(--mut);margin:0 6px}.pr-ctl{display:inline-flex;align-items:center;flex-shrink:0}
.pr-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--rail);font-size:13.5px}.pr-row:first-child,.pr-hint+.pr-row{border-top:0}
.pr-row>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}.pr-row b{font-weight:600}.pr-row i{font-style:normal;font-size:12px;color:var(--mut)}
.pr-tc.bud{color:var(--bud)}.pr-tc.std{color:var(--std)}.pr-tc.prm{color:var(--prm)}
.pr-tot{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0 4px;border-top:1px solid var(--line);margin-top:4px}.pr-tot span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.pr-tot b{font-size:22px;font-weight:800;color:var(--ac)}.pr-tot small{font-size:12px;color:var(--mut);font-weight:500}
.pr-tp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 6px}.pr-t{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:11px;border:1px solid var(--line)}.pr-t span{font-size:11px;font-weight:800;letter-spacing:.3px}.pr-t b{font-size:16px;font-weight:700}
.pr-t.bud span{color:var(--bud)}.pr-t.std span{color:var(--std)}.pr-t.prm span{color:var(--prm)}.pr-t.on{background:var(--stdbg);border-color:var(--std);box-shadow:0 0 0 1px var(--std)}.pr-t.std.on b{color:var(--std)}
.pr-sr{display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;border-top:1px solid var(--rail)}.pr-sr span{color:var(--mut)}.pr-sr b{font-weight:600;display:inline-flex;align-items:center;gap:6px;text-align:right}.pr .good{color:var(--ok)}.pr .low{color:var(--bad)}
.pr-dot{width:8px;height:8px;border-radius:2px;display:inline-block;flex-shrink:0}
.pr-steps{margin-top:10px;padding:10px 12px;border-radius:11px;background:var(--soft);border:1px solid var(--line)}.pr-lbl{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--mut)}.pr-steps ol{padding-left:18px;margin:6px 0 0;font-size:12.5px;line-height:1.6;color:var(--mut)}.pr-steps b{color:var(--ink);font-weight:600}
.pr-qr{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--rail);font-size:13px}.pr-qr:first-child{border-top:0}.pr-qn{flex:1;font-weight:500}.pr-qc{color:var(--mut);width:70px;text-align:right}.pr-ar{color:var(--dim)}.pr-qs{width:76px;text-align:right;font-weight:700;color:var(--ac)}.pr-qm{width:38px;text-align:right;font-size:12px;font-weight:600}
.pr-ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}
.pr-md{width:100%;max-width:560px;max-height:100%;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 48px rgba(0,0,0,.3);display:flex;flex-direction:column;color:var(--ink)}
.pr-mh{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line)}.pr-mh b{font-size:16px;font-weight:700}
.pr-x{background:none;border:0;color:var(--mut);cursor:pointer;font-size:14px;padding:4px}
.pr-mb{padding:12px 20px;display:flex;flex-direction:column;overflow:auto}
.pr-hint{margin:0 0 6px;font-size:12.5px;color:var(--mut);line-height:1.5}
.pr-mf{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--line)}.pr-mfh{margin:0 auto 0 0}
.pr-bh,.pr-br{display:grid;grid-template-columns:14px 140px 1fr 130px 100px;gap:10px;align-items:center}
.pr-bh{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);padding:8px 0 6px}.pr-bh .r,.pr-br .pr-ctl{justify-self:end}
.pr-br{padding:8px 0;border-top:1px solid var(--rail);font-size:13px}.pr-lb{color:var(--mut)}.pr-ex{color:var(--mut);font-size:12.5px}
@media (max-width:900px){
  .pr-grid,.pr-tools{grid-template-columns:1fr}
  .pr-ov{padding:0;align-items:flex-end}.pr-md{border-radius:20px 20px 0 0;max-height:92%}
  .pr-bh{display:none}.pr-br{grid-template-columns:14px 1fr auto;grid-template-areas:"dot rg ctl" ". lb ex";row-gap:2px}.pr-br .pr-dot{grid-area:dot}.pr-rg{grid-area:rg}.pr-lb{grid-area:lb;font-size:12px}.pr-ex{grid-area:ex;justify-self:end}.pr-br .pr-ctl{grid-area:ctl}
  .pr-mfh{display:none}
}
`;
