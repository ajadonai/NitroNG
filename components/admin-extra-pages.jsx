'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";
import { FilterDropdown } from "./date-range-picker";
import { Avatar } from "./avatar";


const ROLE_COLORS = { superadmin: "#c47d8e", admin: "#a5b4fc", support: "#6ee7b7", finance: "#fcd34d" };

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
  const [sysFilter, setSysFilter] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [sysPage, setSysPage] = useState(0);
  const [sysPerPage, setSysPerPage] = useState(10);

  const fetchActivity = useCallback((q) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : '';
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

  // Admin tab helpers
  const typeLabels = { user: "Users", order: "Orders", alert: "Alerts", blog: "Blog", coupon: "Coupons", settings: "Settings", service: "Services", payment: "Payments", reward: "Rewards", leaderboard_reward: "Rewards", leaderboard_announcement: "Rewards", auto_reward_config: "Rewards", team: "Team", admin: "Admin", ticket: "Tickets", maintenance: "Maintenance" };
  const getTypeLabel = (type) => {
    if (!type) return "Other";
    if (typeLabels[type]) return typeLabels[type];
    if (type.startsWith("Rewarded") || type.startsWith("Updated auto-reward") || type.startsWith("Updated leaderboard")) return "Rewards";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  const groupedTypes = {};
  const adminNames = new Set();
  logs.forEach(l => { const label = getTypeLabel(l.type); groupedTypes[label] = (groupedTypes[label] || 0) + 1; if (l.admin) adminNames.add(l.admin); });
  const typeEntries = Object.entries(groupedTypes).sort((a, b) => b[1] - a[1]);
  const filtered = logs.filter(l => {
    if (filter !== "all" && getTypeLabel(l.type) !== filter) return false;
    if (adminFilter !== "all" && l.admin !== adminFilter) return false;
    return true;
  });
  const adminPages = Math.ceil(filtered.length / perPage);
  const adminPaged = filtered.slice(page * perPage, (page + 1) * perPage);
  const typeColor = (type) => {
    if (type === "order") return t.blue;
    if (type === "credit" || type === "deposit") return t.green;
    if (type === "admin" || type === "maintenance") return t.amber;
    if (type === "notification") return t.accent;
    return t.textMuted;
  };

  // System tab helpers
  const SYS_META = {
    dispatch_error:   { label: "Dispatch errors", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, color: dk => dk ? "#fca5a5" : "#dc2626" },
    partial_delivery: { label: "Partial deliveries", icon: "◑", color: dk => dk ? "#fcd34d" : "#d97706" },
    refund:           { label: "Refunds", icon: "↩", color: dk => dk ? "#a5b4fc" : "#4f46e5" },
  };
  const sysFiltered = sysFilter === "all" ? sysEvents : sysEvents.filter(e => e.type === sysFilter);
  const sysPages = Math.ceil(sysFiltered.length / sysPerPage);
  const sysPaged = sysFiltered.slice(sysPage * sysPerPage, (sysPage + 1) * sysPerPage);
  const severityColor = (sev, dk) => sev === "high" ? (dk ? "#fca5a5" : "#dc2626") : sev === "medium" ? (dk ? "#fcd34d" : "#d97706") : (dk ? "#a5b4fc" : "#4f46e5");

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Logs</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{tab === "admin" ? `Admin audit trail — ${logs.length} entries` : `System events — last 30 days`}</div>
          </div>
          <SegPill value={tab} options={[{ value: "admin", label: "Admin" }, { value: "system", label: `System${sysEvents.length > 0 ? ` (${sysEvents.length})` : ""}` }]} onChange={v => { setTab(v); setExpandedEvent(null); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ ADMIN TAB ═══ */}
      {tab === "admin" && <>
        <div className="adm-filters flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search logs..." className="w-full py-2 px-3 pr-8 rounded-lg text-[13px] outline-none font-[inherit] box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "#fff", color: t.text }} />
            {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <FilterDropdown dark={dark} t={t} value={adminFilter} onChange={(v) => { setAdminFilter(v); setPage(0); }} options={[
              { value: "all", label: "All admins" },
              ...[...adminNames].sort().map(name => ({ value: name, label: name })),
            ]} />
            <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(0); }} options={[
              { value: "all", label: "All types" },
              ...typeEntries.map(([label]) => ({ value: label, label })),
            ]} />
          </div>
        </div>

        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
          {loading ? (
            <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-10 rounded-md mb-1.5`} />)}</div>
          ) : adminPaged.length > 0 ? adminPaged.map((l, i) => (
            <div key={l.id || i} className="adm-list-row" style={{ borderBottom: i < adminPaged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: typeColor(l.type) }} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium" style={{ color: t.text }}>{l.action}</div>
                <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>
                  <span className="font-semibold" style={{ color: t.textSoft }}>{l.admin}</span> · {l.type || "action"} · {l.time ? fD(l.time) : ""}
                </div>
              </div>
            </div>
          )) : (
            <div className="py-[60px] px-5 text-center">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
                <circle cx="32" cy="32" r="22" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
                <line x1="32" y1="18" x2="32" y2="32" stroke={t.accent} strokeWidth="2" opacity=".3" strokeLinecap="round" />
                <line x1="32" y1="32" x2="42" y2="38" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No activity logged yet</div>
              <div className="text-sm" style={{ color: t.textMuted }}>Activity will appear here as actions are taken</div>
            </div>
          )}
          {adminPages > 1 && (
            <div className="flex items-center justify-between py-3 px-5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 0 ? .35 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Prev
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textMuted }}>
                  <span>Show</span>
                  <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {page + 1} of {adminPages}</span>
              </div>
              <button onClick={() => setPage(p => Math.min(adminPages - 1, p + 1))} disabled={page >= adminPages - 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= adminPages - 1 ? .35 : 1 }}>
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </>}

      {/* ═══ SYSTEM TAB ═══ */}
      {tab === "system" && <>
        <div className="adm-filters flex justify-end">
          <FilterDropdown dark={dark} t={t} value={sysFilter} onChange={(v) => { setSysFilter(v); setSysPage(0); setExpandedEvent(null); }} options={[
            { value: "all", label: "All" },
            ...Object.entries(SYS_META).map(([key, m]) => ({ value: key, label: m.label })),
          ]} />
        </div>

        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
          {sysLoading ? (
            <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-10 rounded-md mb-1.5`} />)}</div>
          ) : sysPaged.length > 0 ? sysPaged.map((ev, i) => {
            const meta = SYS_META[ev.type] || SYS_META.dispatch_error;
            const isOpen = expandedEvent === ev.id;
            return (
              <div key={ev.id}>
                <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setExpandedEvent(isOpen ? null : ev.id)} className="adm-list-row cursor-pointer transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: (i < sysPaged.length - 1 || isOpen) ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: dark ? `${meta.color(dark)}15` : `${meta.color(dark)}10`, color: meta.color(dark) }}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium flex items-center gap-2" style={{ color: t.text }}>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{ev.title}</span>
                      {ev.severity === "high" && <span className="text-[10px] font-semibold py-0.5 px-1.5 rounded shrink-0" style={{ background: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>HIGH</span>}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>
                      {ev.meta?.user && <><span className="font-semibold" style={{ color: t.textSoft }}>{ev.meta.user}</span> · </>}
                      {ev.meta?.provider && <>{ev.meta.provider.toUpperCase()} · </>}
                      {ev.time ? fD(ev.time) : ""}
                    </div>
                  </div>
                  <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                {isOpen && (
                  <div className="py-3 px-4 pb-4" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)", borderBottom: i < sysPaged.length - 1 ? `1px solid ${t.cardBorder}` : "none", borderLeft: `3px solid ${meta.color(dark)}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                    {ev.detail && (
                      <div className="text-[13px] mb-2.5 py-2 px-3 rounded-lg font-[JetBrains_Mono,monospace] break-all" style={{ background: dark ? "rgba(0,0,0,.38)" : "rgba(0,0,0,.08)", color: dark ? "#fca5a5" : "#dc2626", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>{ev.detail}</div>
                    )}
                    <div className="grid gap-1.5 text-[13px]" style={{ gridTemplateColumns: "auto 1fr" }}>
                      {ev.meta?.orderId && <><span style={{ color: t.textMuted }}>Order:</span><span className="m" style={{ color: t.text }}>{ev.meta.orderId}</span></>}
                      {ev.meta?.batchId && <><span style={{ color: t.textMuted }}>Batch:</span><span className="m" style={{ color: t.text }}>{ev.meta.batchId}</span></>}
                      {ev.meta?.service && <><span style={{ color: t.textMuted }}>Service:</span><span style={{ color: t.text }}>{ev.meta.service}</span></>}
                      {ev.meta?.provider && <><span style={{ color: t.textMuted }}>Provider:</span><span className="font-semibold" style={{ color: t.text }}>{ev.meta.provider.toUpperCase()}</span></>}
                      {ev.meta?.retries != null && <><span style={{ color: t.textMuted }}>Retries:</span><span style={{ color: ev.meta.retries >= 3 ? (dark ? "#fca5a5" : "#dc2626") : t.text }}>{ev.meta.retries}</span></>}
                      {ev.meta?.status && <><span style={{ color: t.textMuted }}>Status:</span><span style={{ color: severityColor(ev.severity, dark) }}>{ev.meta.status}</span></>}
                      {ev.meta?.delivered != null && <><span style={{ color: t.textMuted }}>Delivered:</span><span style={{ color: t.text }}>{ev.meta.delivered.toLocaleString()} / {ev.meta.total.toLocaleString()}</span></>}
                      {ev.meta?.amount != null && <><span style={{ color: t.textMuted }}>Amount:</span><span style={{ color: t.green }}>{fN(ev.meta.amount)}</span></>}
                      {ev.meta?.reference && <><span style={{ color: t.textMuted }}>Reference:</span><span className="m" style={{ color: t.text }}>{ev.meta.reference}</span></>}
                      {ev.meta?.user && <><span style={{ color: t.textMuted }}>User:</span><span style={{ color: t.text }}>{ev.meta.user}</span></>}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="py-[60px] px-5 text-center">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
                <circle cx="32" cy="32" r="22" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
                <path d="M32 24v10" stroke={t.accent} strokeWidth="2" opacity=".3" strokeLinecap="round" />
                <circle cx="32" cy="40" r="1.5" fill={t.accent} opacity=".3" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No system events</div>
              <div className="text-sm" style={{ color: t.textMuted }}>Dispatch errors, partial deliveries, and refunds will appear here</div>
            </div>
          )}
          {sysPages > 1 && (
            <div className="flex items-center justify-between py-3 px-5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              <button onClick={() => setSysPage(p => Math.max(0, p - 1))} disabled={sysPage === 0} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: sysPage === 0 ? .35 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Prev
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textMuted }}>
                  <span>Show</span>
                  <select value={sysPerPage} onChange={e => { setSysPerPage(Number(e.target.value)); setSysPage(0); }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {sysPage + 1} of {sysPages}</span>
              </div>
              <button onClick={() => setSysPage(p => Math.min(sysPages - 1, p + 1))} disabled={sysPage >= sysPages - 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: sysPage >= sysPages - 1 ? .35 : 1 }}>
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </>}
    </>
  );
}

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════ */
/* ═══ TEAM MANAGEMENT                     ═══ */
/* ═══════════════════════════════════════════ */
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
  { id:"alerts", label:"Alerts", g:"System" },{ id:"notifications", label:"Notifications", g:"System" },{ id:"activity", label:"Activity Log", g:"System" },{ id:"team", label:"Team", g:"System" },{ id:"api", label:"API", g:"System" },{ id:"maintenance", label:"Maintenance", g:"System" },{ id:"settings", label:"Settings", g:"System" },
];
const GRANTABLE_ACTIONS = [
  { id: "payments.approve", label: "Approve/Reject Deposits", g: "Finance" },
  { id: "payments.configure", label: "Configure Gateways", g: "Finance" },
  { id: "users.adjustBalance", label: "Credit User Balance", g: "Users" },
  { id: "users.ban", label: "Suspend/Ban Users", g: "Users" },
  { id: "leaderboard.reward", label: "Send Leaderboard Rewards", g: "Marketing" },
  { id: "leaderboard.announcement", label: "Set Reward Announcement", g: "Marketing" },
  { id: "notifications.send", label: "Send Email Blasts", g: "Marketing" },
  { id: "promotions.manage", label: "Manage Promotions", g: "Marketing" },
];
const DEFAULT_PAGES = {
  admin: ["overview","orders","users","leaderboard","services","menu-builder","pricing","tickets","activity","alerts","finance","rewards","blog"],
  support: ["overview","orders","users","tickets"],
  finance: ["overview","orders","payments","finance","financials","leaderboard"],
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
  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
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

  // Loyalty tier settings
  const DEFAULT_TIERS = [
    { name: "Starter", threshold: 0, discount: 0, perks: "Welcome to Nitro", color: "#6B7280" },
    { name: "Regular", threshold: 5000000, discount: 3, perks: "3% discount on all orders", color: "#F59E0B" },
    { name: "Power User", threshold: 25000000, discount: 5, perks: "5% discount + priority support", color: "#3B82F6" },
    { name: "Elite", threshold: 100000000, discount: 8, perks: "8% discount + priority support", color: "#8B5CF6" },
    { name: "Legend", threshold: 500000000, discount: 12, perks: "12% discount + priority support + early access", color: "#EF4444" },
  ];
  const [loyaltyTiers, setLoyaltyTiers] = useState(DEFAULT_TIERS);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/coupons").then(r => r.json()).then(d => { setCoupons(d.coupons || []); setLoading(false); }).catch(() => setLoading(false));
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (!d.settings) return;
      const s = d.settings;
      if (s.ref_enabled !== undefined) setRefEnabled(s.ref_enabled === "true" || s.ref_enabled === true);
      if (s.ref_referrer_bonus) setRefReferrer(String(Math.round(Number(s.ref_referrer_bonus) / 100)));
      if (s.ref_invitee_bonus) setRefInvitee(String(Math.round(Number(s.ref_invitee_bonus) / 100)));
      if (s.ref_min_deposit) setRefMinDeposit(String(Math.round(Number(s.ref_min_deposit) / 100)));
      if (s.loyalty_enabled !== undefined) setLoyaltyEnabled(s.loyalty_enabled === "true" || s.loyalty_enabled === true);
      if (s.loyalty_tiers) {
        try { setLoyaltyTiers(JSON.parse(s.loyalty_tiers)); } catch {}
      }
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

  const saveLoyalty = async () => {
    setLoyaltySaving(true); setLoyaltyMsg(null);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: {
        loyalty_enabled: String(loyaltyEnabled),
        loyalty_tiers: JSON.stringify(loyaltyTiers),
      }}) });
      setLoyaltyMsg(r.ok ? { ok: true, text: "Loyalty settings saved" } : { text: "Failed to save" });
    } catch { setLoyaltyMsg({ text: "Request failed" }); }
    setLoyaltySaving(false);
  };

  const updateTier = (idx, field, value) => {
    setLoyaltyTiers(prev => prev.map((t2, i) => i === idx ? { ...t2, [field]: value } : t2));
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
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage referrals, coupons, and loyalty program</div>
          </div>
          <SegPill value={rewardsTab} options={[{value: "referrals", label: "Referrals"}, {value: "coupons", label: "Coupons"}, {value: "loyalty", label: "Loyalty"}]} onChange={setRewardsTab} dark={dark} t={t} />
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

        {refMsg && <div className="py-2 px-3.5 rounded-lg mb-3 text-[13px]" style={{ background: refMsg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: refMsg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{refMsg.ok ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} {refMsg.text}</div>}

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
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading coupons...</div>
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
            <button onClick={() => { navigator.clipboard.writeText(c.code); setCopiedCode(c.id); setTimeout(() => setCopiedCode(null), 1500); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: copiedCode === c.id ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>{copiedCode === c.id ? "Copied!" : "Copy"}</button>
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

      {/* ═══ LOYALTY TAB ═══ */}
      {rewardsTab === "loyalty" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Loyalty program</div>
        </div>
        <div className="set-card-body">

        <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.textMuted }}>
          Users earn tiers based on total lifetime spend. Each tier grants an automatic discount on future orders.
        </div>

        {loyaltyMsg && <div className="py-2 px-3.5 rounded-lg mb-3 text-[13px]" style={{ background: loyaltyMsg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: loyaltyMsg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{loyaltyMsg.ok ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} {loyaltyMsg.text}</div>}

        <div className="flex items-center justify-between py-3 mb-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Loyalty program</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Enable automatic tier-based discounts</div></div>
          <div role="switch" aria-checked={loyaltyEnabled} aria-label="Loyalty program" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setLoyaltyEnabled(!loyaltyEnabled)} className="w-[44px] h-6 rounded-xl relative cursor-pointer shrink-0" style={{ background: loyaltyEnabled ? "#c47d8e" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") }}>
            <div className="w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: loyaltyEnabled ? 23 : 3 }} />
          </div>
        </div>

        {loyaltyTiers.map((tier, idx) => (
          <div key={idx} className="p-4 rounded-[10px] border mb-4" style={{ borderColor: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)", borderLeft: `3px solid ${tier.color}`, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: tier.color }}>Tier {idx + 1}{idx === 0 ? " — Base" : ""}</div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tier.color }} />
              <input value={tier.name} onChange={e => updateTier(idx, "name", e.target.value.slice(0, 20))} className="w-full py-1.5 px-2.5 rounded-lg border border-solid text-base font-semibold outline-none box-border font-[inherit]" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: t.textMuted }}>Min. spend (₦)</label>
                <input type="number" value={Math.round(tier.threshold / 100)} onChange={e => updateTier(idx, "threshold", Number(e.target.value || 0) * 100)} className={inputCls} style={inputStyle} disabled={idx === 0} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: t.textMuted }}>Discount (%)</label>
                <input type="number" value={tier.discount} onChange={e => updateTier(idx, "discount", Math.min(50, Math.max(0, Number(e.target.value || 0))))} className={inputCls} style={inputStyle} min={0} max={50} />
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: t.textMuted }}>Perks description</label>
              <input value={tier.perks} onChange={e => updateTier(idx, "perks", e.target.value.slice(0, 200))} placeholder="Describe the perks for this tier" className={inputCls} style={inputStyle} />
            </div>
            <div className="mt-2.5">
              <label className="text-xs block mb-1" style={{ color: t.textMuted }}>Badge color</label>
              <div className="flex gap-1.5">
                {["#6B7280", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444", "#059669", "#EC4899", "#c47d8e"].map(c => (
                  <div key={c} onClick={() => updateTier(idx, "color", c)} className="w-6 h-6 rounded-md cursor-pointer" style={{ background: c, border: tier.color === c ? "2px solid #fff" : "2px solid transparent", boxShadow: tier.color === c ? `0 0 0 2px ${c}` : "none" }} />
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="mt-4">
          <button onClick={saveLoyalty} disabled={loyaltySaving} className="adm-btn-primary" style={{ opacity: loyaltySaving ? .5 : 1 }}>{loyaltySaving ? "Saving..." : "Save Loyalty Settings"}</button>
        </div>
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

  useEffect(() => {
    fetch("/api/admin/notifications").then(r => r.json()).then(d => { setHistory(d.history || []); setPromoCount(d.promoCount || 0); setTotalCount(d.totalCount || 0); setLoading(false); }).catch(() => setLoading(false));
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
        const pollDone = setInterval(() => {
          fetch("/api/admin/notifications").then(r => r.json()).then(d => {
            setHistory(d.history || []);
            const latest = (d.history || [])[0];
            if (latest && latest.status !== "sending") {
              clearInterval(pollDone);
              if (latest.status === "failed") toast.error("Send failed", `${latest.sent}/${latest.recipients} delivered`);
              else toast.success("Delivered", `${latest.sent}/${latest.recipients} delivered`);
            }
          });
        }, 3000);
        setTimeout(() => clearInterval(pollDone), 120000);
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
      <div className="adm-card mt-4 mb-5 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
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
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
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
            <div key={p.id} className="adm-card mb-3 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.31)" : "0 4px 20px rgba(0,0,0,.08)" }}>
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

              {pResult && (
                <div className="mt-2.5 py-2 px-3 rounded-lg text-[13px]" style={{ background: pResult.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: pResult.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>
                  {pResult.type === "success" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} {pResult.message}
                </div>
              )}

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

  if (analytics.totalClicks === 0) {
    return (
      <div style={{ animation: "fadeIn .2s ease" }}>
        <div className="rounded-xl p-8 text-center" style={cardStyle}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <div className="text-sm font-semibold mb-1" style={{ color: t.text }}>No clicks yet</div>
          <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Share this link to start tracking analytics</div>
          {(link.signups > 0 || link.orders > 0) && (
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mt-4">
              <div className="rounded-lg p-3" style={cardStyle}>
                <div className="text-lg font-bold" style={{ color: dark ? "#a5b4fc" : "#6366f1" }}>{(link.signups || 0).toLocaleString()}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[1px] mt-0.5" style={{ color: t.textMuted }}>Signups</div>
              </div>
              <div className="rounded-lg p-3" style={cardStyle}>
                <div className="text-lg font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{(link.orders || 0).toLocaleString()}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[1px] mt-0.5" style={{ color: t.textMuted }}>Orders</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const convRate = analytics.totalClicks > 0 ? ((link.signups / analytics.totalClicks) * 100).toFixed(1) : "0";
  const orderRate = link.signups > 0 ? ((link.orders / link.signups) * 100).toFixed(1) : "0";

  const timelineData = range === "24h"
    ? Array.from({ length: 24 }, (_, h) => { const m = analytics.timeline.find(t => t.bucket === h); return m ? m.clicks : 0; })
    : analytics.timeline.map(t => t.clicks);
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
          ["Revenue", fN((link.revenue || 0) / 100), "from this link", dark ? "#fcd34d" : "#d97706"],
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
          <SparkChart data={timelineData} color={t.accent} height={72} />
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

function LinkAccordion({ link, dark, t, baseUrl, copied, copyLink, canManage, handleToggle, handleDelete, handleArchive, onViewAnalytics, last, rowBorder }) {
  const [open, setOpen] = useState(false);
  const hasActivity = (link.clicks || 0) + (link.signups || 0) > 0;
  const statusColor = link.archivedAt ? (dark ? "#fcd34d" : "#d97706") : link.enabled ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626");
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
            {!link.archivedAt && !link.enabled && <span className="text-[10px] py-0.5 px-1.5 rounded-full font-semibold" style={{ background: dark ? "rgba(220,38,38,.1)" : "rgba(220,38,38,.05)", color: dark ? "#fca5a5" : "#dc2626" }}>Off</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: t.textMuted }}>
            {hasActivity ? <><span>{(link.clicks || 0).toLocaleString()} clicks</span><span className="opacity-30">·</span><span>{link.signups || 0} signups</span><span className="opacity-30">·</span><span>{link.orders || 0} orders</span><span className="opacity-30">·</span><span>{fN((link.revenue || 0) / 100)} rev</span></> : <span>No activity yet</span>}
            <span className="opacity-30">·</span>
            <span>{new Date(link.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            {!link.archivedAt && (
              <div role="switch" aria-checked={link.enabled} aria-label={`Toggle ${link.name}`} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(link.id, !link.enabled); } }} onClick={() => handleToggle(link.id, !link.enabled)} className="w-[36px] h-5 rounded-xl relative cursor-pointer shrink-0" style={{ background: link.enabled ? "#c47d8e" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") }}>
                <div className="w-[14px] h-[14px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: link.enabled ? 19 : 3 }} />
              </div>
            )}
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

          <button onClick={(e) => { e.stopPropagation(); onViewAnalytics(link); }} className="w-full py-2 rounded-lg text-[13px] font-semibold border border-solid cursor-pointer transition-all duration-200 hover:-translate-y-px flex items-center justify-center gap-1.5" style={{ background: "transparent", borderColor: t.cardBorder, color: t.accent }}>
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
      .then(d => { setAnalytics(d); setAnalyticsLoading(false); })
      .catch(() => setAnalyticsLoading(false));
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

  const handleToggle = async (id, enabled) => {
    await fetch("/api/admin/acquisition", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, enabled }),
    });
    load();
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
    navigator.clipboard.writeText(`${baseUrl}/go/${slug}`);
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
    const hasActivity = (detailLink.clicks || 0) + (detailLink.signups || 0) > 0;
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
            {hasActivity && (
              <div className="flex items-center gap-3 shrink-0">
                {[
                  [(detailLink.clicks || 0).toLocaleString(), "clicks", t.accent],
                  [detailLink.signups || 0, "signups", dark ? "#a5b4fc" : "#6366f1"],
                  [detailLink.orders || 0, "orders", dark ? "#6ee7b7" : "#059669"],
                ].map(([val, label, color]) => (
                  <div key={label} className="text-right hidden sm:block">
                    <div className="text-[15px] font-bold leading-tight" style={{ color }}>{val}</div>
                    <div className="text-[9px] font-semibold uppercase tracking-[1px]" style={{ color: t.textMuted }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
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
        <div className="adm-title" style={{ color: t.text }}>Tracking Links</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Create tracking links and see who clicks, where they come from, and what they do</div>
        {(displayLinks.length > 0 || archivedCount > 0) && (
          <div className="mt-3">
            <SegPill value={viewFilter} options={[{ value: "active", label: "Active" }, { value: "archived", label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}` }]} onChange={v => { setViewFilter(v); setPage(1); }} dark={dark} t={t} />
          </div>
        )}
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
            <LinkAccordion key={link.id} link={link} dark={dark} t={t} baseUrl={baseUrl} copied={copied} copyLink={copyLink} canManage={canManage} handleToggle={handleToggle} handleDelete={handleDelete} handleArchive={handleArchive} onViewAnalytics={openAnalytics} last={i === paginatedLinks.length - 1} rowBorder={rowBorder} />
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

function IssueSection({ title, icon, count, countColor, dark, t, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const rowBorder = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  return (
    <div className="rounded-xl mb-3 overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 w-full py-3 px-4 border-none cursor-pointer font-[inherit] text-left" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)" }}>
        <span style={{ color: t.accent, opacity: .7 }}>{icon}</span>
        <span className="text-sm font-semibold flex-1" style={{ color: t.text }}>{title}</span>
        {count != null && <span className="text-[11px] font-semibold py-0.5 px-2 rounded-full" style={{ background: countColor?.bg || (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"), color: countColor?.color || t.textMuted }}>{count}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s", shrinkFlex: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && <div style={{ borderTop: `1px solid ${rowBorder}` }}>{children}</div>}
    </div>
  );
}

const PROVIDER_COLORS = { mtp: "#ef4444", jap: "#3b82f6", dao: "#22c55e" };
const PROVIDER_NAMES = { mtp: "MoreThanPanel", jap: "JustAnotherPanel", dao: "DaoSMM" };
const LOW_BALANCE_USD = 10;

export function AdminIssuesPage({ dark, t }) {
  const [issues, setIssues] = useState([]);
  const [balances, setBalances] = useState(null);
  const [priceAlerts, setPriceAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [firingCrons, setFiringCrons] = useState(false);
  const [cronResults, setCronResults] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [resolvedPage, setResolvedPage] = useState(1);
  const resolvedPerPage = 10;
  const toast = useToast();

  const load = () => {
    fetch("/api/admin/issues").then(r => r.json()).then(d => {
      setIssues(d.issues || []);
      setBalances(d.balances || null);
      setPriceAlerts(d.priceAlerts || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (id) => {
    setResolving(id);
    try {
      const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", issueId: id }) });
      const d = await res.json();
      if (res.ok) {
        setIssues(prev => prev.map(i => i.id === id ? { ...i, status: "resolved", resolvedAt: new Date().toISOString() } : i));
        toast.success(d.detail || "Issue resolved");
      } else { toast.error(d.error || "Failed"); }
    } catch { toast.error("Network error"); }
    setResolving(null);
  };

  const handleIgnore = async (id) => {
    setResolving(id);
    try {
      const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ignore", issueId: id }) });
      const d = await res.json();
      if (res.ok) {
        setIssues(prev => prev.map(i => i.id === id ? { ...i, status: "ignored", resolvedAt: new Date().toISOString() } : i));
        toast.success("Issue ignored");
      } else { toast.error(d.error || "Failed"); }
    } catch { toast.error("Network error"); }
    setResolving(null);
  };

  const handleFireCrons = async () => {
    setFiringCrons(true);
    setCronResults(null);
    try {
      const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fire_crons" }) });
      const d = await res.json();
      if (res.ok) {
        setCronResults(d.results || []);
        toast.success("All crons fired");
        setTimeout(() => load(), 2000);
      } else { toast.error(d.error || "Failed to fire crons"); }
    } catch { toast.error("Network error"); }
    setFiringCrons(false);
  };

  const rowBorder = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  const skBone = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;

  const deadServices = issues.filter(i => i.type === "dead_service" && i.status === "open");
  const revivedServices = issues.filter(i => i.type === "revived_service" && i.status === "open");
  const orderFailures = issues.filter(i => i.type === "order_failure" && i.status === "open");
  const lowBalanceIssues = issues.filter(i => i.type === "low_balance" && i.status === "open");
  const priceIssues = issues.filter(i => i.type === "price_alert" && i.status === "open");
  const resolvedIssues = issues.filter(i => i.status === "resolved" || i.status === "ignored");

  const balanceEntries = balances ? Object.entries(balances).filter(([k]) => k !== "checkedAt") : [];
  const losers = priceAlerts?.losers || [];

  const redBadge = { bg: dark ? "rgba(252,165,165,.15)" : "#fef2f2", color: dark ? "#fca5a5" : "#dc2626" };
  const amberBadge = { bg: dark ? "rgba(252,211,77,.15)" : "#fffbeb", color: dark ? "#fcd34d" : "#d97706" };
  const greenBadge = { bg: dark ? "rgba(110,231,183,.15)" : "#ecfdf5", color: dark ? "#6ee7b7" : "#059669" };
  const blueBadge = { bg: dark ? "rgba(165,180,252,.15)" : "#eef2ff", color: dark ? "#a5b4fc" : "#4f46e5" };

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Platform Issues</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div><div>{[1,2,3,4,5].map(i => <div key={i} className={`${skBone} h-[48px] rounded-xl mb-3`} />)}</div></>;

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Platform Issues</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Provider health, service status, and cron management</div>
          </div>
          <button onClick={handleFireCrons} disabled={firingCrons} className="flex items-center gap-2 py-2 px-4 rounded-xl border-none text-sm font-semibold cursor-pointer font-[inherit] transition-all duration-200 shrink-0" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: firingCrons ? .6 : 1 }}>
            {firingCrons ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="40 60" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
            {firingCrons ? "Firing..." : "Fire All Crons"}
          </button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ CRON RESULTS ═══ */}
      <IssueSection title="Cron Results" defaultOpen={!!cronResults} dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        count={cronResults ? `${cronResults.filter(r => r.ok).length}/${cronResults.length}` : null}
        countColor={cronResults?.every(r => r.ok) ? greenBadge : amberBadge}
      >
        {cronResults ? cronResults.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 px-4" style={{ borderBottom: i < cronResults.length - 1 ? `1px solid ${rowBorder}` : "none" }}>
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: r.ok ? t.green : t.red }} />
            <span className="text-[13px] font-mono flex-1 min-w-0" style={{ color: t.text }}>{r.cron.replace('/api/cron/', '')}</span>
            <span className="text-[12px] font-medium shrink-0" style={{ color: r.ok ? t.green : t.red }}>{r.ok ? "OK" : r.error || "Failed"}</span>
          </div>
        )) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>Click "Fire All Crons" to run all cron jobs and see results here</div>
        )}
      </IssueSection>

      {/* ═══ PROVIDER BALANCES ═══ */}
      <IssueSection title="Provider Balances" defaultOpen={true} dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        count={balanceEntries.filter(([, v]) => typeof v === 'object' && v.balance < LOW_BALANCE_USD).length > 0 ? `${balanceEntries.filter(([, v]) => typeof v === 'object' && v.balance < LOW_BALANCE_USD).length} low` : null}
        countColor={redBadge}
      >
        {balanceEntries.length > 0 ? (
          <div className="p-4">
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(balanceEntries.length, 3)}, 1fr)` }}>
              {balanceEntries.map(([pid, data]) => {
                const isLow = typeof data === 'object' && data.balance < LOW_BALANCE_USD;
                const color = PROVIDER_COLORS[pid] || t.accent;
                return (
                  <div key={pid} className="py-3 px-4 rounded-xl" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: isLow ? `1px solid ${dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.2)"}` : `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
                      <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>{PROVIDER_NAMES[pid] || pid}</span>
                    </div>
                    {typeof data === 'object' && data.balance != null ? (
                      <div className="text-lg font-semibold" style={{ color: isLow ? t.red : t.green }}>${data.balance.toFixed(2)}</div>
                    ) : (
                      <div className="text-sm" style={{ color: t.textMuted }}>{data?.status || "—"}</div>
                    )}
                    {isLow && <div className="text-[11px] mt-1 font-medium" style={{ color: t.red }}>Below ${LOW_BALANCE_USD} threshold</div>}
                  </div>
                );
              })}
            </div>
            {balances?.checkedAt && <div className="text-[11px] mt-2.5" style={{ color: t.textMuted }}>Last checked {fD(balances.checkedAt)}</div>}
          </div>
        ) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>Balance data not available yet — run the balance cron</div>
        )}
        {lowBalanceIssues.length > 0 && (
          <div style={{ borderTop: `1px solid ${rowBorder}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide py-2 px-4" style={{ color: t.red }}>Open Issues</div>
            {lowBalanceIssues.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} i={i} total={lowBalanceIssues.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
            ))}
          </div>
        )}
      </IssueSection>

      {/* ═══ PRICE ALERTS ═══ */}
      <IssueSection title="Price Alerts" dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        count={losers.length > 0 ? `${losers.length} below cost` : null}
        countColor={redBadge}
        defaultOpen={losers.length > 0}
      >
        {losers.length > 0 ? (
          <>
            {losers.map((l, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-4" style={{ borderBottom: i < losers.length - 1 ? `1px solid ${rowBorder}` : "none" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={{ color: t.text }}>{l.service}</div>
                  <div className="text-[11px]" style={{ color: t.textMuted }}>{l.category}{l.tier ? ` · ${l.tier}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px]" style={{ color: t.textMuted }}>Cost <span className="font-semibold" style={{ color: t.text }}>₦{(l.costNaira || 0).toLocaleString()}</span></div>
                  <div className="text-[12px]" style={{ color: t.red }}>Sell <span className="font-semibold">₦{(l.sellNaira || 0).toLocaleString()}</span> <span className="text-[11px]">(−₦{(l.lossPerK || 0).toLocaleString()}/1K)</span></div>
                </div>
              </div>
            ))}
            {priceAlerts?.checkedAt && <div className="text-[11px] py-2 px-4" style={{ color: t.textMuted }}>Last synced {fD(priceAlerts.checkedAt)} · Rate ₦{priceAlerts.usdRate || "?"}/USD</div>}
          </>
        ) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>
            {priceAlerts?.checkedAt ? <>All services priced above cost <span style={{ color: t.textMuted }}>· checked {fD(priceAlerts.checkedAt)}</span></> : "Price data not available yet — run the prices cron"}
          </div>
        )}
        {priceIssues.length > 0 && (
          <div style={{ borderTop: `1px solid ${rowBorder}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide py-2 px-4" style={{ color: t.red }}>Open Issues</div>
            {priceIssues.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} i={i} total={priceIssues.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
            ))}
          </div>
        )}
      </IssueSection>

      {/* ═══ DEAD SERVICES ═══ */}
      <IssueSection title="Dead Services" dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        count={deadServices.length > 0 ? deadServices.length : null}
        countColor={redBadge}
        defaultOpen={deadServices.length > 0}
      >
        {deadServices.length > 0 ? deadServices.map((issue, i) => (
          <IssueRow key={issue.id} issue={issue} i={i} total={deadServices.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
        )) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>No dead services detected</div>
        )}
      </IssueSection>

      {/* ═══ REVIVED SERVICES ═══ */}
      <IssueSection title="Revived Services" dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>}
        count={revivedServices.length > 0 ? revivedServices.length : null}
        countColor={blueBadge}
        defaultOpen={revivedServices.length > 0}
      >
        {revivedServices.length > 0 ? revivedServices.map((issue, i) => (
          <IssueRow key={issue.id} issue={issue} i={i} total={revivedServices.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
        )) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>No revived services</div>
        )}
      </IssueSection>

      {/* ═══ ORDER FAILURES ═══ */}
      <IssueSection title="Order Failures" dark={dark} t={t}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>}
        count={orderFailures.length > 0 ? orderFailures.length : null}
        countColor={amberBadge}
        defaultOpen={orderFailures.length > 0}
      >
        {orderFailures.length > 0 ? orderFailures.map((issue, i) => (
          <IssueRow key={issue.id} issue={issue} i={i} total={orderFailures.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
        )) : (
          <div className="py-4 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>No order failures</div>
        )}
      </IssueSection>

      {/* ═══ RESOLVED ═══ */}
      {resolvedIssues.length > 0 && (() => {
        const totalResolvedPages = Math.ceil(resolvedIssues.length / resolvedPerPage);
        const pagedResolved = resolvedIssues.slice((resolvedPage - 1) * resolvedPerPage, resolvedPage * resolvedPerPage);
        return (
          <IssueSection title="Resolved & Ignored" dark={dark} t={t}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            count={resolvedIssues.length}
            countColor={greenBadge}
          >
            {pagedResolved.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} i={i} total={pagedResolved.length} dark={dark} t={t} rowBorder={rowBorder} expanded={expandedIssue} setExpanded={setExpandedIssue} resolving={resolving} onResolve={handleResolve} onIgnore={handleIgnore} />
            ))}
            {totalResolvedPages > 1 && (
              <div className="flex items-center justify-between py-2.5 px-4" style={{ borderTop: `1px solid ${rowBorder}` }}>
                <span className="text-[12px]" style={{ color: t.textMuted }}>{resolvedIssues.length} resolved</span>
                <div className="flex gap-1">
                  <button onClick={() => setResolvedPage(p => Math.max(1, p - 1))} disabled={resolvedPage <= 1} className="w-[26px] h-[26px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: resolvedPage <= 1 ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="text-[12px] flex items-center px-1.5" style={{ color: t.textMuted }}>{resolvedPage}/{totalResolvedPages}</span>
                  <button onClick={() => setResolvedPage(p => Math.min(totalResolvedPages, p + 1))} disabled={resolvedPage >= totalResolvedPages} className="w-[26px] h-[26px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: resolvedPage >= totalResolvedPages ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            )}
          </IssueSection>
        );
      })()}
    </>
  );
}

function IssueRow({ issue, i, total, dark, t, rowBorder, expanded, setExpanded, resolving, onResolve, onIgnore }) {
  const isExpanded = expanded === issue.id;
  let meta = null;
  try { meta = issue.metadata ? JSON.parse(issue.metadata) : null; } catch {}
  return (
    <div style={{ borderBottom: i < total - 1 ? `1px solid ${rowBorder}` : "none" }}>
      <div className="flex items-center gap-3 py-2.5 px-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : issue.id)}>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium" style={{ color: t.text }}>{issue.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{fD(issue.createdAt)}</div>
        </div>
        {issue.status === "open" ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onIgnore(issue.id); }} disabled={resolving === issue.id} className="text-[11px] font-medium py-1 px-2.5 rounded-lg border-none cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted, opacity: resolving === issue.id ? .5 : 1 }}>
              Ignore
            </button>
            <button onClick={(e) => { e.stopPropagation(); onResolve(issue.id); }} disabled={resolving === issue.id} className="text-[11px] font-semibold py-1 px-2.5 rounded-lg border-none cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(110,231,183,.12)" : "#ecfdf5", color: t.green, opacity: resolving === issue.id ? .5 : 1 }}>
              {resolving === issue.id ? "..." : "Resolve"}
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-semibold py-0.5 px-2 rounded-[5px] shrink-0" style={{ background: issue.status === "ignored" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : (dark ? "rgba(110,231,183,.08)" : "#ecfdf5"), color: issue.status === "ignored" ? t.textMuted : t.green }}>{issue.status === "ignored" ? "Ignored" : "Resolved"}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {isExpanded && (
        <div className="py-2.5 px-4 text-[13px] leading-relaxed" style={{ background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)", color: t.textMuted, borderTop: `1px solid ${rowBorder}` }}>
          <div className="mb-2 whitespace-pre-line">{issue.message}</div>
          {meta && (
            <div className="font-mono text-[12px] p-2.5 rounded-lg mt-2" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
              {Object.entries(meta).filter(([k]) => !['losers', 'services', 'providers'].includes(k)).map(([k, v]) => (
                <div key={k}><span style={{ color: t.accent }}>{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              ))}
            </div>
          )}
          {issue.resolvedBy && <div className="mt-2 text-[12px]">{issue.status === "ignored" ? "Ignored" : "Resolved"} by <strong style={{ color: t.text }}>{issue.resolvedBy}</strong> on {fD(issue.resolvedAt)}</div>}
        </div>
      )}
    </div>
  );
}
