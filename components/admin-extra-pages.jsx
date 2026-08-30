'use client';
import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { SkelFacts, SkelBar, SkelList, Bone } from "./skeleton";
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
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
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
  { id:"alerts", label:"Alerts", g:"System" },{ id:"notifications", label:"Notifications", g:"System" },{ id:"activity", label:"Logs", g:"System" },{ id:"team", label:"Team", g:"System" },{ id:"api", label:"Providers", g:"System" },{ id:"maintenance", label:"Maintenance", g:"System" },{ id:"settings", label:"Settings", g:"System" },
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
  const parseActions = (str) => { try { return str ? JSON.parse(str) : []; } catch { return []; } };
  const [admins, setAdmins] = useState([]);
  const [actions30, setActions30] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [permTab, setPermTab] = useState("pages");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [resetPw, setResetPw] = useState("");
  const [localPages, setLocalPages] = useState(null);
  const [localActions, setLocalActions] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = () => fetch("/api/admin/team").then(r => r.json()).then(d => { setAdmins(d.admins || []); setActions30(d.actions30 || {}); });
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
    if (ok) { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPw(""); toast.success("Added", `${newName} can sign in now`); }
  };
  const fullAccess = (a) => a.role === "owner" || a.role === "superadmin";
  const effectivePages = (a) => fullAccess(a) ? ALL_PAGES.map(p => p.id) : (a.customPages || DEFAULT_PAGES[a.role] || []);
  const canManage = currentAdmin?.role === "owner" || currentAdmin?.role === "superadmin";
  const open = admins.find(a => a.id === openId) || null;
  const closeDrawer = () => { setOpenId(null); setLocalPages(null); setLocalActions(null); setResetPw(""); setPermTab("pages"); };
  const openDrawer = (a) => { setOpenId(a.id); setLocalPages(null); setLocalActions(null); setResetPw(""); setPermTab("pages"); };
  useEffect(() => {
    if (!open && !showAdd) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { closeDrawer(); setShowAdd(false); } };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, showAdd]);
  const dirty = localPages !== null || localActions !== null;
  const saveDrawer = async () => {
    if (!open) return;
    let ok = true;
    if (localPages !== null) ok = await act({ action: "updatePermissions", adminId: open.id, pages: localPages }) && ok;
    if (localActions !== null) ok = await act({ action: "updateActions", adminId: open.id, actions: localActions }) && ok;
    if (ok) { toast.success("Saved", `${open.name}'s access updated`); setLocalPages(null); setLocalActions(null); }
  };

  const initialsOf = (n) => (n || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const when = (iso) => { if (!iso) return "never"; const d = new Date(iso); const diff = Date.now() - d.getTime(); if (diff < 3600e3) return `${Math.max(1, Math.round(diff / 60e3))} min ago`; if (diff < 86400e3) return `today ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; if (diff < 7 * 86400e3) return `${Math.round(diff / 86400e3)} days ago`; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  const reachOf = (a) => fullAccess(a) ? "Everything" : `${effectivePages(a).length} pages${a.customPages ? " · custom" : ""}`;
  const actsOf = (a) => actions30[a.name]?.total || 0;
  const activeToday = admins.filter(a => new Date(a.lastActive).toDateString() === new Date().toDateString()).length;
  const quiet = admins.filter(a => Date.now() - new Date(a.lastActive).getTime() > 30 * 864e5);
  const busiest = [...admins].sort((a, b) => actsOf(b) - actsOf(a)).slice(0, 2);
  const ROLE_LINE = { owner: "Everything. Only one, cannot be changed.", superadmin: "Everything, including the team and settings.", admin: "Most pages. Pages and abilities can be trimmed or added.", support: "Orders and users. Approving money is a grant.", finance: "Payments and the books. Nothing else.", staff: "Overview, orders, refills, users and outreach." };
  const roleColor = (r) => (ROLE_INFO[r] || { color: "#6ee7b7" }).color;
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--in": dark ? "#131728" : "#fff",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  const pagesShown = open ? (localPages !== null ? localPages : (open.customPages || DEFAULT_PAGES[open.role] || [])) : [];
  const actionsShown = open ? (localActions !== null ? localActions : parseActions(open.customActions)) : [];
  const togglePage = (id) => setLocalPages(prev => { const cur = prev !== null ? prev : (open.customPages || DEFAULT_PAGES[open.role] || []); return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; });
  const toggleAction = (id) => setLocalActions(prev => { const cur = prev !== null ? prev : parseActions(open.customActions); return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; });
  const editable = open && canManage && open.role !== "owner";
  return (
    <div className="tm" style={vars}>
      <style>{TM_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Team</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Who can sign in to the panel, and what each person can touch.</div>
          </div>
          {canManage && <button type="button" className="tm-b pri" onClick={() => setShowAdd(true)}>Add a person</button>}
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelList dark={dark} rows={4} title rowH={62} /><SkelList dark={dark} rows={5} title avatar={false} rowH={40} /></> : <>
        <div className="tm-stats">
          <div className="tm-stt"><b className="m">{admins.length}</b><span>People</span><i>{activeToday} active today</i></div>
          {busiest.map(a => <div key={a.id} className="tm-stt"><b className="m">{actsOf(a).toLocaleString()}</b><span>{a.name}, 30 days</span><i>{actions30[a.name]?.telegram ? `${actions30[a.name].telegram} from Telegram` : "on the panel"}</i></div>)}
          <div className={"tm-stt" + (quiet.length ? " warn" : "")}><b className="m">{quiet.length}</b><span>Quiet {quiet.length === 1 ? "account" : "accounts"}</span><i>{quiet.length ? `${quiet[0].name}, last seen ${when(quiet[0].lastActive)}` : "everyone has been in this month"}</i></div>
        </div>

        <section className="tm-card">
          <header><h3>People</h3><span className="tm-cnt">{canManage ? "tap a person to change what they can do" : "tap a person to see what they can do"}</span></header>
          <div className="tm-list">
            {admins.map(a => (
              <div key={a.id} className={"tm-r" + (openId === a.id ? " on" : "") + (a.status === "suspended" ? " off" : "")} role="button" tabIndex={0} onClick={() => openDrawer(a)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(a); } }}>
                <span className="tm-n"><span className="tm-av" style={{ background: roleColor(a.role) }}>{initialsOf(a.name)}</span><span className="tm-nt"><b>{a.name}{a.status === "suspended" && <em> · suspended</em>}</b><i>{actsOf(a) ? `${actsOf(a).toLocaleString()} action${actsOf(a) === 1 ? "" : "s"}, 30 days` : "no actions, 30 days"}</i></span></span>
                <span className="tm-role" style={{ color: roleColor(a.role), borderColor: `${roleColor(a.role)}55` }}>{a.role}</span>
                <span className="tm-c tm-reach">{reachOf(a)}</span>
                <span className="tm-c tm-seen">{when(a.lastActive)}</span>
                <span className="tm-ch">›</span>
              </div>
            ))}
          </div>
        </section>

        <section className="tm-card">
          <header><h3>Roles</h3><span className="tm-cnt">what each role can do out of the box</span></header>
          <div className="tm-roles">
            {Object.keys(ROLE_LINE).map(r => <div key={r} className="tm-rr"><span className="tm-role" style={{ color: roleColor(r), borderColor: `${roleColor(r)}55` }}>{r}</span><i>{ROLE_LINE[r]}</i></div>)}
          </div>
        </section>
      </>}

      {open && (
        <div className="tm-bd" onClick={closeDrawer}>
          <aside className="tm-dw" role="dialog" aria-modal="true" aria-label={`${open.name}'s access`} onClick={e => e.stopPropagation()}>
            <div className="tm-dh">
              <span className="tm-av" style={{ background: roleColor(open.role) }}>{initialsOf(open.name)}</span>
              <div className="tm-dht"><b>{open.name}</b><i>{open.role} · since {new Date(open.joined || open.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · last seen {when(open.lastActive)}</i></div>
              <button type="button" className="tm-b sm" onClick={closeDrawer}>Close</button>
            </div>
            {editable && (
              <div className="tm-drow">
                <label className="tm-lbl">Role</label>
                <select className="tm-sel" value={open.role} onChange={async e => { const r = e.target.value; const ok = await act({ action: "updateRole", adminId: open.id, role: r }); if (ok) toast.success("Role changed", `${open.name} is now ${r}`); }}>
                  {[...new Set([open.role, ...ASSIGNABLE_ROLES])].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" className="tm-b sm" onClick={async () => { const ok = await act({ action: "toggleStatus", adminId: open.id }); if (ok) toast.success(open.status === "suspended" ? "Reinstated" : "Suspended", open.name); }}>{open.status === "suspended" ? "Reinstate" : "Suspend"}</button>
              </div>
            )}
            <div className="tm-tabs"><SegPill value={permTab} options={[{ value: "pages", label: "Pages" }, { value: "abilities", label: "Abilities" }, ...(editable ? [{ value: "password", label: "Password" }] : [])]} onChange={setPermTab} dark={dark} t={t} /></div>
            <div className="tm-body">
              {permTab === "pages" && (fullAccess(open) ? (
                <div className="tm-sub">{open.role === "owner" ? "The owner" : "A superadmin"} can open every page. Nothing to tick.</div>
              ) : <>
                <div className="tm-sub">{editable ? `Tick the pages ${open.name} can open.` : `The pages ${open.name} can open.`}{!open.customPages && ` ${open.role.charAt(0).toUpperCase() + open.role.slice(1)} starts with ${(DEFAULT_PAGES[open.role] || []).length}.`}</div>
                {PAGE_GROUPS.map(g => (
                  <div key={g}><h4 className="tm-g">{g}</h4><div className="tm-grid">
                    {ALL_PAGES.filter(p => p.g === g).map(p => <button key={p.id} type="button" className={"tm-ck" + (pagesShown.includes(p.id) ? " on" : "")} disabled={!editable} onClick={() => togglePage(p.id)}>{p.label}</button>)}
                  </div></div>
                ))}
              </>)}
              {permTab === "abilities" && (fullAccess(open) ? (
                <div className="tm-sub">{open.role === "owner" ? "The owner" : "A superadmin"} can do everything. Nothing to grant.</div>
              ) : <>
                <div className="tm-sub">Abilities beyond the pages: money, dispatch, and edits that cannot be undone.</div>
                {ACTION_GROUPS.map(g => (
                  <div key={g}><h4 className="tm-g">{g}</h4><div className="tm-grid">
                    {GRANTABLE_ACTIONS.filter(a => a.g === g).map(a => <button key={a.id} type="button" className={"tm-ck" + (actionsShown.includes(a.id) ? " on" : "")} disabled={!editable} onClick={() => toggleAction(a.id)}>{a.label}</button>)}
                  </div></div>
                ))}
              </>)}
              {permTab === "password" && editable && (
                <div>
                  <div className="tm-sub">Set a new password for {open.name}. Tell them in person, not in a message.</div>
                  <input type="password" className="tm-in" placeholder="At least 6 characters" value={resetPw} onChange={e => setResetPw(e.target.value)} />
                  <button type="button" className="tm-b" style={{ marginTop: 10 }} disabled={resetPw.length < 6 || saving} onClick={async () => { const ok = await act({ action: "resetPassword", adminId: open.id, newPassword: resetPw }); if (ok) { toast.success("Password set", open.name); setResetPw(""); } }}>Set password</button>
                </div>
              )}
            </div>
            {editable && (
              <div className="tm-df">
                <button type="button" className="tm-b sm" style={{ color: "var(--bad)" }} onClick={async () => { const ok = await confirm({ title: `Remove ${open.name}?`, message: "They will not be able to sign in. Their past actions stay in the logs.", confirmText: "Remove", danger: true }); if (!ok) return; const r = await act({ action: "delete", adminId: open.id }); if (r) { toast.success("Removed", open.name); closeDrawer(); } }}>Remove from team</button>
                <span className="tm-dfr">
                  {!fullAccess(open) && open.customPages && <button type="button" className="tm-b sm" onClick={async () => { const ok = await act({ action: "updatePermissions", adminId: open.id, pages: null }); if (ok) { toast.success("Back to default", `${open.role} pages`); setLocalPages(null); } }}>Back to role default</button>}
                  {!fullAccess(open) && <button type="button" className="tm-b sm pri" disabled={!dirty || saving} onClick={saveDrawer}>{saving ? "Saving…" : "Save"}</button>}
                </span>
              </div>
            )}
          </aside>
        </div>
      )}

      {showAdd && (
        <div className="tm-bd center" onClick={() => setShowAdd(false)}>
          <div className="tm-md" role="dialog" aria-modal="true" aria-label="Add a person" onClick={e => e.stopPropagation()}>
            <div className="tm-mdh"><b>Add a person</b><button type="button" className="tm-b sm" onClick={() => setShowAdd(false)}>Close</button></div>
            <label className="tm-lbl">Name</label><input className="tm-in" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Their name" />
            <label className="tm-lbl">Email</label><input className="tm-in" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@nitro.ng" />
            <label className="tm-lbl">Password</label><input className="tm-in" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters" />
            <label className="tm-lbl">Role</label><select className="tm-sel" value={newRole} onChange={e => setNewRole(e.target.value)}>{ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
            <div className="tm-sub" style={{ marginTop: 6 }}>{ROLE_LINE[newRole]}</div>
            <div className="tm-mdf"><button type="button" className="tm-b" onClick={() => setShowAdd(false)}>Cancel</button><button type="button" className="tm-b pri" disabled={saving || !newName.trim() || !newEmail.trim() || newPw.length < 6} onClick={createAdmin}>{saving ? "Adding…" : "Add"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const TM_CSS = `
.tm{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.tm *{box-sizing:border-box}
.tm .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.tm-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.tm-b:hover{transform:translateY(-1px)}.tm-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.tm-b.sm{height:30px;padding:0 10px;font-size:12px}.tm-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.tm-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.tm-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.tm-stt:first-child{border-left:0}
.tm-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}.tm-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-stt.warn b{color:var(--warn)}
.tm-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.tm-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.tm-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.tm-cnt{font-size:11.5px;color:var(--dim)}
.tm-list{display:flex;flex-direction:column}
.tm-r{display:grid;grid-template-columns:1fr 110px 140px 110px 20px;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--rail);cursor:pointer;outline:none;text-align:left}.tm-r:first-child{border-top:0}.tm-r.on,.tm-r:hover{background:var(--soft)}.tm-r.off .tm-nt{opacity:.55}
.tm-n{display:flex;align-items:center;gap:10px;min-width:0}.tm-av{width:34px;height:34px;border-radius:50%;color:#1c1b19;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
.tm-nt{display:flex;flex-direction:column;min-width:0}.tm-nt b{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-nt b em{font-style:normal;font-weight:500;color:var(--bad)}.tm-nt i{font-style:normal;font-size:11.5px;color:var(--dim)}
.tm-role{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;text-align:center;white-space:nowrap}
.tm-c{font-size:12.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-ch{color:var(--dim);font-size:18px;text-align:right}
.tm-roles{padding:4px 16px 8px}.tm-rr{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--rail)}.tm-rr:first-child{border-top:0}.tm-rr i{font-style:normal;font-size:13px;color:var(--mut)}
.tm-bd{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4)}.tm-bd.center{display:flex;align-items:center;justify-content:center;padding:16px}
.tm-dw{position:absolute;top:0;right:0;bottom:0;width:460px;max-width:100%;background:var(--card);border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-12px 0 30px rgba(0,0,0,.2)}
.tm-dh{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}.tm-dht{flex:1;display:flex;flex-direction:column;min-width:0}.tm-dht b{font-size:16px;font-weight:700}.tm-dht i{font-style:normal;font-size:12px;color:var(--mut)}
.tm-drow{display:flex;align-items:center;gap:8px;padding:12px 18px 0}.tm-drow .tm-lbl{margin:0}.tm-drow .tm-sel{flex:1}
.tm-tabs{padding:14px 18px 0}.tm-sub{font-size:12.5px;color:var(--mut);line-height:1.5;margin:0 0 6px}
.tm-body{flex:1;overflow:auto;padding:12px 18px 14px}.tm-g{margin:12px 0 6px;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ac);font-weight:700}.tm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.tm-ck{font:inherit;font-size:12.5px;padding:8px 10px;border-radius:9px;border:1px solid var(--line);color:var(--mut);background:none;display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left}.tm-ck::before{content:"";width:14px;height:14px;border-radius:4px;border:1.5px solid var(--line);flex-shrink:0}.tm-ck.on{color:var(--ink);border-color:var(--ac)}.tm-ck.on::before{background:var(--ac);border-color:var(--ac)}.tm-ck:disabled{cursor:default}
.tm-df{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--line);background:var(--soft)}.tm-dfr{display:flex;gap:8px}
.tm-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:12px 0 6px}
.tm-in,.tm-sel{width:100%;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none}.tm-in:focus,.tm-sel:focus{border-color:var(--ac)}
.tm-md{width:440px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25)}.tm-mdh{display:flex;justify-content:space-between;align-items:center}.tm-mdh b{font-size:16px;font-weight:700}.tm-mdf{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
@media (max-width:900px){
  .tm-stats{grid-template-columns:1fr 1fr}.tm-stt:nth-child(3){border-left:0}.tm-stt:nth-child(n+3){border-top:1px solid var(--line)}.tm-stt b{font-size:17px}
  .tm-r{grid-template-columns:1fr auto 20px;grid-template-areas:"n role ch" "reach seen ch";gap:4px 10px;padding:12px}.tm-n{grid-area:n}.tm-r .tm-role{grid-area:role}.tm-reach{grid-area:reach;padding-left:44px}.tm-seen{grid-area:seen;justify-self:end}.tm-ch{grid-area:ch}
  .tm-rr{grid-template-columns:1fr;gap:4px}.tm-rr .tm-role{justify-self:start}
  .tm-dw{width:100%;top:8vh;border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0}
}
`;

/* ═══ COUPONS                             ═══ */
/* ═══════════════════════════════════════════ */
export function AdminCouponsPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxDeposit: "", maxUses: "", expires: "", newUsersOnly: false });
  const [search, setSearch] = useState("");
  const [refEnabled, setRefEnabled] = useState(true);
  const [refReferrer, setRefReferrer] = useState("500");
  const [refInvitee, setRefInvitee] = useState("500");
  const [refMinDeposit, setRefMinDeposit] = useState("0");
  const [refSaving, setRefSaving] = useState(false);
  const [rewardsTab, setRewardsTab] = useState("coupons");
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
  useEffect(() => {
    if (rewardsTab !== "ledger") return;
    if (ledgerTimer.current) clearTimeout(ledgerTimer.current);
    ledgerTimer.current = setTimeout(() => fetchLedger(1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo), ledgerSearch ? 350 : 0);
    return () => clearTimeout(ledgerTimer.current);
  }, [rewardsTab, ledgerSearch, ledgerType, ledgerFrom, ledgerTo, fetchLedger]);
  // Nitro Status tiers — read-only reference, canonical source is lib/nitro-rewards.js
  const NITRO_STATUS_TIERS = [
    { name: 'Spark',  min: 0,        discountPct: 0,   pointEarnPct: 0.5, color: '#6B7280' },
    { name: 'Pulse',  min: 100000,   discountPct: 0.5, pointEarnPct: 1,   color: '#F59E0B' },
    { name: 'Boost',  min: 500000,   discountPct: 1,   pointEarnPct: 1.25, color: '#3B82F6' },
    { name: 'Surge',  min: 2000000,  discountPct: 2,   pointEarnPct: 1.5, color: '#8B5CF6' },
    { name: 'Apex',   min: 7500000,  discountPct: 3,   pointEarnPct: 1.75, color: '#EC4899' },
    { name: 'Legend', min: 15000000, discountPct: 4,   pointEarnPct: 2,   color: '#EF4444' },
  ];
  const loadCoupons = () => fetch("/api/admin/coupons").then(r => r.json()).then(d => { setCoupons(d.coupons || []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => {
    loadCoupons();
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
    setRefSaving(true);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: {
        ref_enabled: String(refEnabled),
        ref_referrer_bonus: String(Number(refReferrer || 0) * 100),
        ref_invitee_bonus: String(Number(refInvitee || 0) * 100),
        ref_min_deposit: String(Number(refMinDeposit || 0) * 100),
      }}) });
      if (r.ok) toast.success("Saved", "Referral settings updated"); else toast.error("Failed", "Could not save");
    } catch { toast.error("Request failed", "Check your connection"); }
    setRefSaving(false);
  };
  const createCoupon = async () => {
    if (!form.code.trim() || !form.value) return;
    try {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...form, value: Number(form.value), minOrder: Number(form.minOrder) || 0, maxDeposit: Number(form.maxDeposit) || 0, maxUses: Number(form.maxUses) || 0 }) });
      if (res.ok) { setShowAdd(false); setForm({ code: "", type: "percent", value: "", minOrder: "", maxDeposit: "", maxUses: "", expires: "", newUsersOnly: false }); loadCoupons(); toast.success("Coupon made", form.code); }
      else { const d = await res.json().catch(() => ({})); toast.error("Could not make it", d.error || "Check the fields"); }
    } catch { toast.error("Request failed", "Check your connection"); }
  };
  const toggleCoupon = async (c) => {
    try {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id: c.id }) });
      if (res.ok) { loadCoupons(); toast.success(c.enabled ? "Turned off" : "Turned on", c.code); } else toast.error("Failed", "Could not change it");
    } catch { toast.error("Request failed", "Check your connection"); }
  };
  const deleteCoupon = async (c) => {
    const ok = await confirm({ title: `Delete ${c.code}?`, message: "People can no longer use it. This cannot be undone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: c.id }) });
      setCoupons(prev => prev.filter(x => x.id !== c.id)); toast.success("Deleted", c.code);
    } catch { toast.error("Request failed", "Check your connection"); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiryOf = (c) => c.expires ? new Date(c.expires + "T23:59:59") : null;
  const stateOf = (c) => { const exp = expiryOf(c); if (!c.enabled) return ["Off", "dim"]; if (exp && exp < new Date()) return ["Expired", "dim"]; if (c.maxUses && (c.used || 0) >= c.maxUses) return ["Used up", "dim"]; return ["Live", "ok"]; };
  const whenOf = (c) => { const [st] = stateOf(c); const exp = expiryOf(c); const d = exp ? exp.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null; if (st === "Expired") return `expired ${d}`; if (st === "Used up") return "used up"; if (st === "Off") return d ? `off · ends ${d}` : "off"; return d ? `ends ${d}` : "no end date"; };
  const givesOf = (c) => `${c.type === "percent" ? `${c.value}%` : fN(c.value || 0)} bonus on deposit${c.minOrder ? ` · min ${fN(c.minOrder)}` : ""}${c.maxDeposit ? ` · up to ${fN(c.maxDeposit)}` : ""}${c.newUsersOnly ? " · new customers only" : ""}`;
  const live = coupons.filter(c => stateOf(c)[0] === "Live");
  const endingSoon = live.filter(c => { const e = expiryOf(c); return e && e - today < 7 * 864e5; });
  const usedTotal = coupons.reduce((n, c) => n + (c.used || 0), 0);
  const shown = coupons.filter(c => !search || c.code.toLowerCase().includes(search.toLowerCase()));
  const typeWord = (ty) => ({ earned_order: "Earned", redeemed_order: "Redeemed", reversed_refund: "Reversed", restored_refund: "Restored", manual_credit: "Manual credit", manual_debit: "Manual debit", opening_balance: "Opening balance" })[ty] || ty.replace(/_/g, " ");
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)", "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--in": dark ? "#131728" : "#fff",
  };
  return (
    <div className="rw" style={vars}>
      <style>{RW_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Rewards</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Coupons, the referral bonus and Nitro points.</div>
          </div>
          <SegPill value={rewardsTab} options={[{ value: "coupons", label: "Coupons" }, { value: "referrals", label: "Referral" }, { value: "ledger", label: "Points" }]} onChange={setRewardsTab} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {rewardsTab === "coupons" && (loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} pills={1} right /><SkelList dark={dark} rows={4} title avatar={false} rowH={58} /></> : <>
        <div className="rw-stats">
          <div className="rw-stt"><b className="m">{live.length}</b><span>Live {live.length === 1 ? "coupon" : "coupons"}</span><i>{live.length ? live.map(c => c.code).slice(0, 2).join(", ") + (live.length > 2 ? "…" : "") : "none running"}</i></div>
          <div className="rw-stt"><b className="m">{usedTotal}</b><span>Times used</span><i>across {coupons.length} {coupons.length === 1 ? "coupon" : "coupons"}</i></div>
          <div className={"rw-stt" + (endingSoon.length ? " warn" : "")}><b className="m">{endingSoon.length}</b><span>Ending this week</span><i>{endingSoon.length ? endingSoon.map(c => c.code).join(", ") : "nothing ends soon"}</i></div>
          <div className="rw-stt"><b className="m">{fN(Number(refReferrer || 0))}</b><span>Referral bonus</span><i>{refEnabled ? `each side · after ${Number(refMinDeposit) > 0 ? fN(Number(refMinDeposit)) + " deposit" : "email check"}` : "referrals are off"}</i></div>
        </div>
        <div className="rw-bar">
          <div className="rw-srch"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search codes" /></div>
          <span className="rw-cnt">{shown.length} {shown.length === 1 ? "coupon" : "coupons"}</span>
          <button type="button" className={"rw-b" + (showAdd ? "" : " pri")} onClick={() => setShowAdd(v => !v)}>{showAdd ? "Cancel" : "+ New coupon"}</button>
        </div>
        {showAdd && (
          <section className="rw-card">
            <header><h3>New coupon</h3><span className="rw-cnt">a bonus on top of a deposit</span></header>
            <div className="rw-form">
              <label>Code<input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} placeholder="WELCOME20" /></label>
              <label>Bonus<span className="rw-two"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="percent">% of the deposit</option><option value="fixed">₦ fixed</option></select><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === "percent" ? "10" : "500"} /></span></label>
              <label>Minimum deposit (₦)<input type="number" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} placeholder="0" /></label>
              <label>Largest deposit it applies to (₦)<input type="number" value={form.maxDeposit} onChange={e => setForm({ ...form, maxDeposit: e.target.value })} placeholder="no cap" /></label>
              <label>How many uses<input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="no limit" /></label>
              <label>Ends on<input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} /></label>
              <label className="rw-chk"><input type="checkbox" checked={form.newUsersOnly} onChange={e => setForm({ ...form, newUsersOnly: e.target.checked })} /> New customers only</label>
              <div className="rw-ff"><button type="button" className="rw-b pri" disabled={!form.code.trim() || !form.value} onClick={createCoupon}>Make coupon</button></div>
            </div>
          </section>
        )}
        <section className="rw-card">
          <header><h3>Coupons</h3><span className="rw-cnt">code · what it gives · uses · state</span></header>
          <div className="rw-list">
            {shown.length === 0 ? <div className="rw-empty">{coupons.length ? "No code matches." : "No coupons yet. Make one to give a bonus on deposits."}</div> : shown.map(c => { const [st, cls] = stateOf(c); return (
              <div key={c.id || c.code} className="rw-cr">
                <button type="button" className="rw-code m" title="Copy the code" onClick={() => { copyText(c.code); toast.success("Copied", c.code); }}>{c.code}</button>
                <span className="rw-tt"><b>{givesOf(c)}</b><i>{whenOf(c)}</i></span>
                <span className="rw-mid m">{c.used || 0} of {c.maxUses || "∞"}</span>
                <span className="rw-st"><i className={"rw-dot " + cls} />{st}</span>
                <span className="rw-acts"><button type="button" className="rw-b sm" onClick={() => toggleCoupon(c)}>{c.enabled ? "Turn off" : "Turn on"}</button><button type="button" className="rw-b sm bad" onClick={() => deleteCoupon(c)}>Delete</button></span>
              </div>
            ); })}
          </div>
        </section>
      </>)}

      {rewardsTab === "referrals" && (
        <section className="rw-card">
          <header><h3>Referral bonus</h3><span className="rw-cnt">both sides get wallet credit once the new person qualifies</span></header>
          <div className="rw-set">
            <div className="rw-sr"><span className="rw-tt"><b>Referrals</b><i>Switch the whole programme on or off</i></span><button type="button" role="switch" aria-checked={refEnabled} className={"rw-tog" + (refEnabled ? "" : " o")} onClick={() => setRefEnabled(v => !v)}><i /></button></div>
            <div className="rw-sr"><span className="rw-tt"><b>The person who shared</b><i>Credited when their friend qualifies</i></span><span className="rw-money">₦<input value={refReferrer} onChange={e => setRefReferrer(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></span></div>
            <div className="rw-sr"><span className="rw-tt"><b>The person who joined</b><i>Their welcome credit</i></span><span className="rw-money">₦<input value={refInvitee} onChange={e => setRefInvitee(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></span></div>
            <div className="rw-sr"><span className="rw-tt"><b>Deposit needed first</b><i>0 means the credit lands as soon as the email is verified</i></span><span className="rw-money">₦<input value={refMinDeposit} onChange={e => setRefMinDeposit(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></span></div>
            <div className="rw-ff"><button type="button" className="rw-b pri" disabled={refSaving} onClick={saveReferral}>{refSaving ? "Saving…" : "Save"}</button></div>
          </div>
        </section>
      )}

      {rewardsTab === "ledger" && <>
        <div className="rw-bar">
          <div className="rw-srch"><input value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} placeholder="Search by name, email or order" /></div>
          <FilterDropdown dark={dark} t={t} value={ledgerType} onChange={setLedgerType} options={[{ value: "", label: "All kinds" }, { value: "earned_order", label: "Earned" }, { value: "redeemed_order", label: "Redeemed" }, { value: "reversed_refund", label: "Reversed" }, { value: "restored_refund", label: "Restored" }, { value: "manual_credit", label: "Manual credit" }, { value: "manual_debit", label: "Manual debit" }, { value: "opening_balance", label: "Opening balance" }]} />
          <input type="date" className="rw-date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} aria-label="From" />
          <input type="date" className="rw-date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} aria-label="To" />
          <span className="rw-cnt">{ledgerTotal ? `${ledgerTotal.toLocaleString()} entries` : ""}</span>
        </div>
        <section className="rw-card">
          <header><h3>Points</h3><span className="rw-cnt">every point earned, spent or put back</span></header>
          <div className="rw-list">
            {ledgerLoading && ledger.length === 0 ? <div style={{ padding: 12 }}><SkelList dark={dark} rows={6} bare rowH={48} /></div> : ledger.length === 0 ? <div className="rw-empty">{ledgerSearch || ledgerType || ledgerFrom || ledgerTo ? "Nothing matches." : "No points moved yet."}</div> : (
              <div style={{ opacity: ledgerLoading ? .55 : 1, transition: "opacity .2s" }}>
                <div className="rw-lh"><span>When</span><span>Who</span><span>Kind</span><span className="r">Points</span><span>Order</span><span>Why</span></div>
                {ledger.map(e => (
                  <div key={e.id} className="rw-lr">
                    <span className="rw-mid">{fD(e.createdAt, true)}</span>
                    <span className="rw-who">{e.userName || e.userEmail || (e.userId || "").slice(0, 8)}</span>
                    <span className="rw-ty">{typeWord(e.type)}</span>
                    <b className={"m rw-pts " + (e.points >= 0 ? "ok" : "bad")}>{e.points >= 0 ? "+" : ""}{fPts(e.points)}</b>
                    <span className="rw-mid m">{e.orderRef ? `#${e.orderRef}` : "—"}</span>
                    <span className="rw-why">{e.adminName ? `${e.adminName}: ` : ""}{e.reason || "—"}</span>
                  </div>
                ))}
              </div>
            )}
            {ledgerTotalPages > 1 && <div className="rw-pg"><span className="rw-cnt">{ledgerPage} of {ledgerTotalPages}</span><span className="rw-pgn"><button type="button" className="rw-ib" disabled={ledgerPage <= 1} onClick={() => fetchLedger(ledgerPage - 1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo)} aria-label="Previous">‹</button><button type="button" className="rw-ib" disabled={ledgerPage >= ledgerTotalPages} onClick={() => fetchLedger(ledgerPage + 1, ledgerSearch, ledgerType, ledgerFrom, ledgerTo)} aria-label="Next">›</button></span></div>}
          </div>
        </section>
        <section className="rw-card">
          <header><h3>Status tiers</h3><span className="rw-cnt">what customers get as they spend · set in code</span></header>
          <div className="rw-list">
            <div className="rw-lh tiers"><span>Tier</span><span className="r">From</span><span className="r">Discount</span><span className="r">Points earned</span></div>
            {NITRO_STATUS_TIERS.map(tier => <div key={tier.name} className="rw-lr tiers"><span className="rw-who"><i className="rw-dot" style={{ background: tier.color }} />{tier.name}</span><span className="m r">{tier.min === 0 ? "—" : fN(tier.min)}</span><span className="m r">{tier.discountPct > 0 ? `${tier.discountPct}%` : "—"}</span><span className="m r">{tier.pointEarnPct}%</span></div>)}
          </div>
        </section>
      </>}
    </div>
  );
}

const RW_CSS = `
.rw{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.rw *{box-sizing:border-box}
.rw .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}.rw .r{text-align:right}
.rw-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.rw-b:hover{transform:translateY(-1px)}.rw-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.rw-b.sm{height:30px;padding:0 10px;font-size:12px}.rw-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.rw-b.bad{color:var(--bad)}
.rw-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.rw-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.rw-stt:first-child{border-left:0}
.rw-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rw-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.rw-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rw-stt.warn b{color:var(--warn)}
.rw-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rw-srch{display:flex;align-items:center;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);min-width:280px}.rw-srch:focus-within{border-color:var(--acln)}.rw-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.rw-srch input::placeholder{color:var(--dim)}
.rw-date{height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13px;outline:none}
.rw-cnt{font-size:12px;color:var(--dim);margin-left:auto}
.rw-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.rw-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.rw-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.rw-card>header .rw-cnt{margin:0}
.rw-list{display:flex;flex-direction:column}.rw-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.rw-cr{display:grid;grid-template-columns:130px 1fr 70px 100px auto;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.rw-cr:first-child{border-top:0}
.rw-code{font:inherit;font-weight:800;letter-spacing:.5px;font-size:13px;color:var(--ink);background:none;border:0;padding:0;text-align:left;cursor:copy}.rw-code:hover{color:var(--ac)}
.rw-tt{display:flex;flex-direction:column;min-width:0}.rw-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rw-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-mid{font-size:12px;color:var(--mut);white-space:nowrap}.rw-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.rw-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;background:var(--dim)}.rw-dot.ok{background:var(--ok)}.rw-acts{display:flex;gap:6px;justify-content:flex-end}
.rw-form{padding:14px 16px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.rw-form label{display:flex;flex-direction:column;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}.rw-form input,.rw-form select{height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none;width:100%}.rw-form input:focus,.rw-form select:focus{border-color:var(--ac)}.rw-two{display:grid;grid-template-columns:1fr 100px;gap:8px}
.rw-chk{flex-direction:row !important;align-items:center;text-transform:none !important;letter-spacing:0 !important;font-size:13px !important;font-weight:500 !important;color:var(--ink) !important}.rw-chk input{width:16px !important;height:16px !important;accent-color:var(--ac)}
.rw-ff{grid-column:1 / -1;display:flex;justify-content:flex-end;padding-top:4px}
.rw-set{padding:4px 16px 16px}.rw-sr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--rail)}.rw-sr:first-child{border-top:0}.rw-sr .rw-tt b{white-space:normal}.rw-sr .rw-tt i{white-space:normal}
.rw-money{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--mut);font-weight:600}.rw-money input{width:96px;height:36px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-family:'JetBrains Mono',monospace;font-size:14px;text-align:right;outline:none}.rw-money input:focus{border-color:var(--ac)}
.rw-tog{width:38px;height:22px;border-radius:11px;background:var(--ac);position:relative;border:0;padding:0;cursor:pointer;flex-shrink:0}.rw-tog i{position:absolute;top:2px;left:18px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}.rw-tog.o{background:var(--line)}.rw-tog.o i{left:2px}
.rw-lh{display:grid;grid-template-columns:110px 170px 120px 90px 90px 1fr;gap:12px;padding:0 16px;height:34px;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line)}
.rw-lr{display:grid;grid-template-columns:110px 170px 120px 90px 90px 1fr;gap:12px;padding:10px 16px;align-items:center;border-top:1px solid var(--rail);font-size:13px}.rw-lr:first-child{border-top:0}
.rw-lh.tiers,.rw-lr.tiers{grid-template-columns:1fr 140px 110px 130px}
.rw-who{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-flex;align-items:center;gap:8px}.rw-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;text-align:center;white-space:nowrap;justify-self:start}
.rw-pts{text-align:right;font-weight:700}.rw-pts.ok{color:var(--ok)}.rw-pts.bad{color:var(--bad)}.rw-why{font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.rw-pg .rw-cnt{margin:0}.rw-pgn{display:inline-flex;gap:6px}.rw-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:14px;cursor:pointer;padding:0}.rw-ib:disabled{opacity:.35;cursor:not-allowed}
@media (max-width:900px){
  .rw-stats{grid-template-columns:1fr 1fr}.rw-stt:nth-child(3){border-left:0}.rw-stt:nth-child(n+3){border-top:1px solid var(--line)}.rw-stt b{font-size:17px}
  .rw-srch{width:100%;min-width:0}.rw-bar .rw-cnt{display:none}.rw-bar .rw-b{width:100%}.rw-date{flex:1}
  .rw-cr{grid-template-columns:1fr auto;grid-template-areas:"code st" "tt tt" "mid mid" "acts acts";gap:6px 10px;padding:12px 14px}.rw-cr .rw-code{grid-area:code}.rw-cr .rw-st{grid-area:st}.rw-cr .rw-tt{grid-area:tt}.rw-cr .rw-tt b,.rw-cr .rw-tt i{white-space:normal}.rw-cr .rw-mid{grid-area:mid}.rw-cr .rw-acts{grid-area:acts;justify-content:stretch}.rw-cr .rw-acts .rw-b{flex:1}
  .rw-form{grid-template-columns:1fr}
  .rw-lh{display:none}.rw-lr{grid-template-columns:1fr auto;grid-template-areas:"who pts" "ty when" "why why";gap:4px 10px}.rw-lr .rw-who{grid-area:who}.rw-lr .rw-pts{grid-area:pts}.rw-lr .rw-ty{grid-area:ty}.rw-lr .rw-mid:first-child{grid-area:when;justify-self:end}.rw-lr .rw-mid.m{display:none}.rw-lr .rw-why{grid-area:why;white-space:normal}
  .rw-lr.tiers{grid-template-columns:1fr auto auto auto;grid-template-areas:none}
}
`;
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
  const load = () => fetch("/api/admin/notifications").then(r => r.json()).then(d => { setHistory(d.history || []); setPromoCount(d.promoCount || 0); setTotalCount(d.totalCount || 0); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => {
    load();
    return () => { if (blastPollRef.current) clearInterval(blastPollRef.current); if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current); };
  }, []);
  const send = async () => {
    if (!message.trim() || sending) return;
    const ok = await confirm({ title: "Send this email?", message: `It goes to ${target === "all" ? `everyone who allows promo email (${promoCount.toLocaleString()} people)` : target === "active" ? "customers active in the last 30 days" : "customers who joined this week"}. It cannot be recalled.`, confirmText: "Send" });
    if (!ok) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message, target }) });
      const data = await res.json();
      if (res.ok) {
        toast.success("Sending", data.message || "The email is going out");
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
  const clearHistory = async () => {
    const ok = await confirm({ title: "Clear the sent list?", message: "The emails themselves are not affected. This cannot be undone.", confirmText: "Clear", danger: true });
    if (!ok) return;
    const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearHistory: true }) });
    if (res.ok) { setHistory([]); toast.success("Cleared"); } else toast.error("Failed", "Could not clear");
  };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = history.filter(h => h.sentAt && new Date(h.sentAt) >= monthStart);
  const delivered30 = history.filter(h => h.sentAt && Date.now() - new Date(h.sentAt) < 30 * 864e5).reduce((n, h) => n + (h.sent || 0), 0);
  const last = history[0];
  const TARGET = { all: "Everyone", active: "Active, 30 days", new: "New this week" };
  const statusWord = (h) => h.status === "sending" ? ["Sending", "warn"] : h.status === "failed" ? ["Failed", "bad"] : ["Delivered", "ok"];
  const timeOf = (iso) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--in": dark ? "#131728" : "#fff",
  };
  return (
    <div className="eb" style={vars}>
      <style>{EB_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Email blasts</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>One email to many customers, from the panel.</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      {loading ? <><SkelFacts dark={dark} /><SkelList dark={dark} rows={1} title avatar={false} rowH={300} /><SkelList dark={dark} rows={3} title avatar={false} rowH={52} /></> : <>
        <div className="eb-stats">
          <div className="eb-stt"><b className="m">{promoCount.toLocaleString()}</b><span>Can receive</span><i>of {totalCount.toLocaleString()} verified · {(totalCount - promoCount).toLocaleString()} opted out</i></div>
          <div className="eb-stt"><b className="m">{thisMonth.length}</b><span>Sent this month</span><i>{thisMonth.length ? `${thisMonth.reduce((n, h) => n + (h.sent || 0), 0).toLocaleString()} delivered` : "nothing yet"}</i></div>
          <div className="eb-stt"><b className="m">{delivered30.toLocaleString()}</b><span>Delivered, 30 days</span><i>across {history.filter(h => h.sentAt && Date.now() - new Date(h.sentAt) < 30 * 864e5).length} emails</i></div>
          <div className="eb-stt"><b className="m">{last?.sentAt ? timeOf(last.sentAt) : "—"}</b><span>Last sent</span><i>{last ? (last.subject || "no subject") : "never"}</i></div>
        </div>
        <section className="eb-card">
          <header><h3>Write one</h3><span className="eb-cnt">goes only to people who allow promo email</span></header>
          <div className="eb-body">
            <label className="eb-lbl">Subject</label>
            <input className="eb-in" value={subject} onChange={e => setSubject(e.target.value)} placeholder="What the email is about" />
            <label className="eb-lbl">Message</label>
            <textarea className="eb-in eb-ta" value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Say it the way you would say it on WhatsApp" />
            <label className="eb-lbl">To</label>
            <div className="eb-chips">{Object.entries(TARGET).map(([v, l]) => <button key={v} type="button" className={"eb-tg" + (target === v ? " on" : "")} onClick={() => setTarget(v)}>{l}{v === "all" ? ` · ${promoCount.toLocaleString()}` : ""}</button>)}</div>
            <div className="eb-note">{(totalCount - promoCount).toLocaleString()} people have turned promo email off and will not get it. Sends go out over a few minutes.</div>
            <div className="eb-ff"><button type="button" className="eb-b pri" disabled={sending || !message.trim()} onClick={send}>{sending ? "Sending…" : target === "all" ? `Send to ${promoCount.toLocaleString()} people` : "Send"}</button></div>
          </div>
        </section>
        <section className="eb-card">
          <header><h3>Sent</h3><span className="eb-cnt">{history.length ? <>{history.length} {history.length === 1 ? "email" : "emails"} · <button type="button" className="eb-link" onClick={clearHistory}>clear</button></> : "nothing yet"}</span></header>
          <div className="eb-list">
            {history.length === 0 ? <div className="eb-empty">Nothing sent yet. The first one you send shows here with who it went to, how many arrived and who pressed Send.</div> : history.map((h, i) => { const [w, cls] = statusWord(h); return (
              <div key={i} className="eb-hr">
                <span className="eb-tt"><b>{h.subject || "(no subject)"}</b><i>{TARGET[h.target] || h.target} · by {h.sentBy || "—"}</i></span>
                <span className="eb-mid m">{h.recipients ? `${(h.sent || 0).toLocaleString()} of ${h.recipients.toLocaleString()}` : ""}</span>
                <span className="eb-st"><i className={"eb-dot " + cls} />{w}</span>
                <span className="eb-mid">{h.sentAt ? timeOf(h.sentAt) : ""}</span>
              </div>
            ); })}
          </div>
        </section>
      </>}
    </div>
  );
}

