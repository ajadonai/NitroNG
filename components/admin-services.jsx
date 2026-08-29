'use client';
import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { FilterDropdown } from "./date-range-picker";
import { serviceDisplay } from "../lib/service-display";

const PROV = { mtp: "MTP", dao: "DAO", jap: "JAP" };
const naira = (v) => `₦${Math.round(Number(v || 0)).toLocaleString()}`;
const short = (v) => v >= 1e6 ? `${Math.round(v / 1e6)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v || 0);
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>;
const CHEV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;

export default function AdminServicesPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const fetchServices = useCallback(() => {
    fetch("/api/admin/services").then(r => r.json()).then(d => { setServices(d.services || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { fetchServices(); }, [fetchServices]);
  useEffect(() => {
    const iv = setInterval(fetchServices, 30000);
    const onVis = () => { if (document.visibilityState === "visible") fetchServices(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchServices]);

  const categories = [...new Set(services.map(s => s.category))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const providers = [...new Set(services.map(s => s.provider || "mtp"))];
  const sensitive = services.some(s => s.costPer1k != null);
  const activeCount = services.filter(s => s.enabled).length;
  const inUseCount = services.filter(s => s.tiers > 0).length;
  const inUseDisabledCount = services.filter(s => s.tiers > 0 && !s.enabled).length;

  const filtered = services.filter(s => {
    if (providerFilter !== "all" && (s.provider || "mtp") !== providerFilter) return false;
    if (statusFilter === "active" && !s.enabled) return false;
    if (statusFilter === "inactive" && s.enabled) return false;
    if (statusFilter === "in-use" && s.tiers === 0) return false;
    if (statusFilter === "in-use-disabled" && !(s.tiers > 0 && !s.enabled)) return false;
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase().replace(/^#/, "");
      return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || String(s.apiId) === q;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const post = async (body) => {
    const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const syncPrices = async () => {
    setSyncingPrices(true);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync-prices" }) });
      const data = await res.json();
      if (res.ok) { toast.success("Prices synced", `${data.updated} costs updated · ${data.repriced} repriced · ${data.losers} below cost`); fetchServices(); }
      else toast.error("Sync failed", data.error || "Price sync failed");
    } catch { toast.error("Request failed", "Check your connection"); }
    setSyncingPrices(false);
  };

  const syncEnable = async () => {
    setSyncing(true);
    try {
      const { ok, data } = await post({ action: "sync-enable" });
      if (ok) { toast.success("Done", data.message); fetchServices(); } else toast.error("Sync failed", data.error || "Sync failed");
    } catch { toast.error("Request failed", "Check your connection"); }
    setSyncing(false);
  };

  const toggleEnabled = async (s) => {
    const ok = await confirm({
      title: s.enabled ? "Switch this service off?" : "Switch this service on?",
      message: s.enabled ? `"${serviceDisplay(s.name).title}" stops being orderable${s.tiers > 0 ? ` and the ${s.tiers} menu tier${s.tiers > 1 ? "s" : ""} behind it will fail` : ""}.` : `"${serviceDisplay(s.name).title}" becomes orderable again.`,
      confirmLabel: s.enabled ? "Switch off" : "Switch on",
      danger: s.enabled,
    });
    if (!ok) return;
    try {
      const { ok: fine, data } = await post({ action: "toggle", serviceId: s.id });
      if (fine) { setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: data.enabled } : x)); if (data.cascaded) toast.success("Done", data.message); }
    } catch {}
  };

  const startEdit = (s) => { setEditMode(s.id); setEditData({ name: s.name, category: s.category, min: s.min, max: s.max, refill: s.refill, avgTime: s.avgTime || "" }); };
  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const { ok, data } = await post({ action: "edit", serviceId: id, ...editData });
      if (ok) { setServices(prev => prev.map(s => s.id === id ? { ...s, ...data.service } : s)); setEditMode(null); toast.success("Saved", "Service updated"); }
      else toast.error("Failed", data.error || "Failed to save");
    } catch { toast.error("Request failed", "Check your connection"); }
    setSaving(false);
  };

  const deleteService = async (s) => {
    const ok = await confirm({ title: "Delete this service?", message: `"${serviceDisplay(s.name).title}" is removed from the list. If it has orders it is switched off instead.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      const { ok: fine, data } = await post({ action: "delete", serviceId: s.id });
      if (!fine) { toast.error("Failed", data.error || "Failed to delete"); return; }
      if (data.deleted) { setServices(prev => prev.filter(x => x.id !== s.id)); toast.success("Deleted", "Service removed"); }
      else if (data.disabled) { setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: false } : x)); toast.success("Switched off", data.message); }
    } catch { toast.error("Request failed", "Check your connection"); }
  };

  const setFilter = (fn) => (v) => { fn(v); setPage(1); };
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--okbg": dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", "--warn": dark ? "#fcd34d" : "#b45309",
    "--bad": dark ? "#fca5a5" : "#c62828", "--badbg": dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", "--blue": dark ? "#a5b4fc" : "#4c62c4", "--bluebg": dark ? "rgba(122,162,247,.18)" : "rgba(122,162,247,.14)",
  };
  const bone = (w, h = 12) => <i className={`rs-bone skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ width: w, height: h }} />;

  return (
    <div className="rs" style={vars}>
      <style>{CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Raw services</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Everything the providers list. The menu picks from here.</div>
          </div>
          <div className="rs-hb">
            {inUseDisabledCount > 0 && <button type="button" className="rs-b warn" disabled={syncing} onClick={syncEnable}>{syncing ? "Working…" : `Switch on ${inUseDisabledCount} in use`}</button>}
            <button type="button" className="rs-b" disabled={syncingPrices} onClick={syncPrices}>{syncingPrices ? "Syncing…" : "Sync prices"}</button>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="rs-stats">
        <div className="rs-stt"><b className="m">{loading ? "—" : services.length.toLocaleString()}</b><span>Services</span><i>{loading ? " " : `from ${providers.length} provider${providers.length === 1 ? "" : "s"}`}</i></div>
        <div className="rs-stt"><b className="m">{loading ? "—" : activeCount.toLocaleString()}</b><span>Switched on</span><i>{loading ? " " : `${(services.length - activeCount).toLocaleString()} off`}</i></div>
        <div className="rs-stt"><b className="m">{loading ? "—" : inUseCount.toLocaleString()}</b><span>In the menu</span><i>{loading ? " " : "behind a tier"}</i></div>
        <div className={"rs-stt" + (inUseDisabledCount ? " warn" : "")}><b className="m">{loading ? "—" : inUseDisabledCount}</b><span>In use but off</span><i>{loading ? " " : inUseDisabledCount ? "needs a look" : "all good"}</i></div>
      </div>

      <div className="rs-bar">
        <div className="rs-srch">
          <span className="rs-si">{SEARCH}</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, platform or #id" />
          {search && <button type="button" className="rs-x" onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search">✕</button>}
        </div>
        {providers.length > 1 && (
          <FilterDropdown dark={dark} t={t} value={providerFilter} onChange={setFilter(setProviderFilter)} options={[{ value: "all", label: "All providers" }, ...providers.map(p => ({ value: p, label: PROV[p] || p.toUpperCase() }))]} />
        )}
        <FilterDropdown dark={dark} t={t} value={statusFilter} onChange={setFilter(setStatusFilter)} options={[["all", "On and off"], ["active", "Switched on"], ["inactive", "Switched off"], ["in-use", "In the menu"], ...(inUseDisabledCount > 0 ? [["in-use-disabled", "In use but off"]] : [])].map(([value, label]) => ({ value, label }))} />
        <FilterDropdown dark={dark} t={t} value={catFilter} onChange={setFilter(setCatFilter)} options={[{ value: "all", label: "All platforms" }, ...categories.map(c => ({ value: c, label: c }))]} />
        <span className="rs-cnt rs-count">{loading ? "" : `${filtered.length.toLocaleString()} service${filtered.length === 1 ? "" : "s"}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}`}</span>
      </div>

      <div className="rs-list">
        <div className="rs-sh"><span>Service</span><span>Platform</span>{sensitive && <span className="r">Cost / 1k</span>}<span className="r">Orders</span><span className="r">Min – max</span><span /><span /></div>
        {loading ? Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rs-sr sk">
            <span className="rs-sn">{bone("55%", 13)}{bone("35%", 10)}</span><span>{bone(64)}</span>{sensitive && <span className="r">{bone(52)}</span>}<span className="r">{bone(36)}</span><span className="r">{bone(70)}</span><span>{bone(34, 20)}</span><span />
          </div>
        )) : paged.length === 0 ? (
          <div className="rs-empty">{services.length === 0 ? "No services yet. They appear once a provider is synced." : "Nothing matches these filters."}</div>
        ) : paged.map(s => {
          const d = serviceDisplay(s.name);
          const open = expanded === s.id;
          const prov = s.provider || "mtp";
          return (
            <div key={s.id}>
              <div className={"rs-sr" + (open ? " open" : "") + (s.enabled ? "" : " off")} role="button" tabIndex={0}
                onClick={() => { setExpanded(open ? null : s.id); if (editMode === s.id) setEditMode(null); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}>
                <span className="rs-sn">
                  <b title={s.name}>{d.title}</b>
                  <i>
                    {sensitive && <span className={`rs-pv ${prov}`}>{PROV[prov] || prov.toUpperCase()}</span>}
                    <span className="rs-sid m">#{s.apiId}</span>
                    {s.tiers > 0 && <span className="rs-use">In use · {s.tiers}</span>}
                    {!s.enabled && <span className="rs-offc">Off</span>}
                    {d.facts.length > 0 && <span className="rs-facts">{d.facts.join(" · ")}</span>}
                  </i>
                </span>
                <span className="rs-cat">{s.category}</span>
                {sensitive && <span className="r m rs-cost">{naira(s.costPer1k)}</span>}
                <span className="r m rs-ord">{(s.orders || 0).toLocaleString()}</span>
                <span className="r m rs-rng">{(s.min || 0).toLocaleString()} – {short(s.max || 0)}</span>
                <span className="rs-tg" onClick={e => e.stopPropagation()}>
                  <button type="button" className={"rs-tog" + (s.enabled ? "" : " o")} onClick={() => toggleEnabled(s)} aria-label={s.enabled ? "Switch off" : "Switch on"}><i /></button>
                </span>
                <span className={"rs-chev" + (open ? " up" : "")}>{CHEV}</span>
              </div>
              {open && (
                <div className="rs-sx">
                  {editMode === s.id ? (
                    <div className="rs-edit">
                      <div className="rs-grid">
                        <label className="rs-fld"><span>Name</span><input className="rs-in" value={editData.name || ""} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} /></label>
                        <label className="rs-fld"><span>Platform</span><input className="rs-in" value={editData.category || ""} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} /></label>
                        <label className="rs-fld"><span>Min order</span><input className="rs-in m" type="number" value={editData.min ?? ""} onChange={e => setEditData(p => ({ ...p, min: e.target.value }))} /></label>
                        <label className="rs-fld"><span>Max order</span><input className="rs-in m" type="number" value={editData.max ?? ""} onChange={e => setEditData(p => ({ ...p, max: e.target.value }))} /></label>
                        <label className="rs-fld"><span>Start time</span><input className="rs-in" value={editData.avgTime || ""} onChange={e => setEditData(p => ({ ...p, avgTime: e.target.value }))} placeholder="0-2 hrs" /></label>
                        <label className="rs-fld rs-chk"><span>Refill</span><span className="rs-chkrow"><input type="checkbox" checked={!!editData.refill} onChange={e => setEditData(p => ({ ...p, refill: e.target.checked }))} /> Provider refills drops</span></label>
                      </div>
                      <div className="rs-acts">
                        <button type="button" className="rs-pri" disabled={saving} onClick={() => saveEdit(s.id)}>{saving ? "Saving…" : "Save changes"}</button>
                        <button type="button" className="rs-b" onClick={() => setEditMode(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rs-facts-g">
                        <div className="rs-f"><span>Provider</span><b>{sensitive ? `${PROV[prov] || prov.toUpperCase()} · ` : ""}#{s.apiId}</b></div>
                        {sensitive && <div className="rs-f"><span>Cost per 1k</span><b className="m">{naira(s.costPer1k)}</b></div>}
                        <div className="rs-f"><span>Min · max</span><b className="m">{(s.min || 0).toLocaleString()} · {(s.max || 0).toLocaleString()}</b></div>
                        <div className="rs-f"><span>Refill</span><b>{s.refill ? "Yes" : "No"}</b></div>
                        <div className="rs-f"><span>Start</span><b>{s.avgTime || "—"}</b></div>
                        <div className="rs-f"><span>In the menu</span><b>{s.tiers > 0 ? `${s.tiers} tier${s.tiers > 1 ? "s" : ""}` : "Not used"}</b></div>
                        <div className="rs-f rs-raw"><span>Provider's name</span><b>{s.name}</b></div>
                      </div>
                      <div className="rs-acts">
                        <button type="button" className="rs-b" onClick={() => startEdit(s)}>Edit</button>
                        <button type="button" className="rs-b" onClick={() => toggleEnabled(s)}>{s.enabled ? "Switch off" : "Switch on"}</button>
                        <button type="button" className="rs-b danger rs-right" onClick={() => deleteService(s)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && filtered.length > 0 && (
          <div className="rs-pg">
            <span className="rs-cnt">{((page - 1) * perPage + 1).toLocaleString()}–{Math.min(page * perPage, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} ·
              <select className="rs-pp" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>{[25, 50, 100, 200].map(v => <option key={v} value={v}>{v} per page</option>)}</select>
            </span>
            {totalPages > 1 && (
              <span className="rs-pgn">
                <button type="button" className="rs-ib" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page">‹</button>
                <span className="rs-cnt">{page} of {totalPages}</span>
                <button type="button" className="rs-ib" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-label="Next page">›</button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.rs{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.rs *{box-sizing:border-box}
.rs .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rs-hb{display:flex;gap:6px;flex-shrink:0}
.rs-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;transition:transform .15s}
.rs-b:hover{transform:translateY(-1px)}.rs-b:disabled{opacity:.5;cursor:not-allowed;transform:none}.rs-b.danger{color:var(--bad)}.rs-b.warn{color:var(--warn)}.rs-right{margin-left:auto}
.rs-pri{font:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap}.rs-pri:disabled{opacity:.5;cursor:not-allowed}
.rs-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.rs-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.rs-stt:first-child{border-left:0}
.rs-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}.rs-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px}.rs-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;min-height:15px}
.rs-stt.warn b,.rs-stt.warn i{color:var(--warn)}
.rs-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rs-srch{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);color:var(--dim);font-size:13px;min-width:280px}
.rs-srch:focus-within{border-color:var(--acln)}.rs-si{display:inline-flex;width:14px;height:14px;flex-shrink:0}.rs-si svg{width:14px;height:14px}
.rs-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}
.rs-x{width:18px;height:18px;border-radius:50%;border:0;background:var(--rail);color:var(--mut);font-size:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.rs-cnt{font-size:12px;color:var(--dim)}.rs-count{margin-left:auto}
.rs-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.rs-sh,.rs-sr{display:grid;grid-template-columns:minmax(240px,1fr) 100px 90px 70px 120px 44px 20px;align-items:center;gap:12px;padding:0 14px}
.rs-sh{height:34px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line)}.rs .r{text-align:right}
.rs-sr{padding-top:9px;padding-bottom:9px;border-top:1px solid var(--rail);font-size:13px;min-width:0;cursor:pointer;outline:none}.rs-sr:hover{background:var(--soft)}.rs-sr.open{background:var(--acbg)}.rs-sr:focus-visible{box-shadow:inset 0 0 0 2px var(--acln)}
.rs-sr.off .rs-sn b,.rs-sr.off .rs-cost,.rs-sr.off .rs-ord,.rs-sr.off .rs-rng,.rs-sr.off .rs-cat{opacity:.55}
.rs-sr.sk{cursor:default}.rs-sr.sk:hover{background:none}
.rs-sn{display:flex;flex-direction:column;gap:2px;min-width:0}.rs-sn b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-sn i{font-style:normal;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mut);min-width:0}
.rs-facts{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rs-pv{font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:2px 5px;border-radius:5px;background:var(--soft);border:1px solid var(--line);color:var(--mut);flex-shrink:0}.rs-pv.dao{color:var(--blue);background:var(--bluebg);border-color:transparent}.rs-pv.jap{color:var(--warn)}
.rs-sid{color:var(--dim);flex-shrink:0}.rs-use{font-size:10.5px;font-weight:700;color:var(--ok);background:var(--okbg);padding:1px 6px;border-radius:6px;flex-shrink:0;white-space:nowrap}.rs-offc{font-size:10.5px;font-weight:700;color:var(--bad);background:var(--badbg);padding:1px 6px;border-radius:6px;flex-shrink:0}
.rs-cat{font-size:12.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rs-cost{font-weight:700}.rs-ord{font-weight:600}.rs-rng{font-size:12px;color:var(--mut);white-space:nowrap}
.rs-tog{width:34px;height:20px;border-radius:10px;background:var(--ac);position:relative;display:inline-block;border:0;padding:0;cursor:pointer}.rs-tog i{position:absolute;top:2px;left:16px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.rs-tog.o{background:var(--line)}.rs-tog.o i{left:2px}
.rs-chev{width:12px;height:12px;color:var(--dim);display:inline-flex;transition:transform .15s}.rs-chev svg{width:12px;height:12px}.rs-chev.up{transform:rotate(180deg)}
.rs-sx{padding:12px 14px 14px;background:var(--acbg);border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px}
.rs-facts-g{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--card)}
.rs-f{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-top:1px solid var(--rail);border-left:1px solid var(--rail);min-width:0}.rs-f:nth-child(-n+3){border-top:0}.rs-f:nth-child(3n+1){border-left:0}
.rs-f span{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.rs-f b{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-raw{grid-column:1/-1;border-left:0}.rs-raw b{white-space:normal;font-weight:500;font-size:12.5px;color:var(--mut)}
.rs-acts{display:flex;gap:6px;flex-wrap:wrap}
.rs-edit{display:flex;flex-direction:column;gap:12px}.rs-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.rs-fld{display:flex;flex-direction:column;gap:5px}.rs-fld>span:first-child{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.rs-in{width:100%;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);outline:none}.rs-in:focus{border-color:var(--acln)}
.rs-chkrow{display:inline-flex;align-items:center;gap:8px;height:34px;font-size:13px;color:var(--ink)}
.rs-pg{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}
.rs-pp{font:inherit;font-size:12px;color:var(--ac);font-weight:600;background:none;border:0;cursor:pointer;padding:0 0 0 4px}
.rs-pgn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
.rs-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:14px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.rs-ib:disabled{opacity:.4;cursor:not-allowed}
.rs-empty{padding:40px 14px;text-align:center;font-size:13px;color:var(--mut)}
.rs-bone{display:block;margin:3px 0}
@media (max-width:900px){
  .rs-hb{width:100%}.rs-hb .rs-b{flex:1}
  .rs-stats{grid-template-columns:1fr 1fr}.rs-stt:nth-child(3){border-left:0}.rs-stt:nth-child(n+3){border-top:1px solid var(--line)}.rs-stt b{font-size:17px}
  .rs-srch{width:100%;min-width:0}.rs-count{display:none}
  .rs-sh{display:none}
  .rs-sr{display:grid;grid-template-columns:1fr auto auto;grid-template-areas:"sn sn sn" "cost ord tg";gap:8px 10px;padding:10px 12px}
  .rs-sn{grid-area:sn}.rs-cat,.rs-rng,.rs-chev{display:none}
  .rs-cost{grid-area:cost;text-align:left;justify-self:start}.rs-cost::before{content:"cost ";font-family:Outfit,sans-serif;font-weight:500;color:var(--dim);font-size:11.5px}
  .rs-ord{grid-area:ord;text-align:left}.rs-ord::after{content:" orders";font-family:Outfit,sans-serif;font-weight:500;color:var(--dim);font-size:11.5px}
  .rs-tg{grid-area:tg;justify-self:end}
  .rs-sr.sk{grid-template-areas:"sn sn sn" "cost ord tg"}
  .rs-facts-g{grid-template-columns:1fr 1fr}.rs-f:nth-child(-n+3){border-top:1px solid var(--rail)}.rs-f:nth-child(-n+2){border-top:0}.rs-f:nth-child(3n+1){border-left:1px solid var(--rail)}.rs-f:nth-child(odd){border-left:0}.rs-raw{grid-column:1/-1}
  .rs-grid{grid-template-columns:1fr 1fr}
  .rs-acts .rs-b{flex:1;text-align:center}.rs-right{margin-left:0}
  .rs-pg{flex-wrap:wrap}
}
`;
