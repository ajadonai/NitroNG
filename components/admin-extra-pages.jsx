'use client';
import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";
import { FilterDropdown } from "./date-range-picker";
import { Avatar } from "./avatar";
import InlineAlert from "./inline-alert";
import { copyText } from '@/lib/clipboard';


const ROLE_COLORS = { superadmin: "#c47d8e", admin: "#a5b4fc", support: "#6ee7b7", finance: "#fcd34d" };
const fPts = (points) => (Number(points) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════ */
/* ═══ ACTIVITY LOG                        ═══ */
/* ═══════════════════════════════════════════ */
export function AdminActivityPage({ dark, t }) {
  const [tab, setTab] = useState("admin");
  const [logs, setLogs] = useState([]);
  const [sysEvents, setSysEvents] = useState([]);
  const [sysCounts, setSysCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [sysLoading, setSysLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [sysSev, setSysSev] = useState("all");
  const [sysFilter, setSysFilter] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [page, setPage] = useState(0);
  const perPage = 25;
  const [sysPage, setSysPage] = useState(0);
  const sysPerPage = 25;

  const fetchActivity = useCallback((q) => {
    const params = `?limit=500${q ? `&search=${encodeURIComponent(q)}` : ''}`;
    fetch(`/api/admin/activity${params}`).then(r => r.json()).then(d => { setLogs(d.activity || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { fetchActivity(); }, [fetchActivity]);
  const actSearchTimer = useRef(null);
  useEffect(() => {
    if (actSearchTimer.current) clearTimeout(actSearchTimer.current);
    actSearchTimer.current = setTimeout(() => fetchActivity(search), search ? 350 : 0);
    return () => clearTimeout(actSearchTimer.current);
  }, [search, fetchActivity]);
  useEffect(() => {
    if (tab === "system" && sysEvents.length === 0 && !sysLoading) {
      setSysLoading(true);
      fetch("/api/admin/activity/system").then(r => r.json()).then(d => { setSysEvents(d.events || []); setSysCounts(d.counts || {}); setSysLoading(false); }).catch(() => setSysLoading(false));
    }
  }, [tab]);

  const typeLabels = { user: "Users", order: "Orders", alert: "Alerts", blog: "Blog", coupon: "Coupons", settings: "Settings", service: "Services", payment: "Payments", reward: "Rewards", leaderboard_reward: "Rewards", leaderboard_announcement: "Rewards", auto_reward_config: "Rewards", team: "Team", admin: "Admin", ticket: "Tickets", system: "System", refill: "Refills", reseller: "Resellers", crew: "Crew", changelog: "Changelog", promotion: "Promotions", pricing: "Pricing", issue: "Issues" };
  const getTypeLabel = (type) => {
    if (!type) return "Other";
    if (typeLabels[type]) return typeLabels[type];
    if (type.startsWith("Rewarded") || type.startsWith("Updated auto-reward") || type.startsWith("Updated leaderboard")) return "Rewards";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  const dayKey = (iso) => new Date(iso).toDateString();
  const todayKey = new Date().toDateString();
  const yesterdayKey = new Date(Date.now() - 86400e3).toDateString();
  const weekAgo = Date.now() - 7 * 86400e3;
  const inPeriod = (l) => period === "all" ? true : period === "today" ? dayKey(l.time) === todayKey : new Date(l.time).getTime() >= weekAgo;
  const groupedTypes = {}; const adminNames = new Set();
  logs.forEach(l => { const label = getTypeLabel(l.type); groupedTypes[label] = (groupedTypes[label] || 0) + 1; if (l.admin) adminNames.add(l.admin); });
  const typeEntries = Object.entries(groupedTypes).sort((a, b) => b[1] - a[1]);
  const filtered = logs.filter(l => (filter === "all" || getTypeLabel(l.type) === filter) && (adminFilter === "all" || l.admin === adminFilter) && inPeriod(l));
  const adminPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const adminPaged = filtered.slice(page * perPage, (page + 1) * perPage);
  const todayLogs = logs.filter(l => dayKey(l.time) === todayKey);
  const weekBy = {}; logs.forEach(l => { if (new Date(l.time).getTime() >= weekAgo && l.admin) weekBy[l.admin] = (weekBy[l.admin] || 0) + 1; });
  const weekTop = Object.entries(weekBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const peopleToday = new Set(todayLogs.map(l => l.admin).filter(Boolean)).size;
  const cleanName = (n) => (n || "").replace(/\s*\(TG\)\s*$/, "");
  const fromTg = (n) => /\(TG\)\s*$/.test(n || "");
  const initialsOf = (n) => cleanName(n).split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const timeOf = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dayLabel = (iso) => { const k = dayKey(iso); if (k === todayKey) return `Today · ${new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`; if (k === yesterdayKey) return "Yesterday"; return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); };

  const sysTypeLabel = { dispatch_error: "Dispatch", partial_delivery: "Delivery", refund: "Refund" };
  const sysFiltered = sysEvents.filter(e => (sysFilter === "all" || e.type === sysFilter) && (sysSev === "all" || e.severity === sysSev));
  const sysPages = Math.max(1, Math.ceil(sysFiltered.length / sysPerPage));
  const sysPaged = sysFiltered.slice(sysPage * sysPerPage, (sysPage + 1) * sysPerPage);
  const highCount = sysEvents.filter(e => e.severity === "high").length;
  const refundsToday = sysEvents.filter(e => e.type === "refund" && dayKey(e.time) === todayKey);
  const refundsTodaySum = refundsToday.reduce((n, e) => n + (Number(e.meta?.amount) || 0), 0);
  const metaOf = (ev) => ev.meta && typeof ev.meta === "object" ? Object.entries(ev.meta).filter(([, v]) => v != null && v !== "") : [];

  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)", "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--badbg": dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.06)",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  const pager = (pg, pages, total, setPg) => (
    <div className="lg-pg"><span className="lg-cnt">{total === 0 ? "" : `${pg * perPage + 1}–${Math.min((pg + 1) * perPage, total)} of ${total}`}</span><span className="lg-pgn"><button type="button" className="lg-ib" disabled={pg === 0} onClick={() => setPg(p => p - 1)} aria-label="Previous page">‹</button><span className="lg-cnt">{pg + 1} of {pages}</span><button type="button" className="lg-ib" disabled={pg >= pages - 1} onClick={() => setPg(p => p + 1)} aria-label="Next page">›</button></span></div>
  );
  return (
    <div className="lg" style={vars}>
      <style>{LG_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Logs</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Who did what, and what the system did on its own.</div>
          </div>
          <SegPill value={tab} options={[{ value: "admin", label: "Admin" }, { value: "system", label: `System${sysEvents.length > 0 ? ` (${sysEvents.length})` : ""}` }]} onChange={v => { setTab(v); setExpandedEvent(null); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {tab === "admin" && <>
        <div className="lg-stats">
          {loading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="lg-stt">{bone(20)}</div>) : <>
            <div className="lg-stt"><b className="m">{todayLogs.length}</b><span>Actions today</span><i>{peopleToday ? `${peopleToday} ${peopleToday === 1 ? "person" : "people"}` : "nobody yet"}</i></div>
            {weekTop.map(([name, n]) => <div key={name} className="lg-stt"><b className="m">{n}</b><span>{cleanName(name)}, 7 days</span><i>{fromTg(name) ? "from Telegram" : "on the panel"}</i></div>)}
            {weekTop.length < 3 && Array.from({ length: 3 - weekTop.length }, (_, i) => <div key={i} className="lg-stt"><b className="m">—</b><span>Quiet</span><i>no one else this week</i></div>)}
          </>}
        </div>
        <div className="lg-bar">
          <div className="lg-srch"><input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search actions" />{search && <button type="button" className="lg-x" onClick={() => setSearch("")} aria-label="Clear search">✕</button>}</div>
          <FilterDropdown dark={dark} t={t} value={adminFilter} onChange={(v) => { setAdminFilter(v); setPage(0); }} options={[{ value: "all", label: "Everyone" }, ...[...adminNames].sort().map(n => ({ value: n, label: n }))]} />
          <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(0); }} options={[{ value: "all", label: "All kinds" }, ...typeEntries.map(([label]) => ({ value: label, label }))]} />
          <FilterDropdown dark={dark} t={t} value={period} onChange={(v) => { setPeriod(v); setPage(0); }} options={[{ value: "all", label: "All time" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }]} />
          <span className="lg-cnt">{loading ? "" : `${filtered.length} action${filtered.length === 1 ? "" : "s"}`}</span>
        </div>
        <div className="lg-list">
          {loading ? <div className="lg-sk">{bone(34)}{bone(34)}{bone(34)}{bone(34)}</div> : adminPaged.length === 0 ? <div className="lg-empty">{logs.length === 0 ? "Nothing logged yet." : "No actions match."}</div> : adminPaged.map((l, i) => {
            const newDay = i === 0 || dayKey(l.time) !== dayKey(adminPaged[i - 1].time);
            return (
              <Fragment key={l.id}>
                {newDay && <div className="lg-day">{dayLabel(l.time)}</div>}
                <div className="lg-lr">
                  <span className="lg-tm m">{timeOf(l.time)}</span>
                  <span className="lg-who"><span className="lg-av">{initialsOf(l.admin)}</span><span className="lg-wn"><b>{cleanName(l.admin) || "System"}</b>{fromTg(l.admin) && <i>from Telegram</i>}</span></span>
                  <span className="lg-act" title={l.action}>{l.action}</span>
                  <span className="lg-ty">{getTypeLabel(l.type)}</span>
                </div>
              </Fragment>
            );
          })}
          {!loading && filtered.length > perPage && pager(page, adminPages, filtered.length, setPage)}
        </div>
      </>}

      {tab === "system" && <>
        <div className="lg-stats">
          {sysLoading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="lg-stt">{bone(20)}</div>) : <>
            <div className={"lg-stt" + (highCount ? " warn" : "")}><b className="m">{highCount}</b><span>Needs a look</span><i>{highCount ? "dispatches that gave up" : "nothing urgent"}</i></div>
            <div className="lg-stt"><b className="m">{sysCounts.partial_delivery || 0}</b><span>Partial deliveries</span><i>the rest was refunded</i></div>
            <div className="lg-stt"><b className="m">{refundsToday.length}</b><span>Refunds today</span><i>{refundsToday.length ? `${fN(refundsTodaySum)} back to wallets` : "none"}</i></div>
            <div className="lg-stt"><b className="m">30d</b><span>Kept</span><i>older events drop off</i></div>
          </>}
        </div>
        <div className="lg-bar">
          <FilterDropdown dark={dark} t={t} value={sysFilter} onChange={(v) => { setSysFilter(v); setSysPage(0); setExpandedEvent(null); }} options={[{ value: "all", label: "All kinds" }, { value: "dispatch_error", label: `Dispatch (${sysCounts.dispatch_error || 0})` }, { value: "partial_delivery", label: `Delivery (${sysCounts.partial_delivery || 0})` }, { value: "refund", label: `Refunds (${sysCounts.refund || 0})` }]} />
          {["high", "medium", "low"].map(s => <button key={s} type="button" className={"lg-tg" + (sysSev === s ? " on" : "")} onClick={() => { setSysSev(sysSev === s ? "all" : s); setSysPage(0); }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}
          <span className="lg-cnt">{sysLoading ? "" : `${sysFiltered.length} event${sysFiltered.length === 1 ? "" : "s"} · 30 days`}</span>
        </div>
        <div className="lg-list">
          {sysLoading ? <div className="lg-sk">{bone(46)}{bone(46)}{bone(46)}</div> : sysPaged.length === 0 ? <div className="lg-empty">{sysEvents.length === 0 ? "Nothing went sideways in the last 30 days." : "No events match."}</div> : sysPaged.map((ev, i) => {
            const isOpen = expandedEvent === ev.id; const newDay = i === 0 || dayKey(ev.time) !== dayKey(sysPaged[i - 1].time); const meta = metaOf(ev);
            return (
              <Fragment key={ev.id}>
                {newDay && <div className="lg-day">{dayLabel(ev.time)}</div>}
                <div className={`lg-sr ${ev.severity || "low"}${isOpen ? " open" : ""}`} onClick={() => setExpandedEvent(isOpen ? null : ev.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedEvent(isOpen ? null : ev.id); } }}>
                  <span className="lg-sbar" />
                  <span className="lg-st"><b>{ev.title}</b><i>{ev.detail || ""}</i>{isOpen && meta.length > 0 && <span className="lg-meta">{meta.map(([k, v]) => <span key={k}><em>{k}</em> {typeof v === "object" ? JSON.stringify(v) : String(v)}</span>)}</span>}</span>
                  <span className="lg-ty">{sysTypeLabel[ev.type] || ev.type}</span>
                  <span className="lg-tm m">{timeOf(ev.time)}</span>
                </div>
              </Fragment>
            );
          })}
          {!sysLoading && sysFiltered.length > sysPerPage && pager(sysPage, sysPages, sysFiltered.length, setSysPage)}
        </div>
      </>}
    </div>
  );
}

const LG_CSS = `
.lg{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.lg *{box-sizing:border-box}
.lg .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.lg-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.lg-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.lg-stt:first-child{border-left:0}
.lg-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}.lg-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lg-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-stt.warn b{color:var(--warn)}
.lg-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lg-srch{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);min-width:280px}.lg-srch:focus-within{border-color:var(--acln)}
.lg-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.lg-srch input::placeholder{color:var(--dim)}
.lg-x{width:18px;height:18px;border-radius:50%;border:0;background:var(--rail);color:var(--mut);font-size:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.lg-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}.lg-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.lg-cnt{font-size:12px;color:var(--dim);margin-left:auto}
.lg-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}.lg-sk{display:flex;flex-direction:column;gap:8px;padding:12px}
.lg-day{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);padding:8px 14px;border-bottom:1px solid var(--line);border-top:1px solid var(--line)}.lg-day:first-child{border-top:0}
.lg-lr{display:grid;grid-template-columns:52px 190px 1fr 96px;align-items:center;gap:12px;padding:9px 14px;border-top:1px solid var(--rail);font-size:13px}.lg-day+.lg-lr,.lg-day+.lg-sr{border-top:0}
.lg-tm{font-size:12px;color:var(--dim);white-space:nowrap}.lg-who{display:flex;align-items:center;gap:8px;min-width:0}.lg-av{width:28px;height:28px;border-radius:50%;background:var(--ac);color:#fff;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.lg-wn{display:flex;flex-direction:column;min-width:0}.lg-wn b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lg-wn i{font-style:normal;font-size:11px;color:var(--dim)}
.lg-act{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.lg-pg .lg-cnt{margin:0}.lg-pgn{display:inline-flex;align-items:center;gap:6px}
.lg-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:14px;cursor:pointer;padding:0}.lg-ib:disabled{opacity:.35;cursor:not-allowed}
.lg-empty{padding:40px 14px;text-align:center;font-size:13px;color:var(--mut)}
.lg-sr{display:grid;grid-template-columns:4px 1fr 90px 52px;align-items:center;gap:12px;padding:11px 14px 11px 12px;border-top:1px solid var(--rail);cursor:pointer;outline:none}.lg-sbar{width:4px;min-height:34px;align-self:stretch;border-radius:2px;background:var(--dim)}.lg-sr.high .lg-sbar{background:var(--bad)}.lg-sr.medium .lg-sbar{background:var(--warn)}.lg-sr.high{background:var(--badbg)}
.lg-st{display:flex;flex-direction:column;gap:2px;min-width:0}.lg-st b{font-size:13.5px;font-weight:600}.lg-st i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lg-sr.open .lg-st i{white-space:normal}
.lg-meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:11.5px;color:var(--mut)}.lg-meta em{font-style:normal;color:var(--dim)}
@media (max-width:900px){
  .lg-stats{grid-template-columns:1fr 1fr}.lg-stt:nth-child(3){border-left:0}.lg-stt:nth-child(n+3){border-top:1px solid var(--line)}.lg-stt b{font-size:17px}
  .lg-srch{width:100%;min-width:0}.lg-cnt{display:none}.lg-pg .lg-cnt{display:inline}
  .lg-lr{grid-template-columns:1fr auto;grid-template-areas:"who tm" "act act";gap:4px 10px}.lg-who{grid-area:who}.lg-lr .lg-tm{grid-area:tm}.lg-act{grid-area:act;white-space:normal;padding-left:36px}.lg-lr .lg-ty{display:none}
  .lg-sr{grid-template-columns:4px 1fr;grid-template-areas:"b st" "b meta";gap:4px 10px}.lg-sbar{grid-area:b}.lg-st{grid-area:st}.lg-st i{white-space:normal}.lg-sr .lg-ty{grid-area:meta;justify-self:start}.lg-sr .lg-tm{grid-area:meta;justify-self:end}
}
`;

const ROLE_INFO = {
  owner:      { color: "#e0a458", desc: "Full platform access. Cannot be modified. Only one owner exists." },
  superadmin: { color: "#c47d8e", desc: "Full access to all admin features. Can manage team and settings." },
  admin:      { color: "#a5b4fc", desc: "Default access to most features. Permissions customizable." },
  support:    { color: "#6ee7b7", desc: "Tickets, orders, users only. Permissions customizable." },
  finance:    { color: "#fcd34d", desc: "Payments and analytics only. Permissions customizable." },
};
const ASSIGNABLE_ROLES = ["admin", "support", "finance"];
const ALL_PAGES = [
  { id:"overview", label:"Overview", g:"Main" },{ id:"orders", label:"Orders", g:"Main" },{ id:"users", label:"Users", g:"Main" },{ id:"leaderboard", label:"Leaderboard", g:"Main" },{ id:"tickets", label:"Tickets", g:"Main" },
  { id:"services", label:"Services", g:"Catalog" },{ id:"menu-builder", label:"Menu Builder", g:"Catalog" },{ id:"pricing", label:"Pricing", g:"Catalog" },{ id:"blog", label:"Blog", g:"Catalog" },
  { id:"payments", label:"Payments", g:"Finance" },{ id:"finance", label:"Finance", g:"Finance" },{ id:"financials", label:"Breakdown (Finance)", g:"Finance" },{ id:"rewards", label:"Rewards", g:"Finance" },
  { id:"refills", label:"Refills", g:"Main" },{ id:"outreach", label:"Outreach", g:"Marketing" },
  { id:"crew", label:"Crew", g:"Marketing" },{ id:"promotions", label:"Promotions", g:"Marketing" },{ id:"acquisition", label:"Acquisition", g:"Marketing" },{ id:"changelog", label:"Changelog", g:"Marketing" },{ id:"issues", label:"Issues", g:"Marketing" },{ id:"tasks", label:"Tasks", g:"Marketing" },
  { id:"alerts", label:"Alerts", g:"System" },{ id:"notifications", label:"Notifications", g:"System" },{ id:"activity", label:"Activity Log", g:"System" },{ id:"team", label:"Team", g:"System" },{ id:"api", label:"API", g:"System" },{ id:"maintenance", label:"Maintenance", g:"System" },{ id:"settings", label:"Settings", g:"System" },
];
const GRANTABLE_ACTIONS = [
  { id: "orders.dispatch", label: "Dispatch Orders", g: "Orders" },
  { id: "orders.redispatch", label: "Redispatch Orders", g: "Orders" },
  { id: "orders.cancel", label: "Cancel Orders", g: "Orders" },
  { id: "orders.refund", label: "Refund Orders", g: "Orders" },
  { id: "orders.retry", label: "Retry Failed Orders", g: "Orders" },
  { id: "orders.check", label: "Check Order Status", g: "Orders" },
  { id: "orders.refill", label: "Send Refills", g: "Orders" },
  { id: "orders.reset_refill", label: "Reset Refill Requests", g: "Orders" },
  { id: "orders.update_link", label: "Update Order Links", g: "Orders" },
  { id: "orders.reset_drip", label: "Reset Drip Schedules", g: "Orders" },
  { id: "payments.approve", label: "Approve/Reject Deposits", g: "Finance" },
  { id: "payments.configure", label: "Configure Gateways", g: "Finance" },
  { id: "finance.topup", label: "Record Provider Top-ups", g: "Finance" },
  { id: "users.edit", label: "Edit User Profiles", g: "Users" },
  { id: "users.adjustBalance", label: "Credit User Balance", g: "Users" },
  { id: "users.ban", label: "Suspend/Ban Users", g: "Users" },
  { id: "leaderboard.reward", label: "Send Leaderboard Rewards", g: "Marketing" },
  { id: "leaderboard.autoReward", label: "Configure Auto-rewards", g: "Marketing" },
  { id: "leaderboard.announcement", label: "Set Reward Announcement", g: "Marketing" },
  { id: "notifications.send", label: "Send Email Blasts", g: "Marketing" },
  { id: "promotions.manage", label: "Manage Promotions", g: "Marketing" },
  { id: "acquisition.manage", label: "Manage Tracking Links", g: "Marketing" },
  { id: "settings.save", label: "Change Site Settings", g: "System" },
  { id: "api.sync", label: "Sync Provider Data", g: "System" },
];
const DEFAULT_PAGES = {
  admin: ["overview","orders","users","leaderboard","tickets","menu-builder","services","pricing","blog","alerts","rewards","finance","activity","promotions","acquisition","issues","crew","changelog","notifications","tasks","outreach","refills"],
  support: ["overview","tickets","users","orders"],
  finance: ["overview","orders","finance","financials","payments","leaderboard"],
  staff: ["overview","outreach","orders","refills","users"],
};
const PAGE_GROUPS = [...new Set(ALL_PAGES.map(p => p.g))];
const ACTION_GROUPS = [...new Set(GRANTABLE_ACTIONS.map(a => a.g))];

export function AdminTeamPage({ admin: currentAdmin, dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const parseActions = (str) => { try { return str ? JSON.parse(str) : []; } catch(e) { return []; } };
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [permTab, setPermTab] = useState("permissions");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [resetPw, setResetPw] = useState("");
  const [localPages, setLocalPages] = useState(null);
  const [localActions, setLocalActions] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = () => fetch("/api/admin/team").then(r => r.json()).then(d => setAdmins(d.admins || []));
  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const act = async (body) => {
    setSaving(true); 
    try {
      const res = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed", data.error || "Something went wrong"); setSaving(false); return false; }
      await reload(); setSaving(false); return data;
    } catch { toast.error("Request failed", "Check your connection"); setSaving(false); return false; }
  };

  const createAdmin = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPw.trim()) return;
    const ok = await act({ action: "create", name: newName, email: newEmail, password: newPw, role: newRole });
    if (ok) { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPw(""); toast.success("Admin created", ""); }
  };

  const getEffective = (a) => {
    if (a.role === "owner" || a.role === "superadmin") return ALL_PAGES.map(p => p.id);
    return a.customPages || DEFAULT_PAGES[a.role] || [];
  };

  const canManage = currentAdmin?.role === "owner" || currentAdmin?.role === "superadmin";
  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };
  const cardBg = t.cardBg;
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;
  const selectSt = {
    backgroundColor: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)",
    border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`,
    color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  };

  // Stats
  const roleCounts = {};
  admins.forEach(a => { roleCounts[a.role] = (roleCounts[a.role] || 0) + 1; });
  const activeCount = admins.filter(a => a.status === "Active").length;

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Team</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{admins.length} members · Manage roles, permissions & passwords</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowGuide(!showGuide); if (!showGuide) setShowAdd(false); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.accent }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              {showGuide ? "Hide Guide" : "Role Guide"}
            </button>
            {canManage && <button onClick={() => { setShowAdd(!showAdd); if (!showAdd) setShowGuide(false); }} className="adm-btn-primary flex items-center gap-1.5">
              {showAdd ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Admin</>}
            </button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stats */}
      <div className="adm-stats mt-4">
        {[
          ["Total", String(admins.length), t.accent],
          ["Active", String(activeCount), dark ? "#6ee7b7" : "#059669"],
          ...Object.entries(roleCounts).map(([role, count]) => [role.charAt(0).toUpperCase() + role.slice(1), String(count), (ROLE_INFO[role] || { color: "#888" }).color]),
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: cardBg, border: cardBd }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {showGuide && (
        <div className="adm-card mt-4 rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd }}>
          <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Role Permissions</div>
          </div>
          <div className="set-card-body">
          {Object.entries(ROLE_INFO).map(([role, info], idx, arr) => (
            <div key={role} className={`flex gap-3 items-center ${idx < arr.length - 1 ? "mb-3 pb-3" : ""}`} style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${info.color}18` }}>
                {role === "owner" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>
                : role === "superadmin" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                : role === "admin" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                : role === "support" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold capitalize" style={{ color: info.color }}>{role}</span>
                <div className="text-[13px] leading-normal mt-0.5" style={{ color: t.textMuted }}>{info.desc}</div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="adm-card mt-4 rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd }}>
          <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>New Admin</div>
          </div>
          <div className="set-card-body">
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 mb-3.5">
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@nitro.ng" type="email" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Password</label><input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Password" type="password" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] font-medium appearance-none cursor-pointer font-[inherit] capitalize bg-no-repeat bg-[position:right_10px_center]" style={selectSt}>
                  {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button onClick={createAdmin} disabled={saving} className="adm-btn-primary w-full" style={{ opacity: newName && newEmail && newPw && !saving ? 1 : .4 }}>{saving ? "Creating..." : "Create Admin"}</button>
          </div>
        </div>
      )}

      {/* Members */}
      <div className="adm-card mt-4 overflow-hidden" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header flex items-center justify-between" style={{ background: headerBg, borderBottom: headerBorder }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Members</div>
          <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>{admins.length} {admins.length === 1 ? "member" : "members"}</span>
        </div>
        {loading ? <div className="p-5">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[52px] rounded-lg mb-1.5`} />)}</div> : admins.map((a, i) => {
          const owner = a.role === "owner";
          const ri = ROLE_INFO[a.role] || { color: "#888" };
          const expanded = expandedId === a.id && !owner && canManage;
          const hasCustom = a.customPages !== null && !owner && a.role !== "superadmin";
          const pages = expanded && localPages !== null ? localPages : (a.customPages || DEFAULT_PAGES[a.role] || []);

          return (
            <div key={a.id} style={{ borderBottom: i < admins.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { if (!owner && canManage) { if (expanded) { setExpandedId(null); } else { setExpandedId(a.id); setPermTab("permissions"); setResetPw(""); setLocalPages(null); setLocalActions(null); } } }} className="py-3.5 px-5 flex justify-between items-center gap-3 flex-wrap transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.04)]" style={{ cursor: owner || !canManage ? "default" : "pointer" }}>
                <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                  <Avatar size={40} rounded={12} />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[15px] font-semibold" style={{ color: t.text }}>{a.name}</span>
                      <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold capitalize" style={{ background: `${ri.color}18`, color: ri.color }}>{a.role}</span>
                      {owner && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>}
                      {hasCustom && <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", color: t.accent }}>custom</span>}
                      {a.status !== "Active" && <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}>Inactive</span>}
                    </div>
                    <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>{a.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px]" style={{ color: t.textMuted }}>{a.lastActive ? fD(a.lastActive) : "Never"}</span>
                  {owner ? <span className="text-[12px] italic" style={{ color: t.textMuted }}>Protected</span> : canManage ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" className="transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9" /></svg> : null}
                </div>
              </div>

              {expanded && (
                <div className="px-5 pb-5 pt-3.5" style={{ background: dark ? "rgba(0,0,0,.24)" : "rgba(0,0,0,.03)", borderLeft: `3px solid ${ri.color}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                  <div className="mb-4" onClick={e => e.stopPropagation()}>
                    <SegPill value={permTab} options={[{value: "permissions", label: <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Permissions</>}, {value: "password", label: <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> Password</>}, {value: "role", label: <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Role</>}]} onChange={setPermTab} dark={dark} t={t} />
                  </div>

                  {permTab === "permissions" && (a.role !== "superadmin" ? (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[13px] font-medium" style={{ color: t.textSoft }}>{pages.length} of {ALL_PAGES.length} pages enabled</span>
                        {(localPages !== null || a.customPages !== null) && <button onClick={e => { e.stopPropagation(); setLocalPages(null); act({ action: "updatePermissions", adminId: a.id, pages: null }).then(() => toast.success("Reset to default", "")); }} className="text-xs bg-none border-none cursor-pointer underline transition-transform duration-200 hover:-translate-y-px" style={{ color: t.textMuted, fontFamily: "inherit" }}>Reset to default</button>}
                      </div>
                      {PAGE_GROUPS.map(group => (
                        <div key={group} className="mb-3.5">
                          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: t.accent }}>{group}</div>
                          <div className="grid grid-cols-3 max-md:grid-cols-2 gap-1.5">
                            {ALL_PAGES.filter(p => p.g === group).map(page => {
                              const enabled = pages.includes(page.id);
                              const defEnabled = (DEFAULT_PAGES[a.role] || []).includes(page.id);
                              const customized = (localPages !== null || a.customPages !== null) && enabled !== defEnabled;
                              return (
                                <button key={page.id} onClick={e => { e.stopPropagation(); const next = enabled ? pages.filter(p => p !== page.id) : [...pages, page.id]; setLocalPages(next); }} className="flex items-center gap-1.5 py-2 px-3 rounded-lg border text-left cursor-pointer font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ borderColor: enabled ? t.accent : t.cardBorder, background: enabled ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)") : "transparent" }}>
                                  <div className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${enabled ? t.accent : t.textMuted}`, background: enabled ? t.accent : "transparent" }}>
                                    {enabled && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                  </div>
                                  <span className="text-[13px]" style={{ color: enabled ? t.text : t.textMuted, fontWeight: enabled ? 500 : 400 }}>{page.label}</span>
                                  {customized && <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: t.accent }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* ═══ ACTION GRANTS ═══ */}
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Action Permissions</div>
                        <div className="text-[12px] mb-3 leading-normal" style={{ color: t.textMuted }}>Grant specific abilities beyond page access.</div>
                        {ACTION_GROUPS.map(group => (
                          <div key={group} className="mb-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: t.accent }}>{group}</div>
                            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-1.5">
                              {GRANTABLE_ACTIONS.filter(ga => ga.g === group).map(ga => {
                                const parsed = localActions !== null ? localActions : parseActions(a.customActions);
                                const on = parsed.includes(ga.id);
                                return (
                                  <button key={ga.id} onClick={e => { e.stopPropagation(); const cur = localActions !== null ? localActions : parseActions(a.customActions); setLocalActions(on ? cur.filter(x => x !== ga.id) : [...cur, ga.id]); }} className="flex items-center gap-1.5 py-2 px-3 rounded-lg border text-left cursor-pointer font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ borderColor: on ? t.accent : t.cardBorder, background: on ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)") : "transparent" }}>
                                    <div className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${on ? t.accent : t.textMuted}`, background: on ? t.accent : "transparent" }}>
                                      {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                    </div>
                                    <span className="text-[13px]" style={{ color: on ? t.text : t.textMuted, fontWeight: on ? 500 : 400 }}>{ga.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button onClick={e => { e.stopPropagation(); const savePages = act({ action: "updatePermissions", adminId: a.id, pages: localPages || pages }); const saveActions = localActions !== null ? act({ action: "updateActions", adminId: a.id, actions: localActions }) : Promise.resolve(true); Promise.all([savePages, saveActions]).then(([p, ac]) => { if (p && ac !== false) { toast.success("Permissions saved", ""); setLocalPages(null); setLocalActions(null); } }); }} disabled={saving} className="adm-btn-primary w-full mt-3" style={{ opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Permissions"}</button>
                    </div>
                  ) : <div className="py-6 text-center text-[13px]" style={{ color: t.textMuted }}>Superadmin has full access. No customization needed.</div>)}

                  {permTab === "password" && (
                    <div>
                      <div className="text-sm mb-3.5 leading-relaxed" style={{ color: t.textMuted }}>Set a new password for <strong style={{ color: t.text }}>{a.name}</strong>.</div>
                      <div className="mb-3.5">
                        <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>New Password</label>
                        <input type="password" placeholder="Min. 6 characters" value={resetPw} onChange={e => setResetPw(e.target.value)} onClick={e => e.stopPropagation()} className={inputCls} style={inputStyle} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); act({ action: "resetPassword", adminId: a.id, newPassword: resetPw }).then(ok => { if (ok) { toast.success("Password reset", a.name); setResetPw(""); } }); }} disabled={resetPw.length < 6 || saving} className="adm-btn-primary w-full" style={{ opacity: resetPw.length >= 6 && !saving ? 1 : .4 }}>{saving ? "Resetting..." : "Reset Password"}</button>
                    </div>
                  )}

                  {permTab === "role" && (
                    <div>
                      <div className="text-sm mb-3.5 leading-relaxed" style={{ color: t.textMuted }}>Change <strong style={{ color: t.text }}>{a.name}</strong>'s role. Custom permissions are preserved.</div>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {ASSIGNABLE_ROLES.map(r => {
                          const ri2 = ROLE_INFO[r]; const active = a.role === r;
                          return <button key={r} onClick={e => { e.stopPropagation(); act({ action: "updateRole", adminId: a.id, role: r }).then(ok => { if (ok) toast.success("Role updated", `${a.name} is now ${r}`); }); }} className="py-2.5 px-5 rounded-lg border text-sm cursor-pointer capitalize font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ borderColor: active ? ri2.color : t.cardBorder, background: active ? `${ri2.color}15` : "transparent", color: active ? ri2.color : t.textMuted, fontWeight: active ? 600 : 430 }}>{r}</button>;
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: a.status === "Active" ? "Deactivate Admin" : "Activate Admin", message: a.status === "Active" ? `Deactivate ${a.name}?` : `Reactivate ${a.name}?`, confirmLabel: a.status === "Active" ? "Deactivate" : "Activate", danger: a.status === "Active" }); if (ok) { const r = await act({ action: "toggleStatus", adminId: a.id }); if (r) toast.success("Status changed", `${a.name} ${r.status === "Active" ? "activated" : "deactivated"}`); } }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: a.status === "Active" ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{a.status === "Active" ? "Deactivate" : "Activate"}</button>
                        <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: "Delete Admin", message: `Permanently delete ${a.name}? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) { const r = await act({ action: "delete", adminId: a.id }); if (r) toast.success("Admin deleted", a.name); } }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══ COUPONS                             ═══ */
/* ═══════════════════════════════════════════ */
export function AdminCouponsPage({ dark, t }) {
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxDeposit: "", maxUses: "", expires: "", newUsersOnly: false });

  // Referral settings
  const [refEnabled, setRefEnabled] = useState(true);
  const [refReferrer, setRefReferrer] = useState("500");
  const [refInvitee, setRefInvitee] = useState("500");
  const [refMinDeposit, setRefMinDeposit] = useState("0");
  const [refSaving, setRefSaving] = useState(false);
  const [refMsg, setRefMsg] = useState(null);

  const [rewardsTab, setRewardsTab] = useState("referrals");

  // Points ledger
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const ledgerTimer = useRef(null);
  const ledgerReqRef = useRef(0);

  const fetchLedger = useCallback(async (pg = 1, searchVal, typeVal, fromVal, toVal) => {
    const reqId = ++ledgerReqRef.current;
    setLedgerLoading(true);
    const params = new URLSearchParams({ page: String(pg), perPage: '25' });
    if (searchVal) params.set('search', searchVal);
    if (typeVal) params.set('type', typeVal);
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    try {
      const res = await fetch(`/api/admin/rewards?${params}`);
      if (!res.ok) { if (reqId === ledgerReqRef.current) { setLedger([]); setLedgerTotal(0); setLedgerTotalPages(1); } return; }
      const data = await res.json();
      if (reqId !== ledgerReqRef.current) return;
      setLedger(data.entries || []);
      setLedgerTotal(data.total || 0);
      setLedgerTotalPages(data.totalPages || 1);
      setLedgerPage(data.page || 1);
    } catch {
      if (reqId === ledgerReqRef.current) setLedger([]);
    } finally {
      if (reqId === ledgerReqRef.current) setLedgerLoading(false);
    }
  }, []);

  // Nitro Status tiers — read-only reference, canonical source is lib/nitro-rewards.js
  const NITRO_STATUS_TIERS = [
    { name: 'Spark',  min: 0,        discountPct: 0,   pointEarnPct: 0.5, color: '#6B7280' },
    { name: 'Pulse',  min: 100000,   discountPct: 0.5, pointEarnPct: 1,   color: '#F59E0B' },
    { name: 'Boost',  min: 500000,   discountPct: 1,   pointEarnPct: 1.25, color: '#3B82F6' },
    { name: 'Surge',  min: 2000000,  discountPct: 2,   pointEarnPct: 1.5, color: '#8B5CF6' },
    { name: 'Apex',   min: 7500000,  discountPct: 3,   pointEarnPct: 1.75, color: '#EC4899' },
    { name: 'Legend', min: 15000000, discountPct: 4,   pointEarnPct: 2,   color: '#EF4444' },
  ];

  useEffect(() => {
    fetch("/api/admin/coupons").then(r => r.json()).then(d => { setCoupons(d.coupons || []); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (!d.settings) return;
      const s = d.settings;
      if (s.ref_enabled !== undefined) setRefEnabled(s.ref_enabled === "true" || s.ref_enabled === true);
      if (s.ref_referrer_bonus) setRefReferrer(String(Math.round(Number(s.ref_referrer_bonus) / 100)));
      if (s.ref_invitee_bonus) setRefInvitee(String(Math.round(Number(s.ref_invitee_bonus) / 100)));
      if (s.ref_min_deposit) setRefMinDeposit(String(Math.round(Number(s.ref_min_deposit) / 100)));
    });
  }, []);

  const saveReferral = async () => {
    setRefSaving(true); setRefMsg(null);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: {
        ref_enabled: String(refEnabled),
        ref_referrer_bonus: String(Number(refReferrer || 0) * 100),
        ref_invitee_bonus: String(Number(refInvitee || 0) * 100),
        ref_min_deposit: String(Number(refMinDeposit || 0) * 100),
      }}) });
      setRefMsg(r.ok ? { ok: true, text: "Referral settings saved" } : { text: "Failed to save" });
    } catch { setRefMsg({ text: "Request failed" }); }
    setRefSaving(false);
  };


  const createCoupon = async () => {
    if (!form.code.trim() || !form.value) return;
    try {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...form, value: Number(form.value), minOrder: Number(form.minOrder) || 0, maxDeposit: Number(form.maxDeposit) || 0, maxUses: Number(form.maxUses) || 0, newUsersOnly: form.newUsersOnly }) });
      if (res.ok) { setShowAdd(false); setForm({ code: "", type: "percent", value: "", minOrder: "", maxDeposit: "", maxUses: "", expires: "", newUsersOnly: false }); fetch("/api/admin/coupons").then(r => r.json()).then(d => setCoupons(d.coupons || [])); }
    } catch {}
  };

  const deleteCoupon = async (id) => {
    try {
      await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };
  const numInputCls = "py-[9px] px-3 rounded-lg border-solid text-[15px] outline-none text-right w-20";
  const numInput = { background: dark ? "rgba(255,255,255,.12)" : "#fff", borderWidth: "0.5px", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)", color: t.text, fontFamily: "'JetBrains Mono',monospace" };
  const cardBg = dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`;
  const divBg = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)";

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Rewards</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage referrals, coupons, Nitro Status, and points</div>
          </div>
          <SegPill value={rewardsTab} options={[{value: "referrals", label: "Referrals"}, {value: "coupons", label: "Coupons"}, {value: "loyalty", label: "Nitro Status"}, {value: "ledger", label: "Points Ledger"}]} onChange={v => { setRewardsTab(v); if (v === 'ledger' && ledger.length === 0 && !ledgerLoading) fetchLedger(1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ REFERRAL TAB ═══ */}
      {rewardsTab === "referrals" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Referral program</div>
        </div>
        <div className="set-card-body">

        <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.textMuted }}>
          When a user shares their referral code and someone signs up with it, both receive wallet credit after the new user verifies their email.
        </div>

        {refMsg && <InlineAlert type={refMsg.ok ? "success" : "error"} dark={dark} className="mb-3">{refMsg.text}</InlineAlert>}

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Referral program</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Enable or disable the entire system</div></div>
          <div role="switch" aria-checked={refEnabled} aria-label="Referral program" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setRefEnabled(!refEnabled)} className="w-[44px] h-6 rounded-xl relative cursor-pointer shrink-0" style={{ background: refEnabled ? "#c47d8e" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") }}>
            <div className="w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: refEnabled ? 23 : 3 }} />
          </div>
        </div>

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Referrer bonus</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Amount credited to the person who shared the code</div></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
            <input value={refReferrer} onChange={e => setRefReferrer(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={numInputCls} style={numInput} />
          </div>
        </div>

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>New user bonus</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Welcome credit for the person who signed up with a code</div></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
            <input value={refInvitee} onChange={e => setRefInvitee(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={numInputCls} style={numInput} />
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Minimum deposit to activate</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>New user must deposit this amount before bonuses pay out (0 = immediate)</div></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
            <input value={refMinDeposit} onChange={e => setRefMinDeposit(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={numInputCls} style={numInput} />
          </div>
        </div>

        <div className="mt-4">
          <button onClick={saveReferral} disabled={refSaving} className="adm-btn-primary" style={{ opacity: refSaving ? .5 : 1 }}>{refSaving ? "Saving..." : "Save Referral Settings"}</button>
        </div>
        </div>
      </div>
      )}

      {/* ═══ COUPONS TAB ═══ */}
      {rewardsTab === "coupons" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div>
            <div className="set-card-title" style={{ color: t.textMuted }}>Coupons</div>
            <div className="set-card-desc" style={{ color: t.textSoft }}>Promo codes users can apply when funding their wallet</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.accent }}>{showAdd ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</>}</button>
        </div>

        {showAdd && (
          <div className="p-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} placeholder="WELCOME20" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
                  backgroundColor: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)",
                  border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`,
                  color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                }}>
                  <option value="percent">% Bonus</option>
                  <option value="fixed">₦ Bonus</option>
                </select>
              </div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Value</label><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === "percent" ? "20" : "500"} className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Min Deposit (₦)</label><input type="number" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} placeholder="0" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Max Deposit (₦)</label><input type="number" value={form.maxDeposit} onChange={e => setForm({ ...form, maxDeposit: e.target.value })} placeholder="0 = no limit" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Max Uses (0 = unlimited)</label><input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="0" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Expires</label><input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} className={inputCls} style={inputStyle} /></div>
            </div>
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <div role="switch" aria-checked={form.newUsersOnly} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setForm({ ...form, newUsersOnly: !form.newUsersOnly }); } }} onClick={() => setForm({ ...form, newUsersOnly: !form.newUsersOnly })} className="w-[36px] h-5 rounded-xl relative shrink-0" style={{ background: form.newUsersOnly ? "#c47d8e" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") }}>
                <div className="w-[14px] h-[14px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: form.newUsersOnly ? 19 : 3 }} />
              </div>
              <span className="text-[13px]" style={{ color: t.textMuted }}>New users only (first deposit)</span>
            </label>
            <button onClick={createCoupon} className="adm-btn-primary" style={{ opacity: form.code && form.value ? 1 : .4 }}>Create Coupon</button>
          </div>
        )}

        {loading ? (
          <div>{[1, 2, 3].map(i => (
            <div key={i} className="adm-list-row flex-wrap gap-2.5" style={{ borderBottom: i < 3 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="flex-1 min-w-[160px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[80px] h-[16px] rounded`} />
                  <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[60px] h-[14px] rounded`} />
                </div>
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[70%] h-[13px] rounded mt-1`} />
              </div>
              <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[52px] h-[30px] rounded-lg`} />
            </div>
          ))}</div>
        ) : coupons.length > 0 ? coupons.map((c, i) => (
          <div key={c.id || c.code} className="adm-list-row flex-wrap gap-2.5" style={{ borderBottom: i < coupons.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="flex-1 min-w-[160px]">
              <div className="flex items-center gap-2">
                <span className="m text-base font-semibold" style={{ color: t.accent }}>{c.code}</span>
                <span className="text-sm font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{c.type === "percent" ? `${c.value}%` : `₦${(c.value || 0).toLocaleString()}`} bonus</span>
                {c.newUsersOnly && <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(96,165,250,.12)" : "rgba(59,130,246,.08)", color: dark ? "#93c5fd" : "#2563eb" }}>New users</span>}
                {!c.enabled && <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", color: t.textMuted }}>Disabled</span>}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>
                Min: {c.minOrder ? `₦${c.minOrder.toLocaleString()}` : "None"} · Max: {c.maxDeposit ? `₦${c.maxDeposit.toLocaleString()}` : "None"} · Uses: {c.used || 0}/{c.maxUses || "∞"} · {c.expires ? `Exp: ${c.expires}` : "No expiry"}
              </div>
            </div>
            <button onClick={() => { copyText(c.code); setCopiedCode(c.id); setTimeout(() => setCopiedCode(null), 1500); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: copiedCode === c.id ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>{copiedCode === c.id ? "Copied!" : "Copy"}</button>
            <button onClick={async () => { const ok = await confirm({ title: "Delete Coupon", message: `Delete coupon "${c.code}"? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) deleteCoupon(c.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
          </div>
        )) : (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
              <rect x="8" y="16" width="48" height="32" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <circle cx="32" cy="32" r="6" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <line x1="8" y1="24" x2="24" y2="24" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No coupons created yet</div>
            <div className="text-sm" style={{ color: t.textMuted }}>Create a coupon to offer discounts</div>
          </div>
        )}
      </div>
      )}

      {/* ═══ NITRO STATUS TAB ═══ */}
      {rewardsTab === "loyalty" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Nitro Status tiers</div>
        </div>
        <div className="set-card-body">

        <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.textMuted }}>
          Users earn Nitro Status based on eligible lifetime spend. Each tier grants automatic order discounts and a higher point earn rate. Tiers are currently code-defined for launch — admin editing will come in a later phase.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                {["Tier", "Min. spend", "Discount", "Point earn rate"].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wide" style={{ color: t.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NITRO_STATUS_TIERS.map((tier, idx) => (
                <tr key={tier.name} style={{ borderBottom: idx < NITRO_STATUS_TIERS.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` : "none" }}>
                  <td className="py-2.5 px-3 font-semibold" style={{ color: tier.color }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: tier.color }} />{tier.name}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {tier.min === 0 ? "—" : `₦${tier.min.toLocaleString()}`}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: tier.discountPct > 0 ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {tier.discountPct > 0 ? `${tier.discountPct}%` : "—"}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: dark ? "#fbbf24" : "#92400e", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {tier.pointEarnPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        </div>
      </div>
      )}

      {/* ═══ POINTS LEDGER TAB ═══ */}
      {rewardsTab === "ledger" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Nitro Points Ledger</div>
          {ledgerTotal > 0 && <span className="text-[12px] font-medium" style={{ color: t.textSoft }}>{ledgerTotal.toLocaleString()} entries</span>}
        </div>
        <div className="set-card-body">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input value={ledgerSearch} onChange={e => { const v = e.target.value; setLedgerSearch(v); clearTimeout(ledgerTimer.current); ledgerTimer.current = setTimeout(() => fetchLedger(1, v, ledgerType, ledgerFrom, ledgerTo), 400); }} placeholder="Search user, order, reason…" className={inputCls} style={{ ...inputStyle, flex: '1 1 180px', minWidth: 140 }} />
            <select value={ledgerType} onChange={e => { const v = e.target.value; setLedgerType(v); fetchLedger(1, ledgerSearch, v, ledgerFrom, ledgerTo); }} className={inputCls} style={{ ...inputStyle, flex: '0 0 150px', minWidth: 120 }}>
              <option value="">All types</option>
              <option value="earned_order">Earned</option>
              <option value="redeemed_order">Redeemed</option>
              <option value="reversed_refund">Reversed</option>
              <option value="restored_refund">Restored</option>
              <option value="manual_credit">Manual credit</option>
              <option value="manual_debit">Manual debit</option>
              <option value="opening_balance">Opening balance</option>
            </select>
            <input type="date" value={ledgerFrom} onChange={e => { const v = e.target.value; setLedgerFrom(v); fetchLedger(1, ledgerSearch, ledgerType, v, ledgerTo); }} className={inputCls} style={{ ...inputStyle, flex: '0 0 140px', minWidth: 120 }} />
            <input type="date" value={ledgerTo} onChange={e => { const v = e.target.value; setLedgerTo(v); fetchLedger(1, ledgerSearch, ledgerType, ledgerFrom, v); }} className={inputCls} style={{ ...inputStyle, flex: '0 0 140px', minWidth: 120 }} />
          </div>

          {/* Table */}
          {ledgerLoading ? (
            <div className="space-y-1.5">
              {[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ height: 36, borderRadius: 6 }} />)}
            </div>
          ) : ledger.length > 0 ? (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)' }}>
              <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.06)' }}>
                    {['Date', 'User', 'Type', 'Points', 'Order', 'Reason/Admin'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.textMuted, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: i < ledger.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'}` : 'none' }}>
                      <td className="py-2 px-3 whitespace-nowrap" style={{ color: t.textSoft }}>{fD(e.createdAt, true)}</td>
                      <td className="py-2 px-3 max-w-[140px] truncate" style={{ color: t.text }}>{e.userName || e.userEmail || e.userId.slice(0, 8)}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] py-[2px] px-1.5 rounded font-semibold uppercase tracking-[0.3px]" style={{
                          background: e.points >= 0 ? (dark ? 'rgba(110,231,183,.12)' : 'rgba(5,150,105,.08)') : (dark ? 'rgba(252,165,165,.12)' : 'rgba(220,38,38,.06)'),
                          color: e.points >= 0 ? t.green : t.red,
                        }}>{e.type.replace(/_/g, ' ').replace('order', '').replace('refund', '').trim()}</span>
                      </td>
                      <td className="py-2 px-3 font-bold whitespace-nowrap" style={{ color: e.points >= 0 ? t.green : t.red, fontFamily: 'JetBrains Mono, monospace' }}>{e.points >= 0 ? '+' : ''}{fPts(e.points)}</td>
                      <td className="py-2 px-3 whitespace-nowrap" style={{ color: t.textSoft }}>{e.orderRef ? `#${e.orderRef}` : '—'}</td>
                      <td className="py-2 px-3 max-w-[160px] truncate" style={{ color: t.textSoft }}>{e.adminName ? `[${e.adminName}] ` : ''}{e.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Pagination */}
              {ledgerTotalPages > 1 && (
                <div className="flex items-center justify-between py-2.5 px-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}` }}>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>Page {ledgerPage} of {ledgerTotalPages} ({ledgerTotal})</span>
                  <div className="flex gap-1">
                    <button onClick={() => fetchLedger(ledgerPage - 1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo)} disabled={ledgerPage <= 1} className="py-1 px-2.5 rounded text-[11px] cursor-pointer font-[inherit] border-none" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.textSoft, opacity: ledgerPage <= 1 ? .35 : 1 }}>Prev</button>
                    <button onClick={() => fetchLedger(ledgerPage + 1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo)} disabled={ledgerPage >= ledgerTotalPages} className="py-1 px-2.5 rounded text-[11px] cursor-pointer font-[inherit] border-none" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.textSoft, opacity: ledgerPage >= ledgerTotalPages ? .35 : 1 }}>Next</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-[13px]" style={{ color: t.textMuted }}>{ledgerSearch || ledgerType || ledgerFrom || ledgerTo ? 'No entries match filters' : 'No points ledger entries yet'}</div>
          )}
        </div>
      </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NOTIFICATIONS                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminNotificationsPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);
  const [promoCount, setPromoCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const blastPollRef = useRef(null);
  const blastTimeoutRef = useRef(null);

  useEffect(() => {
    fetch("/api/admin/notifications").then(r => r.json()).then(d => { setHistory(d.history || []); setPromoCount(d.promoCount || 0); setTotalCount(d.totalCount || 0); setLoading(false); }).catch(() => setLoading(false));
    return () => { if (blastPollRef.current) clearInterval(blastPollRef.current); if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current); };
  }, []);

  const send = async () => {
    if (!message.trim() || sending) return;
    setSending(true); 
    try {
      const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message, target }) });
      const data = await res.json();
      if (res.ok) {
        toast.success("Sending", data.message || "Email blast started");
        setSubject(""); setMessage("");
        blastPollRef.current = setInterval(() => {
          fetch("/api/admin/notifications").then(r => r.json()).then(d => {
            setHistory(d.history || []);
            const latest = (d.history || [])[0];
            if (latest && latest.status !== "sending") {
              clearInterval(blastPollRef.current); blastPollRef.current = null;
              if (blastTimeoutRef.current) { clearTimeout(blastTimeoutRef.current); blastTimeoutRef.current = null; }
              if (latest.status === "failed") toast.error("Send failed", `${latest.sent}/${latest.recipients} delivered`);
              else toast.success("Delivered", `${latest.sent}/${latest.recipients} delivered`);
            }
          });
        }, 3000);
        blastTimeoutRef.current = setTimeout(() => { clearInterval(blastPollRef.current); blastPollRef.current = null; blastTimeoutRef.current = null; }, 120000);
      }
      else toast.error("Failed", data.error || "Something went wrong");
    } catch { toast.error("Request failed", "Check your connection"); }
    setSending(false);
  };

  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Email Blasts</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Send email blasts to users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Compose */}
      <div className="adm-card mt-4 mb-5 rounded-[14px]" style={{ background: t.cardBg, border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
        <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Compose Notification</div>
        </div>
        <div className="set-card-body">
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Notification subject..." className={inputCls} style={inputStyle} />
        </div>
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message..." rows={3} className={`${inputCls} resize-y leading-normal`} style={inputStyle} />
        </div>
        <div className="flex justify-between items-center flex-wrap gap-2.5">
          <div className="flex gap-1.5 items-center">
            <label className="text-sm" style={{ color: t.textMuted }}>Send to:</label>
            <select value={target} onChange={e => setTarget(e.target.value)} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
              backgroundColor: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)",
              border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`,
              color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            }}>
              {["all", "active", "new"].map(tg => <option key={tg} value={tg}>{tg.charAt(0).toUpperCase() + tg.slice(1)} users</option>)}
            </select>
          </div>
          <button onClick={send} disabled={sending || !message.trim()} className="adm-btn-primary" style={{ opacity: message.trim() && !sending ? 1 : .4 }}>{sending ? "Sending..." : "Send Notification"}</button>
        </div>
        <div className="text-[12px] mt-2.5" style={{ color: t.textMuted }}>{promoCount} of {totalCount} users opted in to promotional emails</div>
        </div>
      </div>

      {/* History */}
      <div className="adm-card" style={{ background: t.cardBg, border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
        <div className="set-card-header flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Sent history</div>
          {history.length > 0 && <button onClick={async () => { const ok = await confirm({ title: "Clear History", message: "Clear all notification history? This cannot be undone.", confirmLabel: "Clear", danger: true }); if (ok) { fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearHistory: true }) }).then(r => r.json()).then(() => setHistory([])).catch(() => {}); } }} className="bg-transparent border-none text-[12px] cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Clear all</button>}
        </div>
        {loading ? (
          <div className="adm-empty">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-11 rounded-md mb-1.5`} />)}</div>
        ) : history.length > 0 ? history.map((n, i) => (
          <div key={n.id} className="adm-list-row" style={{ borderBottom: i < history.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium" style={{ color: t.text }}>{n.subject || "Notification"}</div>
              <div className="text-sm mt-0.5" style={{ color: t.textSoft }}>{n.message}</div>
              <div className="text-[13px] mt-1" style={{ color: t.textMuted }}>To: {n.target} · {n.recipients ? `${n.sent || 0}/${n.recipients} delivered` : ""} · By: {n.sentBy} · {n.sentAt ? fD(n.sentAt) : ""}</div>
            </div>
            <span className="text-xs py-0.5 px-[7px] rounded font-semibold" style={{ background: n.status === "sent" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : n.status === "sending" ? (dark ? "rgba(96,165,250,.1)" : "rgba(59,130,246,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: n.status === "sent" ? t.green : n.status === "sending" ? (dark ? "#60a5fa" : "#2563eb") : t.amber }}>{n.status === "sending" ? "sending..." : n.status}</span>
          </div>
        )) : (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
              <path d="M32 10c-10 0-18 7-18 16v10l-4 6h44l-4-6V26c0-9-8-16-18-16z" stroke={t.accent} strokeWidth="1.5" opacity=".3" strokeLinejoin="round" />
              <path d="M26 46c0 4 3 6 6 6s6-2 6-6" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No notifications sent yet</div>
            <div className="text-sm" style={{ color: t.textMuted }}>Send a notification to your users</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAINTENANCE                         ═══ */
/* ═══════════════════════════════════════════ */
export function AdminMaintenancePage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState("We're upgrading our systems to serve you better. We'll be back shortly!");
  const [duration, setDuration] = useState(60);
  const [useCustom, setUseCustom] = useState(false);
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");
  const [loading, setLoading] = useState(true);

  const PRESETS = [{ label: "30 min", m: 30 }, { label: "1 hour", m: 60 }, { label: "2 hours", m: 120 }, { label: "6 hours", m: 360 }, { label: "12 hours", m: 720 }, { label: "24 hours", m: 1440 }];

  const formatDuration = (mins) => { if (mins < 60) return `~${mins} minutes`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `~${h}h ${m}m` : `~${h} hour${h > 1 ? "s" : ""}`; };

  useEffect(() => {
    fetch("/api/admin/maintenance").then(r => r.json()).then(d => { setEnabled(d.enabled || false); if (d.message) setMsg(d.message); if (d.durationMinutes) setDuration(d.durationMinutes); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async (newEnabled) => {
    const e = newEnabled !== undefined ? newEnabled : enabled;
    const mins = useCustom ? ((Number(customH) || 0) * 60 + (Number(customM) || 0)) : duration;
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: e, message: msg, durationMinutes: mins, estimatedReturn: formatDuration(mins) }) });
      if (res.ok) { if (newEnabled !== undefined) setEnabled(e); }
      else { const d = await res.json().catch(() => ({})); toast.error("Failed", d.error || "Failed to save"); }
    } catch { toast.error("Network error", "Check your connection"); }
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Maintenance Mode</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Take the platform offline for updates</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? null : (
        <div className="max-w-[600px] mt-4">
          {/* Status card */}
          <div className="rounded-2xl border p-6 mb-5" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.95)", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
            <div className="mb-6">
              <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Platform Status</div>
              <div className="text-[15px]" style={{ color: t.textMuted }}>{enabled ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Platform is currently offline</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Platform is online and operational</>}</div>
            </div>

            {/* Duration presets */}
            <div className="text-[13px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.textMuted }}>Estimated Duration</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map(p => {
                const active = !useCustom && duration === p.m;
                return (<button key={p.m} onClick={() => { setDuration(p.m); setUseCustom(false); }} className="py-2.5 rounded-[10px] text-sm font-semibold text-center border cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: active ? t.accent : t.cardBorder, background: active ? (dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)") : "transparent", color: active ? t.accent : t.textSoft }}>{p.label}</button>);
              })}
            </div>
            <button onClick={() => setUseCustom(!useCustom)} className="text-[15px] font-medium bg-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ color: useCustom ? t.accent : t.textSoft, marginBottom: useCustom ? 12 : 0 }}>{useCustom ? "▾ Custom duration" : "▸ Custom duration"}</button>
            {useCustom && (
              <div className="flex gap-2.5 items-center">
                <div className="flex-1"><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Hours</label><input type="number" min="0" max="72" value={customH} onChange={e => setCustomH(e.target.value)} placeholder="0" className="w-full py-2.5 px-3.5 rounded-[10px] border text-base font-semibold outline-none text-center" style={{ background: dark ? "#131728" : "#fff", borderColor: t.cardBorder, color: t.text }} /></div>
                <span className="text-xl mt-4" style={{ color: t.textMuted }}>:</span>
                <div className="flex-1"><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Minutes</label><input type="number" min="0" max="59" value={customM} onChange={e => setCustomM(e.target.value)} placeholder="0" className="w-full py-2.5 px-3.5 rounded-[10px] border text-base font-semibold outline-none text-center" style={{ background: dark ? "#131728" : "#fff", borderColor: t.cardBorder, color: t.text }} /></div>
                <div className="flex-1 text-sm mt-4" style={{ color: t.textMuted }}>= {(Number(customH) || 0) * 60 + (Number(customM) || 0)} min</div>
              </div>
            )}
          </div>

          {/* Message card */}
          <div className="rounded-2xl border p-6 mb-5" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.95)", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
            <div className="text-[13px] font-semibold uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Maintenance Message</div>
            <div className="text-sm mb-2.5" style={{ color: t.textMuted }}>This is what users will see on the maintenance page</div>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} className="w-full py-3 px-3.5 rounded-xl border outline-none text-[15px] font-[inherit] leading-relaxed resize-y" style={{ background: dark ? "#131728" : "#fff", borderColor: t.cardBorder, color: t.text }} />
          </div>

          {/* Action */}
          <button onClick={async () => { const ok = await confirm({ title: enabled ? "Bring Platform Online" : "Take Platform Offline", message: enabled ? "Bring the platform back online for all users?" : "This will take the platform offline. All users will see a maintenance page.", confirmLabel: enabled ? "Go Online" : "Take Offline", danger: !enabled }); if (ok) save(!enabled); }} className="w-full py-3.5 rounded-xl text-base font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: enabled ? (dark ? "rgba(110,231,183,.19)" : "rgba(5,150,105,.14)") : `linear-gradient(135deg,#c47d8e,#8b5e6b)`, color: enabled ? t.green : "#fff", boxShadow: enabled ? "none" : "0 4px 16px rgba(196,125,142,.31)" }}>{enabled ? <><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#22c55e" }} /> Bring Platform Online</> : <><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#ef4444" }} /> Take Platform Offline</>}</button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ API MANAGEMENT                      ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAPIPage({ dark, t }) {
  const PROVIDERS = [
    { id: "mtp", name: "MoreThanPanel (MTP)", url: "https://morethanpanel.com/api/v2", envKey: "MTP_API_KEY", envUrl: "MTP_API_URL" },
    { id: "jap", name: "JustAnotherPanel (JAP)", url: "https://justanotherpanel.com/api/v2", envKey: "JAP_API_KEY", envUrl: "JAP_API_URL" },
    { id: "dao", name: "DaoSMM", url: "https://daosmm.com/api/v2", envKey: "DAOSMM_API_KEY", envUrl: "DAOSMM_API_URL" },
  ];

  const [loading, setLoading] = useState(true);
  const [svcCounts, setSvcCounts] = useState({});
  const [envStatus, setEnvStatus] = useState({});
  const [testing, setTesting] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [result, setResult] = useState(null);

  const loadData = async () => {
    try {
      const [svcsRes, statusRes] = await Promise.all([
        fetch("/api/admin/services"),
        fetch("/api/admin/sync"),
      ]);
      if (svcsRes.ok) {
        const d = await svcsRes.json();
        const counts = {};
        (d.services || []).forEach(s => { const p = s.provider || "mtp"; counts[p] = (counts[p] || 0) + 1; });
        setSvcCounts(counts);
      }
      if (statusRes.ok) { const d = await statusRes.json(); setEnvStatus(d.status || {}); }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const testConnection = async (provider) => {
    setTesting(provider.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", provider: provider.id }) });
      const data = await res.json();
      if (res.ok) {
        const usd = parseFloat(data.balance?.balance || 0);
        let rate = 1600;
        try { const sr = await fetch("/api/admin/settings"); if (sr.ok) { const sd = await sr.json(); rate = Number(sd.settings?.markup_usd_rate) || 1600; } } catch {}
        const ngn = Math.round(usd * rate);
        setResult({ id: provider.id, type: "success", message: `Connected! Provider balance: ₦${ngn.toLocaleString()} (≈$${usd.toFixed(2)} at ₦${rate}/$)` });
      }
      else setResult({ id: provider.id, type: "error", message: data.error || "Connection failed" });
    } catch (e) { setResult({ id: provider.id, type: "error", message: e.message || "Network error" }); }
    setTesting(null);
  };

  const syncServices = async (provider) => {
    setSyncing(provider.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync", provider: provider.id }) });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        setResult({ id: provider.id, type: "error", message: res.status === 504 ? "Sync timed out — try again or upgrade Vercel to Pro" : `Server error (${res.status})` });
        setSyncing(null); return;
      }
      if (res.ok) {
        setResult({ id: provider.id, type: "success", message: `Synced! ${data.created} new, ${data.updated} updated${data.disabled ? `, ${data.disabled} disabled` : ''}, ${data.skipped} skipped (${data.total} total)` });
        loadData();
      } else setResult({ id: provider.id, type: "error", message: data.error || "Sync failed" });
    } catch (e) { setResult({ id: provider.id, type: "error", message: e.message || "Network error" }); }
    setSyncing(null);
  };

  if (loading) return <div className="p-6">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[100px] rounded-[14px] mb-3`} />)}</div>;

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>API Management</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>SMM provider connections · {Object.values(svcCounts).reduce((a, b) => a + b, 0).toLocaleString()} services in database</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="py-3 px-4 rounded-[10px] mt-4 mb-4 text-sm leading-relaxed" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.19)" : "rgba(196,125,142,.14)"}`, color: t.textSoft }}>
        API keys are configured via environment variables for security. Add them in your <strong style={{ color: t.text }}>.env</strong> file locally or in <strong style={{ color: t.text }}>Vercel → Settings → Environment Variables</strong> for production.
      </div>

      <div>
        {PROVIDERS.map((p, i) => {
          const configured = envStatus[p.id] || false;
          const pResult = result?.id === p.id ? result : null;

          return (
            <div key={p.id} className="adm-card mb-3 rounded-[14px]" style={{ background: t.cardBg, border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
              <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                <div className="adm-header-row">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold" style={{ color: t.text }}>{p.name}</span>
                      <span className="text-xs py-0.5 px-[7px] rounded font-semibold" style={{ background: configured ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: configured ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{configured ? "connected" : "not configured"}</span>
                    </div>
                    <div className="text-sm mt-1" style={{ color: t.textMuted }}>{p.url || "URL pending"}</div>
                  </div>
                  <div className="flex gap-1.5">
                    {configured && <button onClick={() => testConnection(p)} disabled={testing === p.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#a5b4fc" : "#4f46e5", opacity: testing === p.id ? .5 : 1 }}>{testing === p.id ? "Testing..." : "Test"}</button>}
                    {configured && <button onClick={() => syncServices(p)} disabled={syncing === p.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669", opacity: syncing === p.id ? .5 : 1 }}>{syncing === p.id ? "Syncing..." : "Sync Services"}</button>}
                  </div>
                </div>
              </div>
              <div className="set-card-body">

              {pResult && <InlineAlert type={pResult.type} dark={dark} className="mt-2.5">{pResult.message}</InlineAlert>}

              <div className="grid grid-cols-3 gap-3 text-[13px]">
                <div><span style={{ color: t.textMuted }}>Env var:</span> <span style={{ color: t.textSoft }}>{p.envKey}</span></div>
                <div><span style={{ color: t.textMuted }}>Services:</span> <span style={{ color: t.text }}>{(svcCounts[p.id] || 0).toLocaleString()}</span></div>
                <div><span style={{ color: t.textMuted }}>Priority:</span> <span style={{ color: t.text }}>{i + 1}</span></div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ TRACKING LINKS                      ═══ */
/* ═══════════════════════════════════════════ */

const countryFlag = (code) => { if (!code) return ''; try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); } catch { return ''; } };
const countryName = (code) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code); } catch { return code; } };

function MiniBar({ pct, color, dark }) {
  return (
    <div className="h-[6px] rounded-full flex-1 overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function SparkChart({ data, color, height = 64 }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-[2px] transition-all duration-300 relative group/bar cursor-default" style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: v === max ? color : `${color}55` }}>
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10" style={{ background: "#1a1d2e", color: "#eee", border: "1px solid rgba(255,255,255,.1)" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function DeviceRing({ devices, dark, t }) {
  const total = (devices.mobile || 0) + (devices.desktop || 0) + (devices.tablet || 0);
  if (!total) return null;
  const r = 44, c = 2 * Math.PI * r;
  const mArc = ((devices.mobile || 0) / total) * c;
  const dArc = ((devices.desktop || 0) / total) * c;
  const tArc = ((devices.tablet || 0) / total) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#c47d8e" strokeWidth="8" strokeDasharray={`${mArc} ${c}`} strokeDashoffset="0" strokeLinecap="round" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#60a5fa" strokeWidth="8" strokeDasharray={`${dArc} ${c}`} strokeDashoffset={-mArc} strokeLinecap="round" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#a78bfa" strokeWidth="8" strokeDasharray={`${tArc} ${c}`} strokeDashoffset={-(mArc + dArc)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold" style={{ color: t.text }}>{total.toLocaleString()}</div>
        <div className="text-[10px]" style={{ color: t.textMuted }}>clicks</div>
      </div>
    </div>
  );
}

function LinkAnalyticsDetail({ link, analytics, analyticsLoading, range, setRange, dark, t }) {
  const cardStyle = { background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` };
  const sk = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
  if (analyticsLoading) return (
    <div style={{ animation: "fadeIn .2s ease" }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => <div key={i} className={`${sk} h-[88px] rounded-xl`} />)}
      </div>
      <div className={`${sk} h-[140px] rounded-xl mb-4`} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[1,2,3].map(i => <div key={i} className={`${sk} h-[180px] rounded-xl`} />)}
      </div>
      <div className={`${sk} h-[60px] rounded-xl mb-4`} />
      <div className={`${sk} h-[80px] rounded-xl`} />
    </div>
  );
  if (!analytics) return null;

  const hasAnyData = analytics.totalClicks > 0 || (link.signups || 0) > 0 || (link.orders || 0) > 0;
  if (!hasAnyData) {
    return (
      <div style={{ animation: "fadeIn .2s ease" }}>
        <div className="rounded-xl p-8 text-center" style={cardStyle}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <div className="text-sm font-semibold mb-1" style={{ color: t.text }}>No activity yet</div>
          <div className="text-[13px]" style={{ color: t.textMuted }}>Share this link to start tracking analytics</div>
        </div>
      </div>
    );
  }

  const convRate = analytics.totalClicks > 0 ? ((link.signups / analytics.totalClicks) * 100).toFixed(1) : "0";
  const orderRate = link.signups > 0 ? ((link.orders / link.signups) * 100).toFixed(1) : "0";

  const timelineData = range === "24h"
    ? Array.from({ length: 24 }, (_, h) => { const m = analytics.timeline.find(t => t.bucket === h); return m ? m.clicks : 0; })
    : analytics.timeline.map(t => t.clicks);
  const signupTimelineData = range === "24h"
    ? Array.from({ length: 24 }, (_, h) => { const m = (analytics.signupTimeline || []).find(t => t.bucket === h); return m ? m.signups : 0; })
    : (analytics.signupTimeline || []).map(t => t.signups);
  const timelineLabels = range === "24h"
    ? Array.from({ length: 24 }, (_, i) => `${i}:00`)
    : analytics.timeline.map(t => { const d = new Date(t.bucket); return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); });

  const browserColors = { Chrome: "#4caf50", Safari: "#60a5fa", Firefox: "#ff9800", Instagram: "#e040fb", Facebook: "#1877f2", TikTok: "#ff0050", Edge: "#03a9f4", Opera: "#ff1b2d" };
  const accentColors = ["#c47d8e", "#60a5fa", "#a78bfa", "#6ee7b7", "#fcd34d", "#f43f5e", "#f97316", "#06b6d4"];

  return (
    <div style={{ animation: "fadeIn .2s ease" }}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          ["Total Clicks", analytics.totalClicks.toLocaleString(), `${analytics.uniqueClicks.toLocaleString()} unique`, t.accent],
          ["Signups", (link.signups || 0).toLocaleString(), `${convRate}% conversion`, dark ? "#a5b4fc" : "#6366f1"],
          ["Orders", (link.orders || 0).toLocaleString(), `${orderRate}% of signups`, dark ? "#6ee7b7" : "#059669"],
          ["Revenue", fN(analytics.periodRevenue || (link.revenue || 0) / 100), `${fN(analytics.periodProfit || 0)} profit`, dark ? "#fcd34d" : "#d97706"],
        ].map(([label, val, sub, color]) => (
          <div key={label} className="rounded-xl p-3.5 relative overflow-hidden" style={cardStyle}>
            <div className="text-[10px] font-semibold uppercase tracking-[1.5px] mb-1.5" style={{ color: t.textMuted }}>{label}</div>
            <div className="text-xl font-bold" style={{ color }}>{val}</div>
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: t.text }}>Click Timeline</div>
              <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{range === "24h" ? "Today, by hour" : range === "7d" ? "Last 7 days" : "Last 30 days"}</div>
            </div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
              {["24h", "7d", "30d"].map(p => (
                <button key={p} onClick={() => setRange(p)} className="px-3 py-1.5 text-[11px] font-semibold border-none cursor-pointer" style={{ background: range === p ? "rgba(196,125,142,.15)" : "transparent", color: range === p ? t.accent : t.textMuted }}>{p}</button>
              ))}
            </div>
          </div>
          <div className="relative">
            <SparkChart data={timelineData} color={t.accent} height={72} />
            {signupTimelineData.some(v => v > 0) && (
              <div className="absolute inset-0" style={{ opacity: 0.5 }}>
                <SparkChart data={signupTimelineData} color={dark ? "#a5b4fc" : "#6366f1"} height={72} />
              </div>
            )}
          </div>
          {signupTimelineData.some(v => v > 0) && (
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: t.accent }} /><span className="text-[10px]" style={{ color: t.textMuted }}>Clicks</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: dark ? "#a5b4fc" : "#6366f1" }} /><span className="text-[10px]" style={{ color: t.textMuted }}>Signups</span></div>
            </div>
          )}
          {timelineLabels.length <= 14 && (
            <div className="flex justify-between mt-2">
              {timelineLabels.map((l, i) => (
                range === "24h"
                  ? (i % 4 === 0 && <span key={i} className="text-[9px]" style={{ color: t.textMuted }}>{l}</span>)
                  : <span key={i} className="text-[9px] flex-1 text-center" style={{ color: t.textMuted }}>{l}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-col: Devices / Countries / Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Devices */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Devices</div>
          <div className="flex justify-center mb-3"><DeviceRing devices={analytics.devices} dark={dark} t={t} /></div>
          <div className="space-y-2">
            {[
              { label: "Mobile", val: analytics.devices.mobile || 0, color: "#c47d8e", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
              { label: "Desktop", val: analytics.devices.desktop || 0, color: "#60a5fa", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
              { label: "Tablet", val: analytics.devices.tablet || 0, color: "#a78bfa", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-2">
                <span style={{ color: d.color }}>{d.icon}</span>
                <span className="text-[12px] flex-1" style={{ color: t.text }}>{d.label}</span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: d.color }}>{d.val.toLocaleString()}</span>
                <span className="text-[10px] w-8 text-right" style={{ color: t.textMuted }}>{analytics.totalClicks ? ((d.val / analytics.totalClicks) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Top Countries</div>
          {analytics.countries.length === 0 ? <div className="text-[12px] py-4 text-center" style={{ color: t.textMuted }}>No geo data yet</div> : (
            <div className="space-y-2.5">
              {analytics.countries.map((c, i) => (
                <div key={c.code}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px]">{countryFlag(c.code)}</span>
                    <span className="text-[12px] flex-1" style={{ color: t.text }}>{countryName(c.code)}</span>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: t.accent }}>{c.clicks.toLocaleString()}</span>
                  </div>
                  <MiniBar pct={(c.clicks / analytics.totalClicks) * 100} color={i === 0 ? t.accent : `${t.accent}66`} dark={dark} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referrers */}
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Traffic Sources</div>
          {analytics.referrers.length === 0 ? <div className="text-[12px] py-4 text-center" style={{ color: t.textMuted }}>No referrer data yet</div> : (
            <div className="space-y-2.5">
              {analytics.referrers.map((r, i) => {
                const pct = analytics.totalClicks ? ((r.clicks / analytics.totalClicks) * 100).toFixed(0) : 0;
                return (
                  <div key={r.source}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColors[i % accentColors.length] }} />
                      <span className="text-[12px] flex-1" style={{ color: t.text }}>{r.source}</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: accentColors[i % accentColors.length] }}>{pct}%</span>
                    </div>
                    <MiniBar pct={pct} color={accentColors[i % accentColors.length]} dark={dark} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Browsers */}
      {analytics.browsers.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={cardStyle}>
          <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Browsers</div>
          <div className="flex gap-2 flex-wrap">
            {analytics.browsers.map(b => {
              const bc = browserColors[b.name] || t.textMuted;
              const pct = analytics.totalClicks ? ((b.clicks / analytics.totalClicks) * 100).toFixed(0) : 0;
              return (
                <div key={b.name} className="rounded-lg py-2 px-3 flex items-center gap-2" style={{ background: `${bc}10`, border: `1px solid ${bc}25` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: bc }} />
                  <span className="text-[12px] font-medium" style={{ color: t.text }}>{b.name}</span>
                  <span className="text-[11px] font-semibold" style={{ color: bc }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OS + Cities */}
      {((analytics.os || []).length > 0 || (analytics.cities || []).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {(analytics.os || []).length > 0 && (
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Operating Systems</div>
              <div className="flex gap-2 flex-wrap">
                {analytics.os.map((o, i) => {
                  const pct = analytics.totalClicks ? ((o.clicks / analytics.totalClicks) * 100).toFixed(0) : 0;
                  return (
                    <div key={o.name} className="rounded-lg py-2 px-3 flex items-center gap-2" style={{ background: `${accentColors[i % accentColors.length]}10`, border: `1px solid ${accentColors[i % accentColors.length]}25` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColors[i % accentColors.length] }} />
                      <span className="text-[12px] font-medium" style={{ color: t.text }}>{o.name}</span>
                      <span className="text-[11px] font-semibold" style={{ color: accentColors[i % accentColors.length] }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(analytics.cities || []).length > 0 && (
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Top Cities</div>
              <div className="space-y-2.5">
                {analytics.cities.map((c, i) => (
                  <div key={c.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] flex-1" style={{ color: t.text }}>{c.name}</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: t.accent }}>{c.clicks.toLocaleString()}</span>
                    </div>
                    <MiniBar pct={(c.clicks / analytics.totalClicks) * 100} color={i === 0 ? t.accent : `${t.accent}66`} dark={dark} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversion funnel */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="text-sm font-semibold mb-3" style={{ color: t.text }}>Conversion Funnel</div>
        <div className="flex items-center gap-2">
          {[
            { label: "Clicks", val: analytics.totalClicks, color: t.accent },
            { label: "Unique", val: analytics.uniqueClicks, color: dark ? "#f59e0b" : "#d97706" },
            { label: "Signups", val: link.signups || 0, color: dark ? "#a5b4fc" : "#6366f1" },
            { label: "Orders", val: link.orders || 0, color: dark ? "#6ee7b7" : "#059669" },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1 text-center">
                <div className="text-lg font-bold mb-0.5" style={{ color: step.color }}>{step.val.toLocaleString()}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: t.textMuted }}>{step.label}</div>
                {i > 0 && arr[i-1].val > 0 && <div className="text-[10px] mt-0.5 font-semibold" style={{ color: step.color }}>{((step.val / arr[i-1].val) * 100).toFixed(1)}%</div>}
              </div>
              {i < arr.length - 1 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)"} strokeWidth="2" strokeLinecap="round" className="shrink-0"><polyline points="9 18 15 12 9 6"/></svg>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinkAccordion({ link, dark, t, baseUrl, copied, copyLink, canManage, handleDelete, handleArchive, onViewAnalytics, last, rowBorder }) {
  const [open, setOpen] = useState(false);
  const hasActivity = (link.clicks || 0) + (link.signups || 0) > 0;
  const statusColor = link.archivedAt ? (dark ? "#fcd34d" : "#d97706") : t.accent;
  return (
    <div style={!last ? rowBorder : {}}>
      <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }} onClick={() => setOpen(v => !v)} className="flex items-center gap-3 py-3.5 px-1 cursor-pointer transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.04)]" style={{ userSelect: "none" }}>
        <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: `${statusColor}15` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-semibold" style={{ color: t.text }}>{link.name}</span>
            {link.archivedAt && <span className="text-[10px] py-0.5 px-1.5 rounded-full font-semibold" style={{ background: dark ? "rgba(217,119,6,.1)" : "rgba(217,119,6,.05)", color: dark ? "#fcd34d" : "#d97706" }}>Archived</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: t.textMuted }}>
            {hasActivity ? <><span>{(link.clicks || 0).toLocaleString()} clicks</span><span className="opacity-30">·</span><span>{link.signups || 0} signups</span><span className="opacity-30">·</span><span>{link.orders || 0} orders</span><span className="opacity-30">·</span><span>{fN((link.revenue || 0) / 100)} rev</span></> : <span>No activity yet</span>}
            <span className="opacity-30">·</span>
            <span>{new Date(link.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => handleArchive(link)} className="bg-transparent border-none cursor-pointer p-1 transition-opacity hover:opacity-70" style={{ color: dark ? "#fcd34d" : "#d97706" }} title={link.archivedAt ? "Restore" : "Archive"}>
              {link.archivedAt
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>}
            </button>
            {!link.archivedAt && (
              <button onClick={() => handleDelete(link)} className="bg-transparent border-none cursor-pointer p-1 transition-opacity hover:opacity-70" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            )}
          </div>
        )}
        <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {open && (
        <div className="pb-3.5 px-1" style={{ animation: "fadeIn .15s ease" }}>
          <div className="flex items-center gap-2 mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            <span className="text-[12px] font-mono truncate flex-1" style={{ color: t.textSoft }}>{baseUrl}/go/{link.slug}</span>
            <button onClick={(e) => { e.stopPropagation(); copyLink(link.slug); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: copied === link.slug ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>
              {copied === link.slug ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              ["Clicks", (link.clicks || 0).toLocaleString(), t.accent],
              ["Signups", (link.signups || 0).toLocaleString(), dark ? "#a5b4fc" : "#6366f1"],
              ["Orders", (link.orders || 0).toLocaleString(), dark ? "#6ee7b7" : "#059669"],
              ["Revenue", fN((link.revenue || 0) / 100), dark ? "#fcd34d" : "#d97706"],
            ].map(([label, val, color]) => (
              <div key={label} className="py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }}>
                <div className="text-[14px] font-bold" style={{ color }}>{val}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[1px] mt-0.5" style={{ color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </div>

          <button onClick={(e) => { e.stopPropagation(); onViewAnalytics(link); }} className="w-full py-2.5 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-all duration-200 hover:-translate-y-px flex items-center justify-center gap-1.5" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            View Analytics
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminAcquisitionPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);
  const [detailLink, setDetailLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [range, setRange] = useState("7d");
  const [viewFilter, setViewFilter] = useState("active");
  const [archivedCount, setArchivedCount] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nitro.ng";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`;
  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };
  const rowBorder = { borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` };

  const load = () => {
    const params = viewFilter === "archived" ? "?includeArchived=true" : "";
    fetch(`/api/admin/acquisition${params}`).then(r => r.json()).then(d => {
      setLinks(d.links || []);
      setCanManage(d.canManage);
      setArchivedCount(d.archivedCount || 0);
      setLoading(false);
      setPage(1);
    }).catch(() => setLoading(false));
  };
  useEffect(load, [viewFilter]);

  const loadAnalytics = useCallback((linkId, r) => {
    setAnalyticsLoading(true);
    fetch(`/api/admin/acquisition/analytics?linkId=${linkId}&range=${r}`)
      .then(res => res.json())
      .then(d => { setAnalytics(d.error ? null : d); setAnalyticsLoading(false); })
      .catch(() => { setAnalytics(null); setAnalyticsLoading(false); });
  }, []);

  const openAnalytics = useCallback((link) => {
    setDetailLink(link);
    setRange("7d");
    loadAnalytics(link.id, "7d");
  }, [loadAnalytics]);

  useEffect(() => {
    if (detailLink) loadAnalytics(detailLink.id, range);
  }, [range]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/acquisition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newName.trim(), slug: newSlug.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error); setSaving(false); return; }
      toast.success("Link created");
      setNewName(""); setNewSlug(""); setShowAdd(false); load();
    } catch { toast.error("Failed"); }
    setSaving(false);
  };

  const handleArchive = async (link) => {
    const isArchived = !!link.archivedAt;
    if (!isArchived) {
      const ok = await confirm(`Archive "${link.name}"?`, "Archived links are hidden from the main list but can be restored anytime.");
      if (!ok) return;
    }
    await fetch("/api/admin/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isArchived ? "unarchive" : "archive", id: link.id }),
    });
    toast.success(isArchived ? "Link restored" : "Link archived");
    load();
  };

  const handleDelete = async (link) => {
    const ok = await confirm(`Delete "${link.name}"?`, link.signups > 0 ? "This link has signups — archive it instead to keep the data." : "This cannot be undone.");
    if (!ok) return;
    const res = await fetch("/api/admin/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: link.id }),
    });
    const d = await res.json();
    if (d.soft) toast.info("Link disabled (has signups — use Archive instead)");
    else toast.success("Link deleted");
    load();
  };

  const copyLink = (slug) => {
    copyText(`${baseUrl}/go/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const displayLinks = viewFilter === "archived" ? links.filter(l => l.archivedAt) : links.filter(l => !l.archivedAt);
  const totalPages = Math.ceil(displayLinks.length / perPage);
  const paginatedLinks = displayLinks.slice((page - 1) * perPage, page * perPage);

  const totalClicks = displayLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalSignups = displayLinks.reduce((s, l) => s + (l.signups || 0), 0);
  const totalOrders = displayLinks.reduce((s, l) => s + (l.orders || 0), 0);
  const totalRevenue = displayLinks.reduce((s, l) => s + (l.revenue || 0), 0);

  if (loading) {
    const sk = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Tracking Links</div><div className={`${sk} h-4 w-72 rounded mt-2`} /><div className="page-divider" style={{ background: t.cardBorder }} /></div><div className="adm-stats mb-5">{[1,2,3,4,5].map(i => <div key={i} className={`${sk} h-[72px] rounded-xl`} />)}</div><div className={`${sk} h-[52px] rounded-xl mb-3`} />{[1,2,3].map(i => <div key={i} className={`${sk} h-[62px] rounded-[10px] mb-2`} />)}</>;
  }

  if (detailLink) {
    return (
      <>
        <div className="adm-header">
          <div className="flex items-center gap-3">
            <button onClick={() => { setDetailLink(null); setAnalytics(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center border border-solid cursor-pointer transition-all duration-200 hover:-translate-y-px shrink-0" style={{ background: "transparent", borderColor: t.cardBorder, color: t.textMuted }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="adm-title" style={{ color: t.text }}>{detailLink.name}</div>
              <div className="text-[12px] font-mono mt-0.5" style={{ color: t.textMuted }}>{baseUrl}/go/{detailLink.slug}</div>
            </div>
          </div>
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>
        <LinkAnalyticsDetail link={detailLink} analytics={analytics} analyticsLoading={analyticsLoading} range={range} setRange={setRange} dark={dark} t={t} />
      </>
    );
  }

  return (
    <>
      <div className="adm-header">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Tracking Links</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Create tracking links and see who clicks, where they come from, and what they do</div>
          </div>
          {(links.length > 0 || archivedCount > 0) && (
            <SegPill value={viewFilter} options={[{ value: "active", label: "Active" }, { value: "archived", label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}` }]} onChange={v => { setViewFilter(v); setPage(1); }} dark={dark} t={t} />
          )}
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ Summary Stats ═══ */}
      {displayLinks.length > 0 && (
        <div className="adm-stats mb-5">
          {[
            ["Total Links", displayLinks.length, t.accent],
            ["Clicks", totalClicks.toLocaleString(), dark ? "#f59e0b" : "#d97706"],
            ["Signups", totalSignups.toLocaleString(), dark ? "#a5b4fc" : "#6366f1"],
            ["Orders", totalOrders.toLocaleString(), dark ? "#6ee7b7" : "#059669"],
            ["Revenue", fN(totalRevenue / 100), dark ? "#fcd34d" : "#d97706"],
          ].map(([label, val, color]) => (
            <div key={label} className="py-3.5 px-4 rounded-xl relative overflow-hidden" style={{ background: cardBg, border: cardBd, borderLeft: `3px solid ${color}` }}>
              <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>{label}</div>
              <div className="text-xl font-bold" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Links Card ═══ */}
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div>
            <div className="set-card-title" style={{ color: t.textMuted }}>Tracking Links</div>
            <div className="set-card-desc" style={{ color: t.textSoft }}>Share these URLs in ads, bios, or with influencers</div>
          </div>
          {canManage && <button onClick={() => setShowAdd(!showAdd)} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.accent }}>{showAdd ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New</>}</button>}
        </div>

        {/* ═══ Create Form ═══ */}
        {showAdd && (
          <div className="p-4" style={rowBorder}>
            <div className="mb-3">
              <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Campaign Name</label>
              <input value={newName} onChange={e => { setNewName(e.target.value); setNewSlug(e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/,'')); }} placeholder="e.g. Davido Promo" className={inputCls} style={inputStyle} />
            </div>
            {newName.trim() && (
              <div className="py-2 px-3 rounded-lg mb-3 text-[13px] font-mono" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", color: t.textMuted }}>
                {baseUrl}/go/{newSlug}
              </div>
            )}
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="adm-btn-primary" style={{ opacity: (saving || !newName.trim()) ? .5 : 1 }}>
              {saving ? "Creating..." : "Create Link"}
            </button>
          </div>
        )}

        {/* ═══ Info callout ═══ */}
        <div className="set-card-body">
          <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.textMuted }}>
            Share <span className="font-mono text-[12px]">nitro.ng/go/your-slug</span> in ads, bios, or with influencers. Every click is tracked — device, location, browser, and source — plus signups and revenue.
          </div>

          {/* ═══ Links List ═══ */}
          {displayLinks.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>
                Showing {displayLinks.length} {viewFilter === "archived" ? "archived " : ""}link{displayLinks.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {displayLinks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm font-medium mb-1" style={{ color: t.text }}>{viewFilter === "archived" ? "No archived links" : "No links yet"}</div>
              <div className="text-[13px]" style={{ color: t.textMuted }}>{viewFilter === "archived" ? "Archived links will appear here" : "Click \"+ New\" above to create your first tracking link"}</div>
            </div>
          ) : paginatedLinks.map((link, i) => (
            <LinkAccordion key={link.id} link={link} dark={dark} t={t} baseUrl={baseUrl} copied={copied} copyLink={copyLink} canManage={canManage} handleDelete={handleDelete} handleArchive={handleArchive} onViewAnalytics={openAnalytics} last={i === paginatedLinks.length - 1} rowBorder={rowBorder} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 1 ? .35 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Prev
              </button>
              <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages ? .35 : 1 }}>
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════ */
/* ═══ ADMIN ISSUES PAGE                   ═══ */
/* ═══════════════════════════════════════════ */

const PROVIDER_NAMES = { mtp: "MoreThanPanel", jap: "JustAnotherPanel", dao: "DaoSMM" };
const LOW_BALANCE_USD = 10;
// How loud an issue is: red needs a decision from a person, amber can wait a day, grey is routine.
const ISSUE_SEVERITY = { crypto_payment_review: "high", order_failure: "high", void_failed: "high", low_balance: "medium", dangling_tier: "medium", dead_service: "medium", ghost_dispatch: "medium", price_alert: "medium", revived_service: "low" };
const ISSUE_KIND = { crypto_payment_review: "Payment", order_failure: "Order", void_failed: "Commission", low_balance: "Balance", dangling_tier: "Menu", dead_service: "Catalogue", revived_service: "Catalogue", ghost_dispatch: "Dispatch", price_alert: "Pricing" };
const CHECKS = [
  ["Provider balances", "every 30 min", "low_balance"],
  ["Prices below cost", "every 6 hours", "price_alert"],
  ["Catalogue changes", "nightly, 1 to 3 am", "revived_service"],
  ["Menu items on disabled services", "nightly", "dangling_tier"],
  ["Stuck dispatches", "every 5 min", "ghost_dispatch"],
];

export function AdminIssuesPage({ dark, t }) {
  const [issues, setIssues] = useState([]);
  const [balances, setBalances] = useState(null);
  const [priceAlerts, setPriceAlerts] = useState(null);
  const [canResolveCryptoReviews, setCanResolveCryptoReviews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [firingCrons, setFiringCrons] = useState(false);
  const [cronResults, setCronResults] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showAllHandled, setShowAllHandled] = useState(false);
  const toast = useToast();
  const load = () => {
    fetch("/api/admin/issues").then(r => r.json()).then(d => {
      setIssues(d.issues || []);
      setBalances(d.balances || null);
      setPriceAlerts(d.priceAlerts || null);
      setCanResolveCryptoReviews(d.canResolveCryptoReviews === true);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const act = async (id, action) => {
    setResolving(id);
    try {
      const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, issueId: id }) });
      const d = await res.json();
      if (res.ok) { load(); toast.success(d.detail || (action === "resolve" ? "Resolved" : "Ignored")); }
      else { if (res.status === 409) load(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Network error"); }
    setResolving(null);
  };
  const runChecks = async () => {
    setFiringCrons(true); setCronResults(null);
    try {
      const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fire_crons" }) });
      const d = await res.json();
      if (res.ok) { setCronResults(d.results || []); toast.success("Checks run", `${(d.results || []).filter(r => r.ok).length} of ${(d.results || []).length} came back clean`); setTimeout(() => load(), 2000); }
      else toast.error(d.error || "Could not run the checks");
    } catch { toast.error("Network error"); }
    setFiringCrons(false);
  };

  const SEV_RANK = { high: 0, medium: 1, low: 2 };
  const open = issues.filter(i => i.status === "open").sort((a, b) => (SEV_RANK[ISSUE_SEVERITY[a.type] || "low"] - SEV_RANK[ISSUE_SEVERITY[b.type] || "low"]) || (new Date(b.createdAt) - new Date(a.createdAt)));
  const handled = issues.filter(i => i.status !== "open").sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  const sevOf = (i) => ISSUE_SEVERITY[i.type] || "low";
  const kindOf = (i) => ISSUE_KIND[i.type] || "Other";
  const decisions = open.filter(i => sevOf(i) === "high").length;
  const balanceEntries = balances ? Object.entries(balances).filter(([k, v]) => k !== "checkedAt" && v && typeof v === "object") : [];
  const losers = priceAlerts?.losers || [];
  const lastOf = (type) => { const hit = issues.find(i => i.type === type); return hit ? hit.createdAt : null; };
  const metaOf = (i) => { try { return i.metadata ? JSON.parse(i.metadata) : null; } catch { return null; } };
  const when = (iso) => { if (!iso) return "—"; const d = new Date(iso); const diff = Date.now() - d.getTime(); if (diff < 3600e3) return `${Math.max(1, Math.round(diff / 60e3))} min ago`; if (diff < 86400e3) return `${Math.round(diff / 3600e3)} h ago`; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  const labelsFor = (i) => i.type === "crypto_payment_review" ? ["Approve", "Reject"] : ["Resolve", "Ignore"];
  const canAct = (i) => i.type !== "crypto_payment_review" || canResolveCryptoReviews;
  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--warnbg": dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)", "--bad": dark ? "#fca5a5" : "#c62828", "--badbg": dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.07)",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  return (
    <div className="is" style={vars}>
      <style>{IS_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Issues</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>What needs a person today, and what the checks found.</div>
          </div>
          <button type="button" className="is-b" onClick={runChecks} disabled={firingCrons}>{firingCrons ? "Running…" : "Run all checks now"}</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <>{bone(84)}{bone(220)}<div className="is-cols">{bone(200)}{bone(200)}</div></> : <>
        <div className="is-stats">
          <div className={"is-stt" + (decisions ? " bad" : open.length ? " warn" : "")}><b className="m">{open.length}</b><span>Open</span><i>{decisions ? `${decisions} need${decisions === 1 ? "s" : ""} a decision` : open.length ? "nothing urgent" : "all clear"}</i></div>
          {balanceEntries.slice(0, 3).map(([pid, v]) => (
            <div key={pid} className="is-stt"><b className={"m " + (v.balance < LOW_BALANCE_USD ? "bad" : v.balance < 20 ? "warn" : "ok")}>${Number(v.balance || 0).toFixed(2)}</b><span>{PROVIDER_NAMES[pid] || pid}</span><i>{v.balance < LOW_BALANCE_USD ? "below $10, top up" : v.balance < 20 ? "below $20" : "fine"}</i></div>
          ))}
        </div>

        <section className="is-card">
          <header><h3>Open</h3><span className="is-cnt">newest first · red needs a decision, amber can wait a day</span></header>
          <div className="is-cb">
            {open.length === 0 ? <div className="is-empty">Nothing open. The checks keep running on their own.</div> : open.map(i => {
              const sev = sevOf(i); const [yes, no] = labelsFor(i); const meta = metaOf(i); const isOpen = expanded === i.id;
              return (
                <div key={i.id} className={`is-ir ${sev}`}>
                  <span className="is-bar" />
                  <span className="is-it" onClick={() => setExpanded(isOpen ? null : i.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isOpen ? null : i.id); } }}>
                    <b>{i.title}</b>
                    <i>{i.message || ""}</i>
                    {isOpen && meta && <span className="is-meta">{Object.entries(meta).filter(([k]) => !["losers", "services", "providers"].includes(k)).map(([k, v]) => <span key={k}><em>{k}</em> {typeof v === "object" ? JSON.stringify(v) : String(v)}</span>)}</span>}
                  </span>
                  <span className="is-ty">{kindOf(i)}</span>
                  <span className="is-when">{when(i.createdAt)}</span>
                  <span className="is-acts">
                    {canAct(i) ? <><button type="button" className="is-b sm pri" disabled={resolving === i.id} onClick={() => act(i.id, "resolve")}>{resolving === i.id ? "…" : yes}</button><button type="button" className="is-b sm" disabled={resolving === i.id} onClick={() => act(i.id, "ignore")}>{no}</button></> : <span className="is-dimc">owner decides</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {losers.length > 0 && (
          <section className="is-card">
            <header><h3>Selling below cost</h3><span className="is-cnt">{losers.length} tier{losers.length === 1 ? "" : "s"} · checked {when(priceAlerts.checkedAt)}</span></header>
            <div className="is-cb tight">
              {losers.map((l, idx) => (
                <div key={idx} className="is-lr"><span className="is-ln">{l.group || l.name || l.service || "Tier"}{l.tier ? ` · ${l.tier}` : ""}</span><span className="m is-dimc">sells {fN(l.sell ?? l.sellPer1k ?? 0)} · costs {fN(l.cost ?? l.costPer1k ?? 0)}</span></div>
              ))}
            </div>
          </section>
        )}

        <div className="is-cols">
          <section className="is-card">
            <header><h3>Checks</h3><span className="is-cnt">what runs on its own, and when it last found something</span></header>
            <div className="is-cb tight">
              {CHECKS.map(([name, every, type]) => {
                const last = type === "low_balance" ? balances?.checkedAt : type === "price_alert" ? priceAlerts?.checkedAt : lastOf(type);
                const openNow = open.filter(i => i.type === type || (type === "revived_service" && i.type === "dead_service")).length;
                return <div key={type} className="is-ck"><span className={"is-dot " + (openNow ? "warn" : "ok")} /><span className="is-ckn">{name}</span><span className="is-ckw">{every}{last ? ` · ${type === "low_balance" || type === "price_alert" ? "checked" : "last found"} ${when(last)}` : ""}</span><span className="is-cks">{openNow ? `${openNow} open` : "clear"}</span></div>;
              })}
              {cronResults && (
                <div className="is-results">
                  <span className="is-lbl">Just now</span>
                  {cronResults.map((r, idx) => <span key={idx} className={"is-res " + (r.ok ? "ok" : "bad")}>{String(r.cron || "").replace("/api/cron/", "")}{r.ok ? "" : ` · ${r.error || "failed"}`}</span>)}
                </div>
              )}
            </div>
          </section>
          <section className="is-card">
            <header><h3>Handled</h3><span className="is-cnt">{handled.length ? `${Math.min(handled.length, showAllHandled ? handled.length : 8)} of ${handled.length}` : "nothing yet"}{handled.length > 8 && <> · <button type="button" className="is-link" onClick={() => setShowAllHandled(v => !v)}>{showAllHandled ? "fewer" : "all"}</button></>}</span></header>
            <div className="is-cb tight">
              {handled.slice(0, showAllHandled ? handled.length : 8).map(i => (
                <div key={i.id} className="is-dr" title={i.resolvedBy ? `${i.status === "ignored" ? "Ignored" : "Resolved"} by ${i.resolvedBy}` : ""}><span className="is-dw">{when(i.resolvedAt || i.createdAt)}</span><span className="is-dt">{kindOf(i)}</span><span className="is-dtt">{i.title}</span><span className={"is-ds " + i.status}>{i.status}</span></div>
              ))}
            </div>
          </section>
        </div>
      </>}
    </div>
  );
}

const IS_CSS = `
.is{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.is *{box-sizing:border-box}
.is .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.is-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.is-b:hover{transform:translateY(-1px)}.is-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.is-b.sm{height:30px;padding:0 10px;font-size:12px}.is-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.is-link{font:inherit;font-size:inherit;font-weight:600;color:var(--ac);background:none;border:0;cursor:pointer;padding:0}
.is-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.is-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.is-stt:first-child{border-left:0}
.is-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}.is-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px}.is-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-stt.bad b,.is-stt b.bad{color:var(--bad)}.is-stt.warn b,.is-stt b.warn{color:var(--warn)}.is-stt b.ok{color:var(--ok)}
.is-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.is-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.is-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.is-cnt{font-size:11.5px;color:var(--dim)}
.is-cb{padding:0}.is-cb.tight{padding:4px 16px 8px}
.is-ir{display:grid;grid-template-columns:4px 1fr 86px 92px auto;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-top:1px solid var(--rail)}.is-ir:first-child{border-top:0}
.is-bar{width:4px;min-height:36px;align-self:stretch;border-radius:2px;background:var(--dim)}.is-ir.medium .is-bar{background:var(--warn)}.is-ir.high .is-bar{background:var(--bad)}.is-ir.high{background:var(--badbg)}
.is-it{display:flex;flex-direction:column;gap:2px;min-width:0;cursor:pointer;outline:none}.is-it b{font-size:13.5px;font-weight:600}.is-it i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:11.5px;color:var(--mut)}.is-meta em{font-style:normal;color:var(--dim)}
.is-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;text-align:center;white-space:nowrap}
.is-when{font-size:12px;color:var(--dim);white-space:nowrap}.is-acts{display:flex;gap:6px;justify-content:flex-end}.is-dimc{font-size:12px;color:var(--dim);white-space:nowrap}
.is-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.is-lr{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--rail);font-size:13px}.is-lr:first-child{border-top:0}.is-ln{font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.is-ck{display:grid;grid-template-columns:8px 1fr auto 70px;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--rail);font-size:13px}.is-ck:first-child{border-top:0}
.is-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.is-dot.ok{background:var(--ok)}.is-dot.warn{background:var(--warn)}.is-ckn{font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.is-ckw{font-size:12px;color:var(--mut);white-space:nowrap}.is-cks{font-size:12px;color:var(--dim);text-align:right;white-space:nowrap}
.is-results{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-top:10px;margin-top:4px;border-top:1px solid var(--line)}.is-lbl{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--mut);margin-right:4px}
.is-res{font-size:11.5px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mut)}.is-res.ok{color:var(--ok)}.is-res.bad{color:var(--bad)}
.is-dr{display:grid;grid-template-columns:64px 90px 1fr 70px;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--rail);font-size:13px}.is-dr:first-child{border-top:0}
.is-dw{font-size:11.5px;color:var(--dim);white-space:nowrap}.is-dt{font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mut)}.is-dtt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mut)}.is-ds{font-size:11.5px;text-align:right;font-weight:600;color:var(--ok)}.is-ds.ignored{color:var(--dim)}
@media (max-width:900px){
  .is-stats{grid-template-columns:1fr 1fr}.is-stt:nth-child(3){border-left:0}.is-stt:nth-child(n+3){border-top:1px solid var(--line)}.is-stt b{font-size:17px}
  .is-ir{grid-template-columns:4px 1fr auto;grid-template-areas:"bar it ty" "bar when when" "bar acts acts";gap:6px 10px}.is-bar{grid-area:bar}.is-it{grid-area:it}.is-it i{white-space:normal}.is-ty{grid-area:ty;align-self:start}.is-when{grid-area:when}.is-acts{grid-area:acts;justify-content:stretch}.is-acts .is-b{flex:1}
  .is-cols{grid-template-columns:1fr}
  .is-ck{grid-template-columns:8px 1fr auto;grid-template-areas:"d n s" ". w w"}.is-ck .is-dot{grid-area:d}.is-ckn{grid-area:n}.is-ckw{grid-area:w;white-space:normal}.is-cks{grid-area:s}
  .is-dr{grid-template-columns:64px 1fr 60px;grid-template-areas:"w t s" "w tt tt"}.is-dw{grid-area:w}.is-dt{grid-area:t}.is-dtt{grid-area:tt;white-space:normal}.is-ds{grid-area:s}
}
`;

const TIER_COLORS = { starter: "#6B7280", growth: "#3B82F6", pro: "#c47d8e" };
const STATUS_COLORS_CREW = { pending: "#F59E0B", approved: "#059669", suspended: "#EF4444", rejected: "#6B7280" };

export function AdminChangelogPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), tag: "new", title: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/changelog").then(r => r.json()).then(d => { setEntries(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description are required"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/changelog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      toast.success("Entry added");
      setForm({ date: new Date().toISOString().slice(0, 10), tag: "new", title: "", description: "" });
      setShowAdd(false);
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const remove = async (id, title) => {
    const ok = await confirm({ title: "Delete Entry", message: `Delete "${title}" from the changelog?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      const r = await fetch("/api/changelog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!r.ok) throw new Error("Failed");
      toast.success("Entry deleted");
      load();
    } catch { toast.error("Failed to delete"); }
  };

  const tagColors = { new: { bg: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", text: dark ? "#e8acba" : "#a3586b" }, improved: { bg: dark ? "rgba(96,165,250,.12)" : "rgba(37,99,235,.08)", text: dark ? "#93c5fd" : "#2563eb" }, fixed: { bg: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", text: dark ? "#6ee7b7" : "#059669" } };
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}`, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", color: t.text, fontSize: 14, fontFamily: "'Outfit', sans-serif", outline: "none" };

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-xl font-semibold" style={{ color: t.text }}>Changelog</div>
          <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>{entries.length} entries</div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/changelog" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold py-1.5 px-3 rounded-lg no-underline" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textSoft }}>View page</a>
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs font-semibold py-1.5 px-3 rounded-lg border-none cursor-pointer" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>+ Add entry</button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-xl p-4 mb-4" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ width: 140 }}>
              <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>Tag</label>
              <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="new">New</option>
                <option value="improved">Improved</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Gradual delivery" style={inputStyle} />
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold mb-1 block" style={{ color: t.textMuted }}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What changed and why it matters to users" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div className="flex gap-2">
            <button disabled={saving} onClick={add} className="text-xs font-semibold py-1.5 px-4 rounded-lg border-none cursor-pointer" style={{ background: t.accent, color: "#fff" }}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setShowAdd(false)} className="text-xs font-semibold py-1.5 px-4 rounded-lg border-none cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textSoft }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3 rounded-xl py-3 px-4" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[44px] h-[18px] rounded-md`} />
                  <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[72px] h-[12px] rounded`} />
                </div>
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[14px] rounded mb-1`} style={{ width: `${55 + i * 10}%` }} />
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[80%] h-[12px] rounded`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map(e => {
            const tc = tagColors[e.tag] || tagColors.new;
            return (
              <div key={e.id} className="flex items-start gap-3 rounded-xl py-3 px-4" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold py-0.5 px-2 rounded-md" style={{ background: tc.bg, color: tc.text }}>{e.tag}</span>
                    <span className="text-xs" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{e.date}</span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: t.text }}>{e.title}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: t.textSoft }}>{e.description}</div>
                </div>
                <button onClick={() => remove(e.id, e.title)} className="shrink-0 bg-transparent border-none cursor-pointer p-1 rounded-md hover:opacity-70" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ CREATE ORDER                        ═══ */
/* ═══════════════════════════════════════════ */

export { AdminCreateOrderPage } from "./admin-create-order-page";