const EB_CSS = `
.eb{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.eb *{box-sizing:border-box}
.eb .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.eb-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.eb-b:hover{transform:translateY(-1px)}.eb-b:disabled{opacity:.5;cursor:not-allowed;transform:none}.eb-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.eb-link{font:inherit;font-size:inherit;font-weight:600;color:var(--ac);background:none;border:0;padding:0;cursor:pointer}
.eb-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.eb-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.eb-stt:first-child{border-left:0}
.eb-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eb-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.eb-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eb-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.eb-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.eb-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.eb-cnt{font-size:11.5px;color:var(--dim)}
.eb-body{padding:14px 16px 16px}.eb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:12px 0 6px}.eb-lbl:first-child{margin-top:0}
.eb-in{width:100%;height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none}.eb-in:focus{border-color:var(--ac)}.eb-ta{height:auto;padding:10px 12px;line-height:1.5;resize:vertical}
.eb-chips{display:flex;gap:6px;flex-wrap:wrap}.eb-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}.eb-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.eb-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--soft);font-size:12.5px;color:var(--mut)}.eb-ff{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.eb-list{display:flex;flex-direction:column}.eb-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut);line-height:1.5}
.eb-hr{display:grid;grid-template-columns:1fr 120px 110px 70px;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.eb-hr:first-child{border-top:0}
.eb-tt{display:flex;flex-direction:column;min-width:0}.eb-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eb-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eb-mid{font-size:12px;color:var(--mut);white-space:nowrap}.eb-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.eb-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.eb-dot.ok{background:var(--ok)}.eb-dot.warn{background:var(--warn)}.eb-dot.bad{background:var(--bad)}
@media (max-width:900px){
  .eb-stats{grid-template-columns:1fr 1fr}.eb-stt:nth-child(3){border-left:0}.eb-stt:nth-child(n+3){border-top:1px solid var(--line)}.eb-stt b{font-size:17px}
  .eb-ff .eb-b{width:100%}.eb-chips .eb-tg{flex:1;text-align:center}
  .eb-hr{grid-template-columns:1fr auto;grid-template-areas:"tt st" "mid when";gap:4px 10px}.eb-hr .eb-tt{grid-area:tt}.eb-hr .eb-st{grid-area:st}.eb-hr .eb-mid:nth-of-type(1){grid-area:mid}.eb-hr .eb-mid:last-child{grid-area:when;justify-self:end}
}
`;
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
  const [since, setSince] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setTick] = useState(0);
  const PRESETS = [{ label: "30 min", m: 30 }, { label: "1 hour", m: 60 }, { label: "2 hours", m: 120 }, { label: "6 hours", m: 360 }, { label: "12 hours", m: 720 }, { label: "24 hours", m: 1440 }];
  const formatDuration = (mins) => { if (mins < 60) return `~${mins} minutes`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `~${h}h ${m}m` : `~${h} hour${h > 1 ? "s" : ""}`; };
  const load = () => fetch("/api/admin/maintenance").then(r => r.json()).then(d => { setEnabled(d.enabled || false); if (d.message) setMsg(d.message); if (d.durationMinutes) { setDuration(d.durationMinutes); if (!PRESETS.some(p => p.m === d.durationMinutes)) { setUseCustom(true); setCustomH(String(Math.floor(d.durationMinutes / 60))); setCustomM(String(d.durationMinutes % 60)); } } setSince(d.since || null); setHistory(d.history || []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => { if (!enabled) return; const id = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(id); }, [enabled]);
  const mins = useCustom ? ((Number(customH) || 0) * 60 + (Number(customM) || 0)) : duration;
  const save = async (newEnabled) => {
    const e = newEnabled !== undefined ? newEnabled : enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: e, message: msg, durationMinutes: mins, estimatedReturn: formatDuration(mins) }) });
      if (res.ok) { if (newEnabled !== undefined) { setEnabled(e); toast.success(e ? "Offline" : "Back online", e ? "Customers see the maintenance page" : "Customers can order and pay again"); } else toast.success("Saved", "The message and time are what customers will see"); load(); }
      else { const d = await res.json().catch(() => ({})); toast.error("Failed", d.error || "Failed to save"); }
    } catch { toast.error("Network error", "Check your connection"); }
    setSaving(false);
  };
  const flip = async () => {
    const ok = await confirm({ title: enabled ? "Bring the site back?" : "Take the site offline?", message: enabled ? "Customers can order and pay again straight away." : `Customers will see the maintenance page and cannot order or pay. You are telling them about ${formatDuration(mins).replace("~", "")}.`, confirmText: enabled ? "Bring it back" : "Take it offline", danger: !enabled });
    if (ok) save(!enabled);
  };
  const fmt = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateOf = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const elapsed = since ? Math.round((Date.now() - new Date(since).getTime()) / 60000) : 0;
  const left = mins - elapsed;
  const headline = mins < 60 ? `Back in about ${mins} minutes` : mins === 60 ? "Back in about an hour" : mins % 60 === 0 ? `Back in about ${mins / 60} hours` : `Back in about ${Math.floor(mins / 60)}h ${mins % 60}m`;
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7", "--bg": t.bg || (dark ? "#0b0e1a" : "#e8e2d9"),
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--warnbg": dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  return (
    <div className="mt" style={vars}>
      <style>{MT_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Maintenance</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Take the site down for a moment, and tell customers when you will be back.</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelList dark={dark} rows={1} title avatar={false} rowH={96} /><div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}><Bone dark={dark} w={80} h={9} /><SkelBar dark={dark} search={false} pills={6} /><Bone dark={dark} w={70} h={9} /><Bone dark={dark} h={72} r={10} /><Bone dark={dark} w={60} h={9} /><Bone dark={dark} h={150} r={12} /></div></> : <>
        <section className="mt-card">
          <header><h3>Right now</h3><span className="mt-cnt">only the owner or a superadmin can flip this</span></header>
          <div className="mt-body">
            <div className="mt-now">
              <div className="mt-nl"><span className={"mt-big" + (enabled ? " off" : "")}>{enabled ? "Offline" : "Online"}</span><span className="mt-sub">{enabled ? "Customers see the maintenance page. Orders and payments are paused." : "Everything is open. Customers can order and pay."}</span></div>
              <button type="button" className={"mt-b" + (enabled ? " pri" : "")} disabled={saving} onClick={flip}>{enabled ? "Bring it back" : "Take it offline"}</button>
            </div>
            {enabled && since && <div className="mt-note"><i className="mt-dot" />Offline since {fmt(since)} · you said {formatDuration(mins).replace("~", "~")} · {left > 0 ? `${left} min left` : `${-left} min over`}</div>}
          </div>
        </section>

        <section className="mt-card">
          <header><h3>What customers will see</h3><span className="mt-cnt">saved with the switch, or with Save below</span></header>
          <div className="mt-body">
            <div className="mt-lbl">How long</div>
            <div className="mt-presets">
              {PRESETS.map(p => <button key={p.m} type="button" className={"mt-tg" + (!useCustom && duration === p.m ? " on" : "")} onClick={() => { setDuration(p.m); setUseCustom(false); }}>{p.label}</button>)}
              <button type="button" className={"mt-tg" + (useCustom ? " on" : "")} onClick={() => setUseCustom(true)}>Custom…</button>
            </div>
            {useCustom && <div className="mt-custom"><input type="number" min="0" max="72" value={customH} onChange={e => setCustomH(e.target.value)} placeholder="0" /><span>hours</span><input type="number" min="0" max="59" value={customM} onChange={e => setCustomM(e.target.value)} placeholder="0" /><span>minutes</span></div>}
            <div className="mt-lbl">Message</div>
            <textarea className="mt-ta" value={msg} onChange={e => setMsg(e.target.value)} rows={3} />
            <div className="mt-lbl">Preview</div>
            <div className="mt-pv"><div className="mt-pvl">NITRO</div><div className="mt-pvh">{headline}</div><div className="mt-pvp">{msg}</div><div className="mt-pvf">Your wallet and orders are safe. Nothing is lost.</div></div>
            <div className="mt-save"><button type="button" className="mt-b" disabled={saving} onClick={() => save()}>Save</button></div>
          </div>
        </section>

        <section className="mt-card">
          <header><h3>Last times</h3><span className="mt-cnt">when the site was down and for how long</span></header>
          <div className="mt-hl">
            {history.length === 0 ? <div className="mt-empty">No downtime recorded yet.</div> : history.map((h, i) => { const m = Math.max(1, Math.round((new Date(h.to) - new Date(h.from)) / 60000)); return (
              <div key={i} className="mt-hr"><span className="m">{dateOf(h.from)}</span><b>{fmt(h.from)} → {fmt(h.to)}</b><i>{m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`}{h.saidMinutes ? ` · said ${formatDuration(h.saidMinutes)}` : ""}{h.by ? ` · ${h.by}` : ""}</i></div>
            ); })}
          </div>
        </section>
      </>}
    </div>
  );
}

const MT_CSS = `
.mt{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.mt *{box-sizing:border-box}
.mt .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.mt-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.mt-b:hover{transform:translateY(-1px)}.mt-b:disabled{opacity:.5;cursor:not-allowed;transform:none}.mt-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.mt-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.mt-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.mt-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.mt-cnt{font-size:11.5px;color:var(--dim)}
.mt-body{padding:14px 16px 16px}
.mt-now{display:flex;justify-content:space-between;align-items:center;gap:12px}.mt-nl{display:flex;flex-direction:column;gap:4px;min-width:0}
.mt-big{font-size:26px;font-weight:800;letter-spacing:-.01em;display:inline-flex;align-items:center;gap:10px}.mt-big::before{content:"";width:12px;height:12px;border-radius:50%;background:var(--ok)}.mt-big.off{color:var(--warn)}.mt-big.off::before{background:var(--warn)}.mt-sub{font-size:13px;color:var(--mut)}
.mt-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--warnbg);font-size:12.5px;display:flex;align-items:center;gap:8px}.mt-dot{width:8px;height:8px;border-radius:50%;background:var(--warn);display:inline-block}
.mt-lbl{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:12px 0 8px}.mt-lbl:first-child{margin-top:0}
.mt-presets{display:flex;gap:6px;flex-wrap:wrap}.mt-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}.mt-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.mt-custom{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12.5px;color:var(--mut)}.mt-custom input{width:64px;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--soft);color:var(--ink);font:inherit;font-size:14px;outline:none}
.mt-ta{width:100%;font:inherit;font-size:13.5px;line-height:1.5;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--ink);outline:none;resize:vertical}.mt-ta:focus{border-color:var(--ac)}
.mt-pv{border:1px solid var(--line);border-radius:12px;padding:28px 22px;text-align:center;background:var(--bg)}.mt-pvl{font-size:11px;letter-spacing:3px;font-weight:800;color:var(--ac)}.mt-pvh{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;margin-top:10px}.mt-pvp{font-size:14px;color:var(--mut);margin-top:8px;max-width:38ch;margin-left:auto;margin-right:auto;line-height:1.5;white-space:pre-line}.mt-pvf{font-size:12px;color:var(--dim);margin-top:14px}
.mt-save{display:flex;justify-content:flex-end;margin-top:12px}
.mt-hl{padding:4px 16px 8px}.mt-empty{padding:20px 0;text-align:center;font-size:13px;color:var(--mut)}.mt-hr{display:grid;grid-template-columns:70px 150px 1fr;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--rail);font-size:13px}.mt-hr:first-child{border-top:0}.mt-hr .m{font-size:12px;color:var(--mut)}.mt-hr b{font-weight:600}.mt-hr i{font-style:normal;color:var(--mut)}
@media (max-width:900px){
  .mt-now{flex-direction:column;align-items:stretch}.mt-now .mt-b{width:100%}.mt-big{font-size:22px}.mt-presets .mt-tg{flex:1;text-align:center}.mt-save .mt-b{width:100%}
  .mt-hr{grid-template-columns:70px 1fr;grid-template-areas:"d b" ". i"}.mt-hr .m{grid-area:d}.mt-hr b{grid-area:b}.mt-hr i{grid-area:i}
}
`;

/* ═══════════════════════════════════════════ */
/* ═══ API MANAGEMENT                      ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAPIPage({ dark, t }) {
  const toast = useToast();
  const PROVIDERS = [
    { id: "mtp", name: "MoreThanPanel", role: "primary", host: "morethanpanel.com" },
    { id: "dao", name: "DaoSMM", role: "secondary", host: "daosmm.com" },
    { id: "jap", name: "JustAnotherPanel", role: "being retired", host: "justanotherpanel.com" },
  ];
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState({});
  const [testing, setTesting] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [result, setResult] = useState(null);
  const loadData = async () => {
    try { const res = await fetch("/api/admin/sync"); if (res.ok) { const d = await res.json(); setInfo(d.providers || {}); } } catch {}
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);
  const testConnection = async (p) => {
    setTesting(p.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", provider: p.id }) });
      const data = await res.json();
      if (res.ok) setResult({ id: p.id, ok: true, message: `Connected. Balance $${parseFloat(data.balance?.balance || 0).toFixed(2)}.` });
      else setResult({ id: p.id, ok: false, message: data.error || "Connection failed" });
    } catch (e) { setResult({ id: p.id, ok: false, message: e.message || "Network error" }); }
    setTesting(null);
  };
  const syncServices = async (p) => {
    setSyncing(p.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync", provider: p.id }) });
      const text = await res.text(); let data;
      try { data = JSON.parse(text); } catch { setResult({ id: p.id, ok: false, message: res.status === 504 ? "The sync took too long. Try again." : `Server error (${res.status})` }); setSyncing(null); return false; }
      if (res.ok) { setResult({ id: p.id, ok: true, message: `Synced ${data.total.toLocaleString()} services: ${data.updated} updated${data.disabled ? `, ${data.disabled} disabled` : ""}, ${data.skipped} unchanged.` }); loadData(); return true; }
      setResult({ id: p.id, ok: false, message: data.error || "Sync failed" });
    } catch (e) { setResult({ id: p.id, ok: false, message: e.message || "Network error" }); }
    setSyncing(null); return false;
  };
  const syncAll = async () => {
    for (const p of PROVIDERS) { if (info[p.id]?.configured) { const ok = await syncServices(p); if (!ok) break; } }
    setSyncing(null); toast.success("Catalogues synced", "See each row for what changed");
  };
  const connected = PROVIDERS.filter(p => info[p.id]?.configured);
  const totalBal = PROVIDERS.reduce((n, p) => n + (info[p.id]?.balance || 0), 0);
  const totalMenu = PROVIDERS.reduce((n, p) => n + (info[p.id]?.menu || 0), 0);
  const totalCat = PROVIDERS.reduce((n, p) => n + (info[p.id]?.catalogue || 0), 0);
  const totalOrders = PROVIDERS.reduce((n, p) => n + (info[p.id]?.orders || 0), 0);
  const top = [...PROVIDERS].sort((a, b) => (info[b.id]?.orders || 0) - (info[a.id]?.orders || 0))[0];
  const checkedAt = PROVIDERS.map(p => info[p.id]?.checkedAt).find(Boolean);
  const lastSyncAt = PROVIDERS.map(p => info[p.id]?.lastSync?.at).filter(Boolean).sort().pop();
  const ago = (iso) => { if (!iso) return null; const diff = Date.now() - new Date(iso).getTime(); if (diff < 3600e3) return `${Math.max(1, Math.round(diff / 60e3))} min ago`; if (diff < 86400e3) return `${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} today`; return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  const balCls = (b) => b == null ? "" : b < LOW_BALANCE_USD ? "bad" : b < 20 ? "warn" : "ok";
  return (
    <div className="pv" style={vars}>
      <style>{PV_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Providers</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>The upstream panels the catalogue comes from. Their names never reach a user.</div>
          </div>
          <button type="button" className="pv-b" onClick={syncAll} disabled={!!syncing || loading}>{syncing ? "Syncing…" : "Sync all catalogues"}</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelList dark={dark} rows={3} title avatar="square" rowH={66} /><SkelList dark={dark} rows={3} title avatar={false} rowH={40} /></> : <>
        <div className="pv-stats">
          <div className="pv-stt"><b className="m">${totalBal.toFixed(2)}</b><span>Across providers</span><i>{checkedAt ? `checked ${ago(checkedAt)}` : "not checked yet"}</i></div>
          <div className="pv-stt"><b className="m">{totalMenu.toLocaleString()}</b><span>Services on the menu</span><i>of {totalCat.toLocaleString()} in the catalogues</i></div>
          <div className="pv-stt"><b className="m">{totalOrders.toLocaleString()}</b><span>Orders sent</span><i>{totalOrders ? `${Math.round((info[top.id]?.orders || 0) / totalOrders * 100)}% through ${top.name}` : "none yet"}</i></div>
          <div className="pv-stt"><b className={"m " + (connected.length === PROVIDERS.length ? "ok" : "warn")}>{connected.length} of {PROVIDERS.length}</b><span>Connected</span><i>{lastSyncAt ? `last sync ${ago(lastSyncAt)}` : "no sync recorded yet"}</i></div>
        </div>

        <section className="pv-card">
          <header><h3>Providers</h3><span className="pv-cnt">balances refresh every 30 minutes · catalogues sync nightly</span></header>
          <div className="pv-list">
            {PROVIDERS.map(p => { const x = info[p.id] || {}; const r = result?.id === p.id ? result : null; return (
              <div key={p.id} className="pv-r">
                <span className="pv-n"><span className="pv-av">{p.id.toUpperCase()}</span><span className="pv-nt"><b>{p.name}</b><i>{p.role}</i></span></span>
                <span className="pv-c"><b className={"m " + balCls(x.balance)}>{x.balance == null ? "—" : `$${x.balance.toFixed(2)}`}</b><i>balance</i></span>
                <span className="pv-c"><b>{(x.menu || 0).toLocaleString()} on the menu</b><i>{(x.catalogue || 0).toLocaleString()} in the catalogue</i></span>
                <span className="pv-c"><b>{(x.orders || 0).toLocaleString()}</b><i>orders to date</i></span>
                <span className="pv-c"><b><i className={"pv-dot " + (x.configured ? "ok" : "dim")} />{x.configured ? "Connected" : "No key"}</b><i>{x.lastSync?.at ? `synced ${ago(x.lastSync.at)}` : "never synced"}</i></span>
                <span className="pv-a"><button type="button" className="pv-b sm" disabled={!x.configured || testing === p.id} onClick={() => testConnection(p)}>{testing === p.id ? "Testing…" : "Test"}</button><button type="button" className="pv-b sm" disabled={!x.configured || syncing === p.id} onClick={() => syncServices(p)}>{syncing === p.id ? "Syncing…" : "Sync catalogue"}</button></span>
                {r && <span className={"pv-res " + (r.ok ? "ok" : "bad")}>{r.message}</span>}
              </div>
            ); })}
          </div>
        </section>

        <section className="pv-card">
          <header><h3>Last sync</h3><span className="pv-cnt">{lastSyncAt ? `${ago(lastSyncAt)} · nightly, 1 to 3 am` : "nightly, 1 to 3 am"}</span></header>
          <div className="pv-sl">
            {PROVIDERS.map(p => { const ls = info[p.id]?.lastSync; return (
              <div key={p.id} className="pv-sr"><i className={"pv-dot " + (ls ? "ok" : "dim")} /><b>{p.name}</b><i>{ls ? `${(ls.total || 0).toLocaleString()} services · ${ls.updated || 0} prices changed · ${ls.disabled || 0} disabled${ls.created ? ` · ${ls.created} new` : ""}${ls.by && ls.by !== "nightly" ? ` · by ${ls.by}` : ""}` : "nothing recorded yet"}</i><span className="m pv-cnt">{ls ? new Date(ls.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></div>
            ); })}
          </div>
        </section>
      </>}
    </div>
  );
}

const PV_CSS = `
.pv{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.pv *{box-sizing:border-box}
.pv .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pv-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.pv-b:hover{transform:translateY(-1px)}.pv-b:disabled{opacity:.5;cursor:not-allowed;transform:none}.pv-b.sm{height:30px;padding:0 10px;font-size:12px}
.pv-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.pv-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.pv-stt:first-child{border-left:0}
.pv-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}.pv-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pv-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-stt b.ok,.pv-c b.ok{color:var(--ok)}.pv-stt b.warn,.pv-c b.warn{color:var(--warn)}.pv-c b.bad{color:var(--bad)}
.pv-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pv-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.pv-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.pv-cnt{font-size:11.5px;color:var(--dim)}
.pv-list{display:flex;flex-direction:column}
.pv-r{display:grid;grid-template-columns:200px 100px 150px 110px 150px 1fr;align-items:center;gap:12px;padding:14px 16px;border-top:1px solid var(--rail)}.pv-r:first-child{border-top:0}
.pv-n{display:flex;align-items:center;gap:10px;min-width:0}.pv-av{width:36px;height:36px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;letter-spacing:.5px;color:var(--mut);flex-shrink:0}.pv-nt{display:flex;flex-direction:column;min-width:0}.pv-nt b{font-weight:700;font-size:14px}.pv-nt i{font-style:normal;font-size:11.5px;color:var(--dim)}
.pv-c{display:flex;flex-direction:column;min-width:0}.pv-c b{font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.pv-c i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.pv-dot.ok{background:var(--ok)}.pv-dot.dim{background:var(--dim)}
.pv-a{display:flex;gap:6px;justify-content:flex-end}
.pv-res{grid-column:1 / -1;font-size:12.5px;padding:8px 12px;border-radius:9px;background:var(--soft);color:var(--ok)}.pv-res.bad{color:var(--bad)}
.pv-sl{padding:4px 16px 8px}.pv-sr{display:grid;grid-template-columns:8px 150px 1fr auto;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--rail);font-size:13px}.pv-sr:first-child{border-top:0}.pv-sr b{font-weight:600}.pv-sr i{font-style:normal;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:900px){
  .pv-stats{grid-template-columns:1fr 1fr}.pv-stt:nth-child(3){border-left:0}.pv-stt:nth-child(n+3){border-top:1px solid var(--line)}.pv-stt b{font-size:17px}
  .pv-r{grid-template-columns:1fr 1fr;padding:12px;gap:8px 10px}.pv-n{grid-column:1 / -1}.pv-a{grid-column:1 / -1;justify-content:stretch}.pv-a .pv-b{flex:1}
  .pv-sr{grid-template-columns:8px 1fr auto;grid-template-areas:"d b t" ". i i"}.pv-sr .pv-dot{grid-area:d}.pv-sr b{grid-area:b}.pv-sr i{grid-area:i;white-space:normal}.pv-sr .pv-cnt{grid-area:t}
}
`;

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
  const [detailLink, setDetailLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [range, setRange] = useState("7d");
  const [viewFilter, setViewFilter] = useState("active");
  const [archivedCount, setArchivedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const perPage = 10;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nitro.ng";
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
  const closeDetail = () => { setDetailLink(null); setAnalytics(null); };
  useEffect(() => {
    if (detailLink) loadAnalytics(detailLink.id, range);
  }, [range]);
  useEffect(() => {
    if (!detailLink) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeDetail(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [detailLink]);
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
      toast.success("Link made", `${baseUrl}/go/${newSlug.trim()}`);
      setNewName(""); setNewSlug(""); setShowAdd(false); load();
    } catch { toast.error("Failed"); }
    setSaving(false);
  };
  const handleArchive = async (link) => {
    const isArchived = !!link.archivedAt;
    if (!isArchived) {
      const ok = await confirm({ title: `Archive ${link.name}?`, message: "It leaves this list but keeps its numbers, and you can bring it back any time.", confirmText: "Archive" });
      if (!ok) return;
    }
    await fetch("/api/admin/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isArchived ? "unarchive" : "archive", id: link.id }),
    });
    toast.success(isArchived ? "Brought back" : "Archived", link.name);
    load();
  };
  const handleDelete = async (link) => {
    const ok = await confirm({ title: `Delete ${link.name}?`, message: link.signups > 0 ? "It has sign-ups. Archive it instead to keep the data." : "This cannot be undone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    const res = await fetch("/api/admin/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: link.id }),
    });
    const d = await res.json();
    if (d.soft) toast.info("Disabled instead", "It has sign-ups, so it was switched off rather than deleted");
    else toast.success("Deleted", link.name);
    load();
  };
  const copyLink = (slug) => { copyText(`${baseUrl}/go/${slug}`); toast.success("Copied", `${baseUrl}/go/${slug}`); };
  const displayLinks = (viewFilter === "archived" ? links.filter(l => l.archivedAt) : links.filter(l => !l.archivedAt)).filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.slug.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(displayLinks.length / perPage));
  const paginatedLinks = displayLinks.slice((page - 1) * perPage, page * perPage);
  const totalClicks = displayLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalSignups = displayLinks.reduce((s, l) => s + (l.signups || 0), 0);
  const totalOrders = displayLinks.reduce((s, l) => s + (l.orders || 0), 0);
  const totalRevenue = displayLinks.reduce((s, l) => s + (l.revenue || 0), 0);
  const best = [...displayLinks].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
  const dateOf = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)", "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--in": dark ? "#131728" : "#fff",
  };
  return (
    <div className="tl" style={vars}>
      <style>{TL_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Tracking links</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>One link per campaign. Who clicked, who signed up, who paid.</div>
          </div>
          <SegPill value={viewFilter} options={[{ value: "active", label: `Active${links.filter(l => !l.archivedAt).length && viewFilter === "active" ? ` · ${links.filter(l => !l.archivedAt).length}` : ""}` }, { value: "archived", label: `Archived${archivedCount ? ` · ${archivedCount}` : ""}` }]} onChange={v => { setViewFilter(v); setLoading(true); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} pills={0} right /><SkelList dark={dark} rows={5} avatar={false} rowH={58} /></> : <>
        <div className="tl-stats">
          <div className="tl-stt"><b className="m">{totalClicks.toLocaleString()}</b><span>Clicks</span><i>{viewFilter === "archived" ? "archived links" : "live links"} · unique people</i></div>
          <div className="tl-stt"><b className="m">{best ? (best.clicks || 0).toLocaleString() : "—"}</b><span>Best link</span><i>{best ? best.name : "no links yet"}</i></div>
          <div className="tl-stt"><b className="m">{totalSignups.toLocaleString()}</b><span>Sign-ups</span><i>{totalClicks ? `${(totalSignups / totalClicks * 100).toFixed(1)}% of clicks` : "from these links"}</i></div>
          <div className="tl-stt"><b className="m">{fN(totalRevenue / 100)}</b><span>Sales</span><i>{totalOrders.toLocaleString()} orders from sign-ups</i></div>
        </div>
        <div className="tl-bar">
          <div className="tl-srch"><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search links" /></div>
          <span className="tl-cnt">{displayLinks.length} {displayLinks.length === 1 ? "link" : "links"}</span>
          {canManage && <button type="button" className={"tl-b" + (showAdd ? "" : " pri")} onClick={() => setShowAdd(v => !v)}>{showAdd ? "Cancel" : "+ New link"}</button>}
        </div>
        {showAdd && (
          <section className="tl-card">
            <header><h3>New link</h3><span className="tl-cnt">the short link is {baseUrl}/go/…</span></header>
            <div className="tl-form">
              <label>Campaign name<input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Lagos flyers, September" /></label>
              <label>Short name<input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="e.g. lagos-sept" /></label>
              <div className="tl-ff"><button type="button" className="tl-b pri" disabled={saving || !newName.trim() || !newSlug.trim()} onClick={handleCreate}>{saving ? "Making…" : "Make link"}</button></div>
            </div>
          </section>
        )}
        <section className="tl-card">
          <header><h3>Links</h3><span className="tl-cnt">name · clicks · sign-ups · orders · made</span></header>
          <div className="tl-list">
            {paginatedLinks.length === 0 ? <div className="tl-empty">{search ? "Nothing matches." : viewFilter === "archived" ? "Nothing archived." : "No links yet. Make one for each place you advertise."}</div> : <>
              <div className="tl-lh"><span>Link</span><span className="r">Clicks</span><span className="r">Sign-ups</span><span className="r">Orders</span><span>Made</span><span /></div>
              {paginatedLinks.map(l => (
                <div key={l.id} className={"tl-r" + (l.archivedAt ? " off" : "")}>
                  <span className="tl-tt"><b>{l.name}</b><button type="button" className="tl-slug m" onClick={() => copyLink(l.slug)} title="Copy the link">{baseUrl.replace(/^https?:\/\//, "")}/go/{l.slug} ⧉</button></span>
                  <b className="m r">{(l.clicks || 0).toLocaleString()}</b>
                  <b className="m r">{(l.signups || 0).toLocaleString()}</b>
                  <b className="m r">{(l.orders || 0).toLocaleString()}</b>
                  <span className="tl-mid">{l.createdAt ? dateOf(l.createdAt) : ""}</span>
                  <span className="tl-acts"><button type="button" className="tl-b sm" onClick={() => openAnalytics(l)}>Analytics</button>{canManage && <button type="button" className="tl-b sm" onClick={() => handleArchive(l)}>{l.archivedAt ? "Bring back" : "Archive"}</button>}{canManage && l.archivedAt && <button type="button" className="tl-b sm bad" onClick={() => handleDelete(l)}>Delete</button>}</span>
                </div>
              ))}
            </>}
            {totalPages > 1 && <div className="tl-pg"><span className="tl-cnt">{page} of {totalPages}</span><span className="tl-pgn"><button type="button" className="tl-ib" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous">‹</button><button type="button" className="tl-ib" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next">›</button></span></div>}
          </div>
        </section>
      </>}

      {detailLink && (
        <div className="tl-bd" onClick={closeDetail}>
          <aside className="tl-dw" role="dialog" aria-modal="true" aria-label={`${detailLink.name} analytics`} onClick={e => e.stopPropagation()}>
            <div className="tl-dh">
              <div className="tl-dht"><b>{detailLink.name}</b><i className="m">{baseUrl.replace(/^https?:\/\//, "")}/go/{detailLink.slug}</i></div>
              <SegPill value={range} options={[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "all", label: "All" }]} onChange={setRange} dark={dark} t={t} />
              <button type="button" className="tl-b sm" onClick={closeDetail}>Close</button>
            </div>
            <div className="tl-dbody">
              <LinkAnalyticsDetail link={detailLink} analytics={analytics} analyticsLoading={analyticsLoading} range={range} setRange={setRange} dark={dark} t={t} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

const TL_CSS = `
.tl{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.tl *{box-sizing:border-box}
.tl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}.tl .r{text-align:right}
.tl-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.tl-b:hover{transform:translateY(-1px)}.tl-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.tl-b.sm{height:30px;padding:0 10px;font-size:12px}.tl-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.tl-b.bad{color:var(--bad)}
.tl-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.tl-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.tl-stt:first-child{border-left:0}
.tl-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.tl-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tl-srch{display:flex;align-items:center;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);min-width:280px}.tl-srch:focus-within{border-color:var(--acln)}.tl-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.tl-srch input::placeholder{color:var(--dim)}
.tl-cnt{font-size:12px;color:var(--dim);margin-left:auto}
.tl-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.tl-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.tl-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.tl-card>header .tl-cnt{margin:0}
.tl-form{padding:14px 16px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.tl-form label{display:flex;flex-direction:column;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}.tl-form input{height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none;width:100%}.tl-form input:focus{border-color:var(--ac)}.tl-ff{grid-column:1 / -1;display:flex;justify-content:flex-end}
.tl-list{display:flex;flex-direction:column}.tl-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.tl-lh{display:grid;grid-template-columns:1fr 90px 90px 90px 70px 230px;gap:12px;padding:0 16px;height:34px;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line)}
.tl-r{display:grid;grid-template-columns:1fr 90px 90px 90px 70px 230px;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.tl-r:first-of-type{border-top:0}.tl-r.off .tl-tt{opacity:.6}
.tl-tt{display:flex;flex-direction:column;min-width:0;gap:2px}.tl-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl-slug{font:inherit;font-size:11.5px;color:var(--mut);background:none;border:0;padding:0;text-align:left;cursor:copy;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl-slug:hover{color:var(--ac)}
.tl-r b.r{font-weight:700}.tl-mid{font-size:12px;color:var(--mut);white-space:nowrap}.tl-acts{display:flex;gap:6px;justify-content:flex-end}
.tl-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.tl-pg .tl-cnt{margin:0}.tl-pgn{display:inline-flex;gap:6px}.tl-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:14px;cursor:pointer;padding:0}.tl-ib:disabled{opacity:.35;cursor:not-allowed}
.tl-bd{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4)}
.tl-dw{position:absolute;top:0;right:0;bottom:0;width:680px;max-width:100%;background:var(--card);border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-12px 0 30px rgba(0,0,0,.2)}
.tl-dh{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}.tl-dht{flex:1;display:flex;flex-direction:column;min-width:0}.tl-dht b{font-size:16px;font-weight:700}.tl-dht i{font-style:normal;font-size:12px;color:var(--mut)}
.tl-dbody{flex:1;overflow:auto;padding:14px 18px 20px}
@media (max-width:900px){
  .tl-stats{grid-template-columns:1fr 1fr}.tl-stt:nth-child(3){border-left:0}.tl-stt:nth-child(n+3){border-top:1px solid var(--line)}.tl-stt b{font-size:17px}
  .tl-srch{width:100%;min-width:0}.tl-bar .tl-cnt{display:none}.tl-bar .tl-b{width:100%}.tl-form{grid-template-columns:1fr}
  .tl-lh{display:none}.tl-r{grid-template-columns:1fr 1fr 1fr;grid-template-areas:"tt tt tt" "c s o" "acts acts acts";gap:6px 10px;padding:12px 14px}.tl-r .tl-tt{grid-area:tt}.tl-r b.r{text-align:left;font-size:14px}.tl-r b.r::after{display:block;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--dim);font-family:Outfit,system-ui,sans-serif}.tl-r b.r:nth-of-type(1)::after{content:"clicks"}.tl-r b.r:nth-of-type(2)::after{content:"sign-ups"}.tl-r b.r:nth-of-type(3)::after{content:"orders"}.tl-r .tl-mid{display:none}.tl-r .tl-acts{grid-area:acts;justify-content:stretch}.tl-r .tl-acts .tl-b{flex:1}
  .tl-dw{width:100%;top:6vh;border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0}
}
`;
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
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
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

      {loading ? <><SkelFacts dark={dark} /><SkelList dark={dark} rows={3} title avatar={false} rowH={62} /><div className="is-cols"><SkelList dark={dark} rows={5} title avatar={false} rowH={40} /><SkelList dark={dark} rows={5} title avatar={false} rowH={40} /></div></> : <>
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
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [page, setPage] = useState(0);
  const perPage = 10;
  const load = () => fetch("/api/changelog").then(r => r.json()).then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Needs a title and what changed"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/changelog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      toast.success("Published", form.title);
      setForm({ date: new Date().toISOString().slice(0, 10), tag: "new", title: "", description: "" });
      setShowAdd(false);
      load();
    } catch (err) { toast.error("Could not publish", err.message); }
    setSaving(false);
  };
  const remove = async (id, title) => {
    const ok = await confirm({ title: "Delete this entry?", message: `"${title}" leaves the changelog page. This cannot be undone.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      const r = await fetch("/api/changelog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!r.ok) throw new Error("Failed");
      toast.success("Deleted", title);
      load();
    } catch { toast.error("Could not delete"); }
  };
  const TAG = { new: "New", improved: "Improved", fixed: "Fixed" };
  const dateOf = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }); };
  const daysAgo = (iso) => { const n = Math.round((Date.now() - new Date(iso).getTime()) / 864e5); return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };
  const counts = entries.reduce((m, e) => { m[e.tag] = (m[e.tag] || 0) + 1; return m; }, {});
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = entries.filter(e => new Date(e.date) >= monthStart).length;
  const latest = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const shown = entries.filter(e => (tagFilter === "all" || e.tag === tagFilter) && (!search || `${e.title} ${e.description}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => new Date(b.date) - new Date(a.date));
  const pages = Math.max(1, Math.ceil(shown.length / perPage));
  const paged = shown.slice(page * perPage, (page + 1) * perPage);
  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)", "--ok": dark ? "#6ee7b7" : "#0a7d54", "--blue": dark ? "#a5b4fc" : "#4c62c4", "--bad": dark ? "#fca5a5" : "#c62828", "--in": dark ? "#131728" : "#fff",
  };
  return (
    <div className="cl" style={vars}>
      <style>{CL_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Changelog</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>What customers read on nitro.ng/changelog.</div>
          </div>
          <span className="cl-hb"><a href="/changelog" target="_blank" rel="noopener noreferrer" className="cl-b">View the page</a><button type="button" className="cl-b pri" onClick={() => setShowAdd(true)}>+ New entry</button></span>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} pills={3} /><SkelList dark={dark} rows={6} title avatar={false} rowH={64} /></> : <>
        <div className="cl-stats">
          <div className="cl-stt"><b className="m">{entries.length}</b><span>Entries</span><i>{entries.length ? `since ${dateOf([...entries].sort((a, b) => new Date(a.date) - new Date(b.date))[0].date)}` : "none yet"}</i></div>
          <div className="cl-stt"><b className="m">{thisMonth}</b><span>This month</span><i>{latest ? `last one ${dateOf(latest.date)}, ${daysAgo(latest.date)}` : "nothing yet"}</i></div>
          <div className="cl-stt"><b className="m">{counts.new || 0} · {counts.improved || 0} · {counts.fixed || 0}</b><span>New · improved · fixed</span><i>how the entries split</i></div>
          <div className="cl-stt"><b>{latest ? TAG[latest.tag] || latest.tag : "—"}</b><span>Most recent</span><i>{latest ? latest.title : ""}</i></div>
        </div>
        <div className="cl-bar">
          <div className="cl-srch"><input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search entries" /></div>
          {[["all", `All ${entries.length}`], ["new", `New ${counts.new || 0}`], ["improved", `Improved ${counts.improved || 0}`], ["fixed", `Fixed ${counts.fixed || 0}`]].map(([v, l]) => <button key={v} type="button" className={"cl-tg" + (tagFilter === v ? " on" : "")} onClick={() => { setTagFilter(v); setPage(0); }}>{l}</button>)}
        </div>

        <section className={"cl-card cl-composer" + (showAdd ? " open" : "")}>
          <header onClick={() => setShowAdd(v => !v)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowAdd(v => !v); } }} aria-expanded={showAdd}>
            <h3>New entry</h3><span className="cl-cnt">{showAdd ? "plain words, the way a customer would say it" : "tap to write one"}</span>
            <svg className="cl-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </header>
          {showAdd && (
            <div className="cl-form">
              <div className="cl-two">
                <label>Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
                <div><span className="cl-lbl">Kind</span><div className="cl-chips">{Object.entries(TAG).map(([v, l]) => <button key={v} type="button" className={"cl-tg" + (form.tag === v ? " on" : "")} onClick={() => setForm({ ...form, tag: v })}>{l}</button>)}</div></div>
              </div>
              <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="One line a customer would understand" /></label>
              <label>What changed<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6} placeholder="Say what they can do now, or what stopped being annoying. No jargon." /></label>
              <div className="cl-ff"><button type="button" className="cl-b" onClick={() => setShowAdd(false)}>Cancel</button><button type="button" className="cl-b pri" disabled={saving || !form.title.trim() || !form.description.trim()} onClick={add}>{saving ? "Publishing…" : "Publish"}</button></div>
            </div>
          )}
        </section>

        <section className="cl-card">
          <header><h3>Entries</h3><span className="cl-cnt">newest first · {shown.length ? `${page * perPage + 1}–${Math.min((page + 1) * perPage, shown.length)} of ${shown.length}` : "none"}</span></header>
          <div className="cl-list">
            {paged.length === 0 ? <div className="cl-empty">{entries.length ? "Nothing matches." : "Nothing published yet."}</div> : paged.map(e => (
              <div key={e.id} className="cl-r">
                <span className={"cl-ty tag-" + (e.tag || "new")}>{TAG[e.tag] || e.tag}</span>
                <span className="cl-tt"><b>{e.title}</b><i>{e.description}</i></span>
                <span className="cl-mid m">{dateOf(e.date)}</span>
                <span className="cl-acts"><button type="button" className="cl-b sm bad" onClick={() => remove(e.id, e.title)}>Delete</button></span>
              </div>
            ))}
            {pages > 1 && <div className="cl-pg"><span className="cl-cnt">{page + 1} of {pages}</span><span className="cl-pgn"><button type="button" className="cl-ib" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous">‹</button><button type="button" className="cl-ib" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next">›</button></span></div>}
          </div>
        </section>
      </>}
    </div>
  );
}

const CL_CSS = `
.cl{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.cl *{box-sizing:border-box}
.cl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.cl-hb{display:flex;gap:8px}
.cl-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;transition:transform .15s}.cl-b:hover{transform:translateY(-1px)}.cl-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.cl-b.sm{height:30px;padding:0 10px;font-size:12px}.cl-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.cl-b.bad{color:var(--bad)}
.cl-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.cl-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.cl-stt:first-child{border-left:0}
.cl-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cl-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.cl-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cl-srch{display:flex;align-items:center;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);min-width:280px}.cl-srch:focus-within{border-color:var(--acln)}.cl-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.cl-srch input::placeholder{color:var(--dim)}
.cl-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}.cl-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.cl-cnt{font-size:11.5px;color:var(--dim)}
.cl-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.cl-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.cl-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}
.cl-composer>header{cursor:pointer;user-select:none;border-bottom:0;align-items:center}.cl-composer.open>header{border-bottom:1px solid var(--line)}.cl-composer>header:hover{background:var(--soft)}.cl-composer>header .cl-cnt{flex:1}.cl-chev{color:var(--mut);transition:transform .2s;flex-shrink:0}.cl-composer.open .cl-chev{transform:rotate(180deg)}
.cl-form{padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px}.cl-two{display:grid;grid-template-columns:180px 1fr;gap:12px 16px;align-items:start}
.cl-form label,.cl-lbl{display:flex;flex-direction:column;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}.cl-lbl{margin-bottom:6px}
.cl-form input,.cl-form textarea{width:100%;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none;letter-spacing:0;text-transform:none;font-weight:400}.cl-form input{height:40px}.cl-form textarea{min-height:150px;padding:10px 12px;line-height:1.55;resize:vertical}.cl-form input:focus,.cl-form textarea:focus{border-color:var(--ac)}
.cl-chips{display:flex;gap:6px;flex-wrap:wrap}.cl-ff{display:flex;justify-content:flex-end;gap:8px}
.cl-list{display:flex;flex-direction:column}.cl-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.cl-r{display:grid;grid-template-columns:90px 1fr 70px auto;align-items:start;gap:12px;padding:12px 16px;border-top:1px solid var(--rail);font-size:13px}.cl-r:first-child{border-top:0}
.cl-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;text-align:center;white-space:nowrap;justify-self:start;margin-top:2px;color:var(--mut)}.cl-ty.tag-new{color:var(--ac);border-color:rgba(196,125,142,.5)}.cl-ty.tag-improved{color:var(--blue);border-color:rgba(76,98,196,.4)}.cl-ty.tag-fixed{color:var(--ok);border-color:rgba(10,125,84,.4)}
.cl-tt{display:flex;flex-direction:column;gap:3px;min-width:0}.cl-tt b{font-weight:600}.cl-tt i{font-style:normal;font-size:12px;color:var(--mut);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cl-mid{font-size:12px;color:var(--mut);white-space:nowrap;margin-top:3px}.cl-acts{display:flex;gap:6px;justify-content:flex-end}
.cl-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.cl-pgn{display:inline-flex;gap:6px}.cl-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:14px;cursor:pointer;padding:0}.cl-ib:disabled{opacity:.35;cursor:not-allowed}
@media (max-width:900px){
  .cl-hb{width:100%;flex-direction:column}.cl-hb .cl-b{width:100%}
  .cl-stats{grid-template-columns:1fr 1fr}.cl-stt:nth-child(3){border-left:0}.cl-stt:nth-child(n+3){border-top:1px solid var(--line)}.cl-stt b{font-size:17px}
  .cl-srch{width:100%;min-width:0}.cl-bar .cl-tg{flex:1;text-align:center;padding:8px 6px}.cl-two{grid-template-columns:1fr}
  .cl-r{grid-template-columns:1fr auto;grid-template-areas:"ty d" "tt tt" "acts acts";gap:6px 10px;padding:12px 14px}.cl-r .cl-ty{grid-area:ty}.cl-r .cl-mid{grid-area:d}.cl-r .cl-tt{grid-area:tt}.cl-r .cl-acts{grid-area:acts;justify-content:stretch}.cl-r .cl-acts .cl-b{flex:1}
}
`;
/* ═══════════════════════════════════════════ */
/* ═══ CREATE ORDER                        ═══ */
/* ═══════════════════════════════════════════ */

export { AdminCreateOrderPage } from "./admin-create-order-page";

