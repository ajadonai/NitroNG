'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import { DEFAULT_USD_RATE } from "../lib/markup";
import { useConfirm } from "./confirm-dialog";
import InlineAlert from "./inline-alert";
import { PlatformIcon } from "./platform-icon";
import { openCardFrame, openCardHeader } from "../lib/expandable-card";

// The whole menu as one list, grouped by platform, with the three tier prices
// on every row so pricing scans without opening anything. An open group takes
// the shared opened-card look; each tier is a row on rails carrying the number
// this page never showed before, its margin. Swap is a first-class action.
const TIERS = ["Budget", "Standard", "Premium"];
const TYPES = ["followers", "likes", "views", "comments", "engagement", "plays", "reviews", "saves", "reposts", "downloads", "traffic", "verified-comments", "shorts", "subscribers", "members", "shares", "impressions", "watchtime"];
const naira = (kobo) => `₦${Math.round(Number(kobo) / 100).toLocaleString("en-NG")}`;
const CH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>;

export default function AdminServiceGroupsPage({ dark, t }) {
  const confirm = useConfirm();
  const [groups, setGroups] = useState([]);
  const [services, setServices] = useState([]);
  const [markupSettings, setMarkupSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [platFilter, setPlatFilter] = useState("all");
  const [ngFilter, setNgFilter] = useState(false);
  const [hideOff, setHideOff] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newG, setNewG] = useState({ name: "", platform: "", type: "followers", nigerian: false });
  const [busy, setBusy] = useState(false);
  // per-tier panels: { [tierId]: 'swap' | 'edit' }, and one add-tier panel per group
  const [panel, setPanel] = useState({});
  const [addFor, setAddFor] = useState(null);
  const [svcQ, setSvcQ] = useState("");
  const [edit, setEdit] = useState({});          // tierId → { price, pinned, customComments, trafficTargeting }
  const [addForm, setAddForm] = useState({ tier: "Standard", serviceId: "", price: "" });
  const [openIds, setOpenIds] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem("nitro_mb_open") || "[]")); } catch { return new Set(); } });
  const persistOpen = (next) => { setOpenIds(next); try { localStorage.setItem("nitro_mb_open", JSON.stringify([...next])); } catch {} };
  const toggleGroup = (id) => { const n = new Set(openIds); n.has(id) ? n.delete(id) : n.add(id); persistOpen(n); };
  const listRef = useRef(null);

  const load = async () => {
    try {
      const [sgRes, stRes] = await Promise.all([fetch("/api/admin/service-groups"), fetch("/api/admin/settings")]);
      if (!sgRes.ok) throw new Error("Failed to load");
      const sg = await sgRes.json();
      setGroups(sg.groups || []); setServices(sg.services || []);
      if (stRes.ok) { const st = await stRes.json(); const ms = {}; Object.entries(st.settings || {}).filter(([k]) => k.startsWith("markup_")).forEach(([k, v]) => { ms[k] = v; }); setMarkupSettings(ms); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const act = async (body) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Action failed"); setBusy(false); return false; }
      await load(); setBusy(false); return true;
    } catch { setError("Request failed"); setBusy(false); return false; }
  };

  const usdRate = Number(markupSettings.markup_usd_rate || DEFAULT_USD_RATE || 1600);
  const costKobo = (svc) => svc?.costPer1k != null ? Math.round(Number(svc.costPer1k) * usdRate) : null;
  const gmPct = (sellKobo, cKobo) => sellKobo > 0 && cKobo != null ? Math.round(((sellKobo - cKobo) / sellKobo) * 100) : null;
  const gmCls = (m) => m == null ? "" : m >= 60 ? "good" : m >= 45 ? "mid" : "low";

  const platforms = useMemo(() => [...new Set(groups.map(g => g.platform))].sort((a, b) => a.localeCompare(b)), [groups]);
  const filtersActive = search !== "" || platFilter !== "all" || ngFilter;
  const isOpen = (g) => filtersActive || openIds.has(g.id);
  const filtered = useMemo(() => {
    let g = groups;
    if (platFilter !== "all") g = g.filter(x => x.platform === platFilter);
    if (ngFilter) g = g.filter(x => x.nigerian);
    if (hideOff) g = g.filter(x => x.enabled);
    if (search) { const q = search.toLowerCase(); g = g.filter(x => x.name.toLowerCase().includes(q) || x.platform.toLowerCase().includes(q) || x.tiers.some(ti => ti.service?.name?.toLowerCase().includes(q) || String(ti.service?.apiId || "").includes(q))); }
    return g;
  }, [groups, platFilter, ngFilter, hideOff, search]);
  const sections = useMemo(() => {
    const by = {};
    for (const g of filtered) (by[g.platform] ||= []).push(g);
    return Object.entries(by).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);
  const svcMatches = useMemo(() => {
    const q = svcQ.trim().toLowerCase();
    const list = q ? services.filter(s => s.name.toLowerCase().includes(q) || String(s.apiId).includes(q)) : services;
    return list.slice(0, 20);
  }, [services, svcQ]);

  useEffect(() => {
    const handler = (e) => { if (filtersActive || openIds.size === 0) return; if (listRef.current && !listRef.current.contains(e.target)) persistOpen(new Set()); };
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler);
  }, [openIds, filtersActive]);

  const startEdit = (ti) => { setEdit({ [ti.id]: { price: String(Math.round(Number(ti.sellPer1k) / 100)), pinned: !!ti.pricePinned, customComments: !!ti.customComments, trafficTargeting: !!ti.trafficTargeting } }); setPanel({ [ti.id]: "edit" }); };
  const saveEdit = async (ti) => {
    const e = edit[ti.id]; if (!e) return;
    const ok = await act({ action: "update-tier", tierIdToUpdate: ti.id, sellPer1k: Math.round(Number(e.price) * 100), pricePinned: e.pinned, customComments: e.customComments, trafficTargeting: e.trafficTargeting });
    if (ok) setPanel({});
  };
  const swapTo = async (ti, svc) => {
    const ok = await act({ action: "update-tier", tierIdToUpdate: ti.id, serviceId: svc.id });
    if (ok) { setPanel({}); setSvcQ(""); }
  };
  const addTier = async (g) => {
    if (!addForm.serviceId) { setError("Pick a service first"); return; }
    const ok = await act({ action: "add-tier", groupId: g.id, serviceId: addForm.serviceId, tier: addForm.tier, sellPer1k: addForm.price ? Math.round(Number(addForm.price) * 100) : 0 });
    if (ok) { setAddFor(null); setAddForm({ tier: "Standard", serviceId: "", price: "" }); setSvcQ(""); }
  };
  const createGroup = async () => {
    if (!newG.name || !newG.platform) { setError("Name and platform required"); return; }
    const ok = await act({ action: "create-group", ...newG });
    if (ok) { setShowNew(false); setNewG({ name: "", platform: "", type: "followers", nigerian: false }); }
  };

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828",
    "--bud": dark ? "#e0a458" : "#854F0B", "--budbg": dark ? "#2d2210" : "#fef7ed", "--std": dark ? "#7aa2f7" : "#185FA5", "--stdbg": dark ? "#0f1e30" : "#eef4fb", "--prm": dark ? "#a78bfa" : "#534AB7", "--prmbg": dark ? "#221535" : "#f5eef5",
    "--ng": dark ? "#4ade80" : "#16a34a", "--ngbg": dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.1)",
  };
  const TC = { Budget: "bud", Standard: "std", Premium: "prm" };
  const totalTiers = groups.reduce((a, g) => a + g.tiers.length, 0);

  const SvcList = ({ onPick, priceKobo }) => (
    <div className="mb-svcs">
      <div className="mb-srch"><span>{SEARCH}</span><input autoFocus value={svcQ} onChange={e => setSvcQ(e.target.value)} placeholder="Search services by name or #id" /></div>
      <div className="mb-svcl">
        {svcMatches.map(s => { const c = costKobo(s); const m = priceKobo ? gmPct(priceKobo, c) : null; return (
          <button type="button" key={s.id} className="mb-svc" onClick={() => onPick(s)}>
            <b className={`mb-prov ${s.provider}`}>{s.provider}</b><span className="mb-sid m">#{s.apiId}</span><span className="mb-sn">{s.name}</span>
            <span className="mb-sm m">{c != null ? naira(c) : "—"}/1k</span>{m != null && <span className={`mb-gm ${gmCls(m)} m`}>{m}%</span>}
          </button>
        ); })}
        {svcMatches.length === 0 && <div className="mb-empty">Nothing matches.</div>}
      </div>
    </div>
  );

  const TierRow = ({ ti, g }) => {
    const c = costKobo(ti.service); const m = gmPct(Number(ti.sellPer1k), c); const p = panel[ti.id]; const e = edit[ti.id];
    const refill = ti.refill && ti.refillDays > 0 ? (ti.refillDays >= 365 ? "Lifetime" : `${ti.refillDays} days`) : "No refill";
    return (
      <div className={`mb-tr${ti.enabled ? "" : " off"}`}>
        <span className={`mb-tchip ${TC[ti.tier] || "std"}`}>{ti.tier}</span>
        <span className="mb-price m">{naira(ti.sellPer1k)}<small>/1k</small>{ti.pricePinned && <i className="mb-lock" title="Pinned: recalculation leaves it alone" />}</span>
        <span className={`mb-gm ${gmCls(m)} m`} title="Gross margin at today's rate">{m == null ? "—" : `${m}%`}</span>
        <span className="mb-svc-cell">
          {ti.service ? <><b className={`mb-prov ${ti.service.provider}`}>{ti.service.provider}</b><span className="mb-sid m">#{ti.service.apiId}</span><span className="mb-sn">{ti.service.name}</span><span className="mb-sm">{c != null ? `${naira(c)}/1k` : ""}{ti.service.min != null ? ` · ${Number(ti.service.min).toLocaleString()}–${Number(ti.service.max).toLocaleString()}` : ""}</span></> : <span className="mb-sn" style={{ color: "var(--bad)" }}>No backing service</span>}
        </span>
        <span className="mb-meta">{refill}<em>{ti.speed || "—"}</em></span>
        <button type="button" className={`mb-tog${ti.enabled ? "" : " o"}`} onClick={() => act({ action: "update-tier", tierIdToUpdate: ti.id, enabled: !ti.enabled })} aria-label={ti.enabled ? "Switch tier off" : "Switch tier on"}><i /></button>
        <span className="mb-acts"><button type="button" className="mb-b sm" onClick={() => { setPanel(p === "swap" ? {} : { [ti.id]: "swap" }); setSvcQ(""); }}>Swap</button><button type="button" className="mb-b sm" onClick={() => p === "edit" ? setPanel({}) : startEdit(ti)}>Edit</button></span>
        {p === "swap" && <div className="mb-panel"><div className="mb-ph">Swap the service behind <b>{g.name} · {ti.tier}</b>. Price stays at {naira(ti.sellPer1k)}; the margin beside each candidate is at that price.</div><SvcList onPick={s => swapTo(ti, s)} priceKobo={Number(ti.sellPer1k)} /></div>}
        {p === "edit" && e && (
          <div className="mb-panel mb-edit">
            <label>Price per 1k <input className="mb-in m" value={e.price} onChange={ev => setEdit({ [ti.id]: { ...e, price: ev.target.value.replace(/[^0-9.]/g, "") } })} /></label>
            <label className="mb-chk"><input type="checkbox" checked={e.pinned} onChange={ev => setEdit({ [ti.id]: { ...e, pinned: ev.target.checked } })} /> Pin price</label>
            {(g.type || "").toLowerCase().includes("comment") && <label className="mb-chk"><input type="checkbox" checked={e.customComments} onChange={ev => setEdit({ [ti.id]: { ...e, customComments: ev.target.checked } })} /> Custom comments</label>}
            {(g.type || "").toLowerCase().includes("traffic") && <label className="mb-chk"><input type="checkbox" checked={e.trafficTargeting} onChange={ev => setEdit({ [ti.id]: { ...e, trafficTargeting: ev.target.checked } })} /> Traffic targeting</label>}
            <span className="mb-spacer" />
            <button type="button" className="mb-b sm danger" onClick={async () => { if (await confirm({ title: "Delete tier", message: `Delete the ${ti.tier} tier from "${g.name}"?`, confirmLabel: "Delete", danger: true })) { const ok = await act({ action: "delete-tier", tierId: ti.id }); if (ok) setPanel({}); } }}>Delete tier</button>
            <button type="button" className="mb-b sm" onClick={() => setPanel({})}>Cancel</button>
            <button type="button" className="mb-pri sm" disabled={busy} onClick={() => saveEdit(ti)}>Save</button>
          </div>
        )}
      </div>
    );
  };

  const Group = ({ g }) => {
    const open = isOpen(g);
    const have = new Set(g.tiers.map(x => x.tier)); const missing = TIERS.filter(x => !have.has(x));
    const tiers = [...g.tiers].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
    return (
      <div className={`mb-grp${g.enabled ? "" : " goff"}`} style={open ? openCardFrame(t, dark) : undefined}>
        <div className="mb-gh" role="button" tabIndex={0} onClick={() => toggleGroup(g.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(g.id); } }} aria-expanded={open} style={open ? openCardHeader(dark) : undefined}>
          <span className={`mb-chev${open ? " up" : ""}`} />
          <span className="mb-gi"><PlatformIcon platform={g.platform} dark={dark} size={30} /></span>
          <span className="mb-gname"><b>{g.name}</b>{g.nigerian && <span className="mb-ng">NG</span>}<span className="mb-gtype">{g.type}</span></span>
          <span className="mb-pills">{tiers.map(ti => <span key={ti.id} className={`mb-pill ${TC[ti.tier] || "std"}${ti.enabled ? "" : " off"}`}><i>{ti.tier[0]}</i>{naira(ti.sellPer1k)}</span>)}{tiers.length === 0 && <span className="mb-pill empty">No tiers</span>}</span>
          <button type="button" className={`mb-tog${g.enabled ? "" : " o"}`} onClick={e => { e.stopPropagation(); act({ action: "update-group", groupId: g.id, enabled: !g.enabled }); }} aria-label={g.enabled ? "Switch group off" : "Switch group on"}><i /></button>
        </div>
        {open && (
          <div className="mb-gb">
            {tiers.map(ti => <TierRow key={ti.id} ti={ti} g={g} />)}
            {addFor === g.id && (
              <div className="mb-panel mb-add">
                <div className="mb-ph">Add a tier to <b>{g.name}</b>. Leave the price blank and it is set from the markup rules.</div>
                <div className="mb-addrow">
                  <span className="mb-segs">{missing.length ? missing.map(x => <button type="button" key={x} className={`mb-seg${addForm.tier === x ? " on" : ""}`} onClick={() => setAddForm(f => ({ ...f, tier: x }))}>{x}</button>) : TIERS.map(x => <button type="button" key={x} className={`mb-seg${addForm.tier === x ? " on" : ""}`} onClick={() => setAddForm(f => ({ ...f, tier: x }))}>{x}</button>)}</span>
                  <input className="mb-in m" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="Price ₦/1k (auto)" />
                </div>
                {addForm.serviceId
                  ? <div className="mb-picked">{(() => { const s = services.find(x => x.id === addForm.serviceId); return s ? <><b className={`mb-prov ${s.provider}`}>{s.provider}</b><span className="mb-sid m">#{s.apiId}</span><span className="mb-sn">{s.name}</span></> : null; })()}<button type="button" className="mb-b sm" onClick={() => setAddForm(f => ({ ...f, serviceId: "" }))}>Change</button></div>
                  : <SvcList onPick={s => setAddForm(f => ({ ...f, serviceId: s.id }))} priceKobo={addForm.price ? Math.round(Number(addForm.price) * 100) : null} />}
                <div className="mb-acts-r"><button type="button" className="mb-b sm" onClick={() => { setAddFor(null); setSvcQ(""); }}>Cancel</button><button type="button" className="mb-pri sm" disabled={busy || !addForm.serviceId} onClick={() => addTier(g)}>Add tier</button></div>
              </div>
            )}
            <div className="mb-gfoot">
              <button type="button" className="mb-addt" onClick={() => { setAddFor(addFor === g.id ? null : g.id); setAddForm({ tier: missing[0] || "Standard", serviceId: "", price: "" }); setSvcQ(""); }}>{missing.length ? `+ Add ${missing[0]} tier` : "+ Add tier"}</button>
              <span className="mb-gacts">
                <button type="button" className="mb-b sm" onClick={() => act({ action: "duplicate-group", groupId: g.id })}>Duplicate</button>
                <button type="button" className="mb-b sm danger" onClick={async () => { if (await confirm({ title: "Delete group", message: `Delete "${g.name}" and all its tiers?`, confirmLabel: "Delete", danger: true })) act({ action: "delete-group", groupId: g.id }); }}>Delete group</button>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Menu Builder</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{groups.length} groups · {totalTiers} tiers · {services.length} services available</div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }} disabled={busy} onClick={async () => { if (await confirm({ title: "Recalculate prices", message: "Recalculate every unpinned tier from the markup rules?", confirmLabel: "Recalculate" })) act({ action: "recalculate-prices" }); }}>Recalculate prices</button>
            <button type="button" className="adm-btn-primary" onClick={() => setShowNew(v => !v)}>{showNew ? "Cancel" : "+ New group"}</button>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      <div className="mb" style={vars}>
        <style>{CSS}</style>
        {error && <InlineAlert type="error" message={error} onClose={() => setError("")} dark={dark} />}
        {showNew && (
          <div className="mb-card mb-new">
            <div className="mb-fld"><label>Group name</label><input className="mb-in" value={newG.name} onChange={e => setNewG(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Instagram Followers" /></div>
            <div className="mb-fld"><label>Platform</label><input className="mb-in" list="mb-platforms" value={newG.platform} onChange={e => setNewG(f => ({ ...f, platform: e.target.value }))} placeholder="e.g. Instagram" /><datalist id="mb-platforms">{platforms.map(p => <option key={p} value={p} />)}</datalist></div>
            <div className="mb-fld"><label>Type</label><select className="mb-in" value={newG.type} onChange={e => setNewG(f => ({ ...f, type: e.target.value }))}>{TYPES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            <label className="mb-chk mb-fld-chk"><input type="checkbox" checked={newG.nigerian} onChange={e => setNewG(f => ({ ...f, nigerian: e.target.checked }))} /> Nigerian audience</label>
            <button type="button" className="mb-pri" disabled={busy || !newG.name || !newG.platform} onClick={createGroup}>Create group</button>
          </div>
        )}
        <div className="mb-bar">
          <label className="mb-srch"><span>{SEARCH}</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups or services" aria-label="Search groups" /></label>
          <span className="mb-sel"><select value={platFilter} onChange={e => setPlatFilter(e.target.value)} aria-label="Platform"><option value="all">All platforms</option>{platforms.map(p => <option key={p} value={p}>{p}</option>)}</select>{CH}</span>
          <button type="button" className={`mb-tgl${ngFilter ? " on" : ""}`} onClick={() => setNgFilter(v => !v)}><i /><span>NG only</span></button>
          <button type="button" className={`mb-tgl${hideOff ? " on" : ""}`} onClick={() => setHideOff(v => !v)}><i /><span>Hide off</span></button>
        </div>
        <div className="mb-list" ref={listRef}>
          {loading && <div className="mb-empty">Loading the menu…</div>}
          {!loading && sections.length === 0 && <div className="mb-empty">Nothing matches.</div>}
          {sections.map(([plat, gs]) => (
            <div key={plat}>
              <div className="mb-sec"><i><PlatformIcon platform={plat} dark={dark} size={13} /></i>{plat}<span>{gs.length} {gs.length === 1 ? "group" : "groups"}</span></div>
              {gs.map(g => <Group key={g.id} g={g} />)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const CSS = `
.mb{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.mb *{box-sizing:border-box}
.mb .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.mb-card{background:var(--card);border:1px solid var(--line);border-radius:14px}
.mb-new{display:grid;grid-template-columns:2fr 1.2fr 1fr auto auto;gap:10px;align-items:end;padding:14px 16px}
.mb-fld{display:flex;flex-direction:column;gap:6px;min-width:0}.mb-fld label{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.mb-in{height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13px;outline:none;min-width:0;width:100%}.mb-in:focus{border-color:var(--ac)}
.mb-chk{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--mut);white-space:nowrap}.mb-chk input{accent-color:var(--ac)}
.mb-fld-chk{height:36px}
.mb-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap}.mb-b.sm{padding:5px 9px;font-size:11.5px}.mb-b.danger{color:var(--bad)}
.mb-pri{font:inherit;font-size:13px;font-weight:800;padding:9px 14px;border-radius:10px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap;height:36px}.mb-pri.sm{height:auto;padding:6px 11px;font-size:12px;box-shadow:none}.mb-pri:disabled{opacity:.45;cursor:default;box-shadow:none}
/* toolbar */
.mb-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mb-srch{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);color:var(--dim);font-size:13px;min-width:250px;flex:1;max-width:420px}.mb-srch svg{width:14px;height:14px}.mb-srch input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:13px}
.mb-sel{position:relative;display:inline-flex;align-items:center;height:36px;border-radius:10px;background:var(--card);border:1px solid var(--line)}.mb-sel select{appearance:none;border:0;background:transparent;color:var(--ink);font:inherit;font-size:13px;font-weight:600;padding:0 30px 0 12px;height:100%;outline:none;cursor:pointer}.mb-sel svg{position:absolute;right:10px;width:13px;height:13px;color:var(--dim);pointer-events:none}
.mb-tgl{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12.5px;font-weight:600;color:var(--mut);background:transparent;border:0;cursor:pointer;padding:0}.mb-tgl:first-of-type{margin-left:auto}
.mb-tgl i{width:30px;height:18px;border-radius:9px;background:var(--line);position:relative;display:inline-block;transition:background .15s}.mb-tgl i::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--card);transition:left .15s}.mb-tgl.on i{background:var(--ac)}.mb-tgl.on i::after{left:14px}.mb-tgl.on{color:var(--ink)}
/* list */
.mb-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.mb-empty{padding:18px 16px;font-size:13px;color:var(--dim)}
.mb-sec{font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);padding:10px 14px 6px;background:var(--soft);border-bottom:1px solid var(--line);display:flex;align-items:center}.mb-sec i{display:inline-flex;margin-right:7px;color:var(--mut)}.mb-sec span{font-weight:600;letter-spacing:0;text-transform:none;color:var(--dim);margin-left:8px}
.mb-grp{border-top:1px solid var(--rail)}.mb-grp.goff{opacity:.55}
.mb-gh{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;min-width:0}
.mb-chev{width:8px;height:8px;border-right:1.5px solid var(--dim);border-bottom:1.5px solid var(--dim);transform:rotate(45deg);flex-shrink:0;margin-right:2px;transition:transform .15s}.mb-chev.up{transform:rotate(-135deg)}
.mb-gi{width:30px;height:30px;border-radius:9px;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.mb-gname{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.mb-gname b{font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mb-gtype{font-size:11px;color:var(--dim)}
.mb-ng{font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:999px;background:var(--ngbg);color:var(--ng)}
.mb-pills{display:flex;gap:5px;flex-shrink:0}.mb-pill{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:600;padding:3px 8px 3px 4px;border-radius:999px;border:1px solid var(--line);color:var(--ink);background:var(--card)}
.mb-pill i{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:Outfit,sans-serif;font-size:9.5px;font-weight:800;font-style:normal;color:#fff}
.mb-pill.bud i{background:var(--bud)}.mb-pill.std i{background:var(--std)}.mb-pill.prm i{background:var(--prm)}.mb-pill.off{opacity:.45;text-decoration:line-through}.mb-pill.empty{color:var(--dim);font-family:Outfit,sans-serif;font-weight:500;padding:3px 8px}
.mb-tog{width:34px;height:20px;border-radius:10px;background:var(--ok);position:relative;flex-shrink:0;display:inline-block;border:0;padding:0;cursor:pointer}.mb-tog i{position:absolute;top:2px;left:16px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.mb-tog.o{background:var(--line)}.mb-tog.o i{left:2px}
/* tier rows */
.mb-gb{background:var(--card)}
.mb-tr{display:grid;grid-template-columns:86px 120px 52px 1fr 108px 34px auto;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--rail);font-size:12.5px}.mb-tr.off>*:not(.mb-acts):not(.mb-tog):not(.mb-panel){opacity:.5}
.mb-tchip{font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 9px;border-radius:999px;text-align:center}.mb-tchip.bud{background:var(--budbg);color:var(--bud)}.mb-tchip.std{background:var(--stdbg);color:var(--std)}.mb-tchip.prm{background:var(--prmbg);color:var(--prm)}
.mb-price{font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:5px}.mb-price small{font-size:10px;color:var(--dim);font-weight:500}
.mb-lock{width:9px;height:11px;border:1.5px solid var(--mut);border-radius:2px;position:relative;display:inline-block}.mb-lock::before{content:"";position:absolute;left:1px;top:-5px;width:4px;height:5px;border:1.5px solid var(--mut);border-bottom:0;border-radius:3px 3px 0 0}
.mb-gm{font-weight:700;font-size:12px;color:var(--dim)}.mb-gm.good{color:var(--ok)}.mb-gm.mid{color:var(--warn)}.mb-gm.low{color:var(--bad)}
.mb-svc-cell{display:grid;grid-template-columns:auto auto 1fr;gap:2px 7px;align-items:center;min-width:0}
.mb-prov{font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:1px 5px;border-radius:5px;color:#fff;background:#6b7280}.mb-prov.mtp{background:#ef4444}.mb-prov.dao{background:#22c55e}.mb-prov.jap{background:#3b82f6}
.mb-sid{font-size:11px;color:var(--dim)}.mb-sn{color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.mb-sm{grid-column:1/-1;font-size:11px;color:var(--dim)}
.mb-meta{font-size:11.5px;color:var(--mut);line-height:1.35;display:flex;flex-direction:column}.mb-meta em{font-style:normal;color:var(--dim)}
.mb-acts{display:flex;gap:4px}
.mb-panel{grid-column:1/-1;margin-top:4px;padding:12px;border-radius:12px;background:var(--soft);border:1px solid var(--line)}
.mb-ph{font-size:12.5px;color:var(--mut);margin-bottom:10px}.mb-ph b{color:var(--ink)}
.mb-edit{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.mb-edit label{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--mut)}.mb-edit .mb-in{width:120px;height:32px}.mb-spacer{flex:1}
.mb-srch.mb-srch{max-width:none}
.mb-svcs .mb-srch{width:100%;margin-bottom:8px}
.mb-svcl{max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.mb-svc{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:8px;align-items:center;width:100%;text-align:left;padding:8px 10px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--ink);font:inherit;font-size:12.5px;cursor:pointer}.mb-svc:first-child{border-top:0}.mb-svc:hover{background:var(--soft)}
.mb-add .mb-addrow{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.mb-add .mb-in{width:170px;height:34px}
.mb-segs{display:inline-flex;gap:3px;padding:3px;border-radius:9px;background:var(--card);border:1px solid var(--line)}.mb-seg{font:inherit;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;border:0;background:transparent;color:var(--mut);cursor:pointer}.mb-seg.on{background:var(--acbg);color:var(--ink)}
.mb-picked{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:12.5px;margin-bottom:10px}.mb-picked .mb-b{margin-left:auto}
.mb-acts-r{display:flex;justify-content:flex-end;gap:6px}
.mb-gfoot{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-top:1px solid var(--rail);background:var(--soft)}
.mb-addt{font:inherit;font-size:12.5px;font-weight:700;color:var(--ac);background:transparent;border:1px dashed var(--acln);border-radius:9px;padding:6px 11px;cursor:pointer}.mb-gacts{display:flex;gap:4px}
@media (max-width:767px){
  .mb-new{grid-template-columns:1fr}
  .mb-bar{gap:8px}.mb-srch{max-width:none;width:100%}.mb-sel{flex:1}.mb-sel select{width:100%}.mb-tgl{margin-left:0!important;flex:1;justify-content:center;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:0 10px}
  .mb-gh{display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:"chev icon name tog" "pills pills pills pills";gap:8px 10px;padding:12px}
  .mb-chev{grid-area:chev}.mb-gi{grid-area:icon}.mb-gname{grid-area:name;flex-wrap:wrap}.mb-gh .mb-tog{grid-area:tog}.mb-pills{grid-area:pills;flex-wrap:wrap}
  .mb-gb{padding:8px;display:flex;flex-direction:column;gap:8px}
  .mb-tr{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"chip price gm" "svc svc svc" "meta meta tog" "acts acts acts" "panel panel panel";gap:8px 10px;padding:11px 12px;border:1px solid var(--line);border-radius:12px}
  .mb-tchip{grid-area:chip}.mb-price{grid-area:price}.mb-gm{grid-area:gm;font-size:13px;text-align:right}.mb-svc-cell{grid-area:svc}.mb-meta{grid-area:meta;flex-direction:row;gap:8px}.mb-tr .mb-tog{grid-area:tog;justify-self:end}.mb-acts{grid-area:acts;padding-top:8px;border-top:1px solid var(--rail)}.mb-panel{grid-area:panel;margin-top:0}
  .mb-gfoot{flex-wrap:wrap;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid var(--line)}.mb-addt{flex:1;text-align:center}.mb-gacts{width:100%}.mb-gacts .mb-b{flex:1}
}
`;
