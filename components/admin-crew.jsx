"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const CHEV = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="6 9 12 15 18 9"/></svg>;
const DD_CHEV = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;

/* ── Member Row (click opens drawer) ── */
function MemberRow({ m, dark, t, hair, onOpenDrawer }) {
  const isChief = m.role === "chief";
  const isPending = m.status === "pending";
  const isSuspended = m.status === "suspended";

  return (
    <div
      className="grid items-center gap-[14px] px-[18px] min-h-[60px] cursor-pointer transition-colors hover:bg-[rgba(196,125,142,.04)]"
      style={{ gridTemplateColumns: "minmax(0,1fr) 96px 64px 110px 38px", borderTop: `1px solid ${hair}` }}
      onClick={() => onOpenDrawer(m)}
    >
      {/* Member cell */}
      <div className="flex items-center gap-[11px] min-w-0 py-2">
        <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[11.5px] font-bold text-white shrink-0" style={{ background: isChief ? "linear-gradient(135deg,#c47d8e,#a3586b)" : "linear-gradient(135deg,#7384c9,#5566b8)" }}>
          {initials(m.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold truncate" style={{ color: t.text }}>{m.name}</span>
            {isPending && <span className="text-[9.5px] font-bold tracking-[.4px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: "#b45309", background: dark ? "rgba(217,119,6,.15)" : "rgba(217,119,6,.1)" }}>Pending</span>}
            {isSuspended && <span className="text-[9.5px] font-bold tracking-[.4px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: "#dc2626", background: dark ? "rgba(220,38,38,.12)" : "rgba(220,38,38,.08)" }}>Suspended</span>}
          </div>
          <div className="text-[11.5px] truncate mt-[1px]" style={{ color: t.textMuted }}>{m.email}</div>
        </div>
      </div>
      {/* Role */}
      <div className="max-md:hidden"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: isChief ? t.accent : "#5566b8", background: isChief ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.1)") : (dark ? "rgba(85,102,184,.15)" : "rgba(85,102,184,.11)") }}>{m.role}</span></div>
      {/* Base */}
      <div className="m text-[13px] max-md:hidden" style={{ color: t.textSoft }}>{m.commissionRate}%</div>
      {/* Earned */}
      <div className="m text-[14px] font-semibold text-right" style={{ color: (m.totalEarned || 0) > 0 ? (dark ? "#6ee7b7" : "#059669") : t.text }}>{fN(m.totalEarned || 0)}</div>
      {/* Three dots */}
      <div className="justify-self-end" style={{ color: t.textMuted }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </div>
    </div>
  );
}

/* ── Settings helpers ── */
function SettingRow({ label, hint, hair, t, children }) {
  return (
    <div className="flex items-center gap-4 py-[14px] px-[18px]" style={{ borderTop: `1px solid ${hair}` }}>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>{label}</div>
        {hint && <div className="text-[11.5px] mt-[3px] leading-[1.4]" style={{ color: t.textMuted }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingField({ k, unit, pre, disabled, val, dark, t, tierCfg, setTierCfg }) {
  const fieldBg = dark ? "rgba(255,255,255,.07)" : "#fff";
  const fieldBd = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  const lockedBg = dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)";
  return (
    <div className="flex items-center rounded-[9px] px-[11px] w-[132px] shrink-0" style={{ background: disabled ? lockedBg : fieldBg, border: `1px solid ${fieldBd}`, opacity: disabled ? 0.65 : 1 }}>
      {pre && <span className="text-[13px]" style={{ color: t.textMuted }}>{pre}</span>}
      <input type="number" min="0" value={val !== undefined ? val : (tierCfg[k] || "")} disabled={disabled} onChange={k ? e => setTierCfg(p => ({ ...p, [k]: e.target.value })) : undefined} className="m flex-1 text-[14.5px] font-semibold py-[9px] px-1 bg-transparent border-none outline-none w-full" style={{ color: t.text }} />
      {unit && <span className="text-[13px] pl-[2px]" style={{ color: t.textMuted }}>{unit}</span>}
    </div>
  );
}

/* ── Main Page ── */
export function AdminCrewPage({ dark, t }) {
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("team");
  const [busy, setBusy] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [refInput, setRefInput] = useState({});
  const [tierCfg, setTierCfg] = useState({ affiliate_enabled: "true", affiliate_starter_rate: "30", affiliate_growth_rate: "40", affiliate_pro_rate: "50", affiliate_growth_threshold: "50", affiliate_pro_threshold: "150", affiliate_lead_split: "40", affiliate_hold_days: "7", affiliate_min_payout: "5000", affiliate_min_order: "1000", affiliate_max_links: "5" });
  const [tierCfgLoading, setTierCfgLoading] = useState(false);
  const [tierCfgSaving, setTierCfgSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(true);
  const [moneyIssues, setMoneyIssues] = useState([]);
  const [drawerMember, setDrawerMember] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [showPromoteForm, setShowPromoteForm] = useState(false);
  const [promoteTeamName, setPromoteTeamName] = useState("");
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/crew");
      const d = await res.json();
      if (d.error) return null;
      setMembers(d.members || []);
      setStats(d.stats || {});
      if (d.affiliateEnabled !== undefined) setAffiliateEnabled(d.affiliateEnabled);
      if (d.moneyIssues) setMoneyIssues(d.moneyIssues);
      return d.members || [];
    } catch { return null; } finally { setLoading(false); }
  }, []);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch("/api/admin/crew/payouts");
      const d = await res.json();
      if (!d.error) setPayouts(d.payouts || []);
    } catch {} finally { setPayoutsLoading(false); }
  }, []);

  const loadTierCfg = useCallback(async () => {
    setTierCfgLoading(true);
    try {
      const res = await fetch("/api/admin/settings?keys=affiliate_enabled,affiliate_starter_rate,affiliate_growth_rate,affiliate_pro_rate,affiliate_growth_threshold,affiliate_pro_threshold,affiliate_lead_split,affiliate_hold_days,affiliate_min_payout,affiliate_min_order,affiliate_max_links");
      const d = await res.json();
      if (d.settings) setTierCfg(prev => ({ ...prev, ...d.settings }));
    } catch {} finally { setTierCfgLoading(false); }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch("/api/admin/crew?view=activity");
      const d = await res.json();
      setActivityLogs(d.logs || []);
    } catch {} finally { setActivityLoading(false); }
  }, []);

  const saveTierCfg = async () => {
    setTierCfgSaving(true);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: tierCfg }) });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success("Tier settings saved");
    } catch { toast.error("Something went wrong"); } finally { setTierCfgSaving(false); }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "payouts" && payouts.length === 0) loadPayouts(); }, [tab, loadPayouts, payouts.length]);
  useEffect(() => { if (tab === "settings") loadTierCfg(); }, [tab, loadTierCfg]);
  useEffect(() => { if (tab === "activity") loadActivity(); }, [tab, loadActivity]);

  useEffect(() => {
    if (!drawerMember) return;
    const onKey = (e) => { if (e.key === "Escape") setDrawerMember(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerMember]);

  const act = async (action, memberId, extra = {}) => {
    const CONFIRMS = {
      approve: { title: "Approve Member", message: "Approve this member?", confirmLabel: "Approve" },
      reject: { title: "Reject Member", message: "Reject this member? They'll receive a notification email.", confirmLabel: "Reject", danger: true },
      suspend: { title: "Suspend Member", message: "Suspend this member? They will lose access.", confirmLabel: "Suspend", danger: true },
      reinstate: { title: "Reinstate Member", message: "Reinstate this member?", confirmLabel: "Reinstate" },
      "promote-chief": { title: "Promote to Chief", message: "Promote to chief? They'll be able to manage a team.", confirmLabel: "Promote" },
      "demote-crew": { title: "Demote to Crew", message: "Demote back to crew member?", confirmLabel: "Demote", danger: true },
      delete: { title: "Delete Member", message: "Delete this member? Records will be kept.", confirmLabel: "Delete", danger: true },
    };
    const cfg = CONFIRMS[action];
    if (cfg) {
      const ok = await confirm(cfg);
      if (!ok) return;
    }
    setBusy(memberId);
    try {
      const res = await fetch("/api/admin/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId, ...extra }) });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(action === "approve" ? "Approved" : action === "reject" ? "Rejected" : action === "suspend" ? "Suspended" : action === "reinstate" ? "Reinstated" : action === "update-tier" ? "Tier updated" : action === "promote-chief" ? "Promoted" : action === "demote-crew" ? "Demoted" : action === "assign-team" ? "Assigned" : action === "move-team" ? "Moved" : action === "unassign-team" ? "Removed from team" : action === "delete" ? "Deleted" : "Done");
      await load();
    } catch { toast.error("Something went wrong"); } finally { setBusy(null); }
  };

  const payoutAct = async (action, payoutId) => {
    setBusy(payoutId);
    try {
      const res = await fetch("/api/admin/crew/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payoutId, reference: refInput[payoutId] || "" }) });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(action === "complete" ? "Payout completed" : action === "reject" ? "Payout rejected" : "Updated");
      await loadPayouts();
      await load();
    } catch { toast.error("Something went wrong"); } finally { setBusy(null); }
  };

  const pendingCount = members.filter(m => m.status === "pending").length;
  const pendingPayoutCount = payouts.filter(p => p.status === "pending").length;

  const filtered = useMemo(() => {
    let list = members;
    if (filter !== "all") list = list.filter(m => m.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.xHandle || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "joined") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "earned") return (b.totalEarned || 0) - (a.totalEarned || 0);
      return 0;
    });
  }, [members, filter, query, sort]);

  const teamGroups = useMemo(() => {
    const approved = filtered.filter(m => m.status !== "pending");
    const groups = [];
    const teamChiefs = approved.filter(m => m.role === "chief");
    for (const chief of teamChiefs) {
      const crew = approved.filter(m => m.role !== "chief" && m.leadId === chief.id);
      const totalEarned = [chief, ...crew].reduce((s, m) => s + (m.totalEarned || 0), 0);
      groups.push({ chief, crew, totalEarned });
    }
    const unassigned = approved.filter(m => m.role !== "chief" && !m.leadId);
    return { groups, unassigned };
  }, [filtered]);

  const PAYOUT_COLORS = { pending: "#F59E0B", processing: "#3B82F6", completed: "#059669", rejected: "#EF4444" };
  const filteredPayouts = payoutFilter === "all" ? payouts : payouts.filter(p => p.status === payoutFilter);
  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
  const cardBd = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;
  const hair = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const shadow = dark ? "none" : "0 1px 2px rgba(0,0,0,.035),0 5px 14px rgba(0,0,0,.04)";

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
  const closeDrawer = () => { setDrawerMember(null); setShowArchived(false); setShowTeamPicker(false); setTeamSearch(""); setShowPromoteForm(false); setPromoteTeamName(""); setEditingTeamName(false); setEditTeamName(""); };

  const renderRow = (m) => (
    <MemberRow key={m.id} m={m} dark={dark} t={t} hair={hair} onOpenDrawer={setDrawerMember} />
  );

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pit Crew</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage your crew, chiefs, tiers, and payouts</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Status banner */}
      {(!affiliateEnabled || moneyIssues.length > 0) && (
        <div className="flex flex-col gap-2 mb-4">
          {!affiliateEnabled && (
            <div className="flex items-center gap-[10px] py-[11px] px-[16px] rounded-[12px]" style={{ background: dark ? "rgba(217,119,6,.12)" : "rgba(217,119,6,.06)", border: `1px solid ${dark ? "rgba(217,119,6,.25)" : "rgba(217,119,6,.18)"}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-[13px] font-semibold" style={{ color: dark ? "#fbbf24" : "#b45309" }}>Affiliate program paused</span>
              <span className="text-[12px]" style={{ color: dark ? "rgba(251,191,36,.7)" : "rgba(180,83,9,.6)" }}>No new commissions are being created. Re-enable in Settings.</span>
            </div>
          )}
          {moneyIssues.length > 0 && (
            <div className="flex items-center gap-[10px] py-[11px] px-[16px] rounded-[12px]" style={{ background: dark ? "rgba(220,38,38,.1)" : "rgba(220,38,38,.04)", border: `1px solid ${dark ? "rgba(220,38,38,.22)" : "rgba(220,38,38,.14)"}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-[13px] font-semibold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{moneyIssues.length} open money-path issue{moneyIssues.length !== 1 ? "s" : ""}</span>
              <span className="text-[12px]" style={{ color: dark ? "rgba(252,165,165,.7)" : "rgba(220,38,38,.6)" }}>{moneyIssues.map(i => i.title).join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
        {[["members", "Members"], ["payouts", "Payouts"], ["activity", "Activity"], ["settings", "Settings"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="py-2 px-4 rounded-[9px] text-[13.5px] font-semibold border-none cursor-pointer" style={{ background: tab === id ? (dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.15)") : "transparent", color: tab === id ? t.accent : t.textMuted, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ MEMBERS TAB ═══ */}
      {tab === "members" && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-3">
            {[
              ["Members", members.length],
              ["Pending", pendingCount, pendingCount > 0],
              ["Paid out", fN(stats.totalPaidOut || 0)],
              ["Held", fN(stats.heldAmount || 0)],
            ].map(([label, val, warn]) => (
              <div key={label} className="py-[15px] px-[17px] rounded-[14px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="m text-[25px] font-semibold leading-none" style={{ color: warn ? "#b45309" : t.text }}>{val}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[.6px] mt-2" style={{ color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-[10px] flex-wrap mb-4">
            <label className="flex items-center gap-[9px] flex-1 min-w-[200px] max-sm:flex-[100%] max-sm:order-[-1] px-[13px] rounded-[11px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members" className="border-none bg-transparent outline-none text-[14px] py-[11px] w-full" style={{ color: t.text, fontFamily: "inherit" }} />
            </label>
            <div className="relative flex items-center rounded-[11px] px-[13px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <select value={view} onChange={e => setView(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[11px] pr-[22px] cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="team">By team</option>
                <option value="flat">All members</option>
              </select>
              <span className="absolute right-[11px] pointer-events-none" style={{ color: t.textMuted }}>{DD_CHEV}</span>
            </div>
            <div className="relative flex items-center rounded-[11px] px-[13px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[11px] pr-[22px] cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
              <span className="absolute right-[11px] pointer-events-none" style={{ color: t.textMuted }}>{DD_CHEV}</span>
            </div>
            <div className="relative flex items-center rounded-[11px] px-[13px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <select value={sort} onChange={e => setSort(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[11px] pr-[22px] cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="name">Name</option>
                <option value="joined">Joined</option>
                <option value="earned">Earnings</option>
              </select>
              <span className="absolute right-[11px] pointer-events-none" style={{ color: t.textMuted }}>{DD_CHEV}</span>
            </div>
          </div>

          <div className="text-[12.5px] font-medium mb-3 mx-0.5" style={{ color: t.textMuted }}>
            {filtered.length} member{filtered.length !== 1 ? "s" : ""}{view === "team" ? ` across ${teamGroups.groups.length} team${teamGroups.groups.length !== 1 ? "s" : ""}` : ""}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: t.textMuted }}>Loading crew...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[14px] py-16 flex flex-col items-center gap-3" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="text-[13px] font-medium" style={{ color: t.textMuted }}>No members found</div>
            </div>
          ) : view === "team" ? (
            <div className="flex flex-col gap-4">
              {teamGroups.groups.map(({ chief, crew, totalEarned }) => (
                <div key={chief.id} className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                  {/* Team header */}
                  <div className="flex items-center gap-[9px] px-[18px] py-[11px] text-[12.5px] font-semibold" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}`, color: t.textSoft }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                    {chief.teamName || `${chief.name}'s team`}
                    <div className="ml-auto flex gap-2">
                      <span className="m text-[11.5px] font-medium py-[3px] px-[9px] rounded-md" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted }}>{crew.length} crew</span>
                      <span className="m text-[11.5px] font-medium py-[3px] px-[9px] rounded-md" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted }}>{fN(totalEarned)}</span>
                    </div>
                  </div>
                  {renderRow(chief)}
                  {crew.map(renderRow)}
                </div>
              ))}
              {teamGroups.unassigned.length > 0 && (
                <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                  <div className="flex items-center gap-[9px] px-[18px] py-[11px] text-[12.5px] font-semibold" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}`, color: t.textSoft }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    Unassigned
                    <span className="ml-auto m text-[11.5px] font-medium py-[3px] px-[9px] rounded-md" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted }}>{teamGroups.unassigned.length}</span>
                  </div>
                  {teamGroups.unassigned.map(renderRow)}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              {/* Header */}
              <div className="grid items-center gap-[14px] px-[18px] h-[42px]" style={{ gridTemplateColumns: "minmax(0,1fr) 96px 64px 110px 38px", background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}` }}>
                <span className="text-[10.5px] font-bold tracking-[.6px] uppercase" style={{ color: t.textMuted }}>Member</span>
                <span className="text-[10.5px] font-bold tracking-[.6px] uppercase max-md:hidden" style={{ color: t.textMuted }}>Role</span>
                <span className="text-[10.5px] font-bold tracking-[.6px] uppercase max-md:hidden" style={{ color: t.textMuted }}>Base</span>
                <span className="text-[10.5px] font-bold tracking-[.6px] uppercase text-right" style={{ color: t.textMuted }}>Earned</span>
                <span />
              </div>
              {filtered.map(renderRow)}
            </div>
          )}
        </>
      )}

      {/* ═══ PAYOUTS TAB ═══ */}
      {tab === "payouts" && (
        <>
          <div className="flex justify-end mb-4">
            <div className="relative flex items-center rounded-[11px] px-[13px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
              <select value={payoutFilter} onChange={e => setPayoutFilter(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[11px] pr-[22px] cursor-pointer capitalize" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="all">All</option>
                <option value="pending">Pending{pendingPayoutCount > 0 ? ` (${pendingPayoutCount})` : ""}</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
              <span className="absolute right-[11px] pointer-events-none" style={{ color: t.textMuted }}>{DD_CHEV}</span>
            </div>
          </div>
          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
            {filteredPayouts.length === 0 ? (
              <div className="py-10 text-center text-[14px]" style={{ color: t.textMuted }}>No payout requests right now.</div>
            ) : filteredPayouts.map((p, i) => {
              const expanded = expandedId === p.id;
              const statusColor = PAYOUT_COLORS[p.status] || "#6B7280";
              return (
                <div key={p.id}>
                  <div className="py-3.5 px-[18px] flex items-center gap-3 cursor-pointer hover:bg-[rgba(196,125,142,.03)] transition-colors" style={{ borderBottom: (i < filteredPayouts.length - 1 || expanded) ? `1px solid ${hair}` : "none" }} onClick={() => setExpandedId(expanded ? null : p.id)}>
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: `${statusColor}18`, color: statusColor }}>{initials(p.memberName)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-[13.5px] font-semibold" style={{ color: t.text }}>{p.memberName}</span><span className="text-[10.5px] py-[1px] px-[6px] rounded-full font-medium capitalize" style={{ background: `${statusColor}18`, color: statusColor }}>{p.status}</span></div>
                      <div className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{p.memberEmail} · {fD(p.createdAt)}</div>
                    </div>
                    <div className="m text-[15px] font-bold shrink-0" style={{ color: t.text }}>{fN(p.amount)}</div>
                    <div style={{ color: t.textMuted, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}>{CHEV}</div>
                  </div>
                  {expanded && (
                    <div className="px-[18px] py-4 flex flex-col gap-3.5" style={{ background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)", borderBottom: `1px solid ${hair}` }}>
                      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-2.5">
                        {[["Bank", p.bankName || "Not set"], ["Account No.", p.bankAccountNo || "Not set"], ["Account Name", p.bankAccountName || "Not set"]].map(([l, v]) => (
                          <div key={l} className="py-2.5 px-3 rounded-xl" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }}>
                            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: t.textMuted }}>{l}</div>
                            <div className="text-[13px] font-bold mt-1" style={{ color: t.text }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {p.reference && <div className="text-[12px]" style={{ color: t.textMuted }}>Reference: <span style={{ color: t.text }}>{p.reference}</span></div>}
                      {(p.status === "pending" || p.status === "processing") && (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <input value={refInput[p.id] || ""} onChange={e => setRefInput(prev => ({ ...prev, [p.id]: e.target.value }))} onClick={e => e.stopPropagation()} placeholder="Transfer reference (optional)" className="py-1.5 px-2.5 rounded-lg text-[12.5px] bg-transparent outline-none flex-1 min-w-[180px]" style={{ color: t.text, border: `1px solid ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)"}`, fontFamily: "inherit" }} />
                          {p.status === "pending" && <button disabled={busy === p.id} onClick={e => { e.stopPropagation(); payoutAct("process", p.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(96,165,250,.3)" : "rgba(59,130,246,.25)", color: dark ? "#93c5fd" : "#2563eb" }}>Processing</button>}
                          <button disabled={busy === p.id} onClick={e => { e.stopPropagation(); payoutAct("complete", p.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(110,231,183,.3)" : "rgba(5,150,105,.25)", color: dark ? "#6ee7b7" : "#059669" }}>Complete</button>
                          <button disabled={busy === p.id} onClick={e => { e.stopPropagation(); payoutAct("reject", p.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>Reject</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ ACTIVITY TAB ═══ */}
      {tab === "activity" && (
        <>
          <div className="text-[12.5px] font-medium mb-3 mx-0.5" style={{ color: t.textMuted }}>Recent admin activity</div>
          <div className="rounded-[14px] overflow-hidden p-[4px_18px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
            {activityLogs.length === 0 ? (
              <div className="py-10 text-center text-[14px]" style={{ color: t.textMuted }}>No activity yet.</div>
            ) : activityLogs.map((log, i) => (
              <div key={log.id} className="flex items-start gap-3 py-[13px]" style={{ borderTop: i > 0 ? `1px solid ${hair}` : "none" }}>
                <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 mt-px" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]" style={{ color: t.text }}>{log.action}</div>
                  <div className="text-[11.5px] mt-[2px]" style={{ color: t.textMuted }}>{log.adminName} · {fD(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {tab === "settings" && (
        <div className="flex flex-col gap-[14px] max-w-[620px]">
          {tierCfgLoading ? null : (
            <>
              {/* Master switch */}
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="flex items-center gap-4 py-[14px] px-[18px]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>Pit Crew program</div>
                    <div className="text-[11.5px] mt-[3px] leading-[1.4]" style={{ color: t.textMuted }}>Master switch. When off, the apply page is hidden and no new commissions are created.</div>
                  </div>
                  <button onClick={() => setTierCfg(p => ({ ...p, affiliate_enabled: p.affiliate_enabled === "true" ? "false" : "true" }))} className="relative w-[44px] h-[24px] rounded-[12px] border-none cursor-pointer shrink-0" style={{ background: tierCfg.affiliate_enabled === "true" ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)") }}>
                    <span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm" style={{ left: tierCfg.affiliate_enabled === "true" ? 23 : 3, transition: "left .25s" }} />
                  </button>
                </div>
              </div>

              {/* Commission tiers */}
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-4 px-[18px] pb-[14px]" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}` }}>
                  <div className="text-[14px] font-bold" style={{ color: t.text }}>Commission tiers</div>
                  <div className="text-[12.5px] mt-[3px] leading-[1.5]" style={{ color: t.textMuted }}>The commission pot for each crew tier, as a % of every completed order.</div>
                </div>
                <SettingRow label="Starter" hint="0 to 49 active referred users" hair={hair} t={t}><SettingField k="affiliate_starter_rate" unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Growth" hint="50 to 149 active referred users" hair={hair} t={t}><SettingField k="affiliate_growth_rate" unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Pro" hint="150+ active referred users" hair={hair} t={t}><SettingField k="affiliate_pro_rate" unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Chiefs' base rate" hint="Chiefs always earn the top tier, set automatically." hair={hair} t={t}><SettingField disabled val={tierCfg.affiliate_pro_rate || "50"} unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
              </div>

              {/* Team split */}
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-4 px-[18px] pb-[14px]" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}` }}>
                  <div className="text-[14px] font-bold" style={{ color: t.text }}>Team split</div>
                  <div className="text-[12.5px] mt-[3px] leading-[1.5]" style={{ color: t.textMuted }}>When a chief assigns a link to a crew member, how the pot divides between them.</div>
                </div>
                <SettingRow label="Chief's cut" hint="The chief's share of the pot on their crew's sales." hair={hair} t={t}><SettingField k="affiliate_lead_split" unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Crew's cut" hint="The rest of the pot, derived automatically." hair={hair} t={t}><SettingField disabled val={100 - (parseInt(tierCfg.affiliate_lead_split) || 40)} unit="%" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
              </div>

              {/* Tier thresholds */}
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-4 px-[18px] pb-[14px]" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}` }}>
                  <div className="text-[14px] font-bold" style={{ color: t.text }}>Tier thresholds</div>
                  <div className="text-[12.5px] mt-[3px] leading-[1.5]" style={{ color: t.textMuted }}>Active referred users (1+ completed order in the last 30 days) needed to reach each tier.</div>
                </div>
                <SettingRow label="Growth threshold" hint="Active users to move from Starter to Growth." hair={hair} t={t}><SettingField k="affiliate_growth_threshold" unit="users" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Pro threshold" hint="Active users to move from Growth to Pro." hair={hair} t={t}><SettingField k="affiliate_pro_threshold" unit="users" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
              </div>

              {/* Payouts & limits */}
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-4 px-[18px] pb-[14px]" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${hair}` }}>
                  <div className="text-[14px] font-bold" style={{ color: t.text }}>Payouts & limits</div>
                  <div className="text-[12.5px] mt-[3px] leading-[1.5]" style={{ color: t.textMuted }}>Holds, minimums and caps for the whole program.</div>
                </div>
                <SettingRow label="Hold period" hint="Days a commission is held after an order completes, before it's payable." hair={hair} t={t}><SettingField k="affiliate_hold_days" unit="days" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Minimum payout" hint="Smallest amount a member can request." hair={hair} t={t}><SettingField k="affiliate_min_payout" pre="₦" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Minimum order to earn" hint="Orders below this earn no commission." hair={hair} t={t}><SettingField k="affiliate_min_order" pre="₦" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
                <SettingRow label="Max links per chief" hint="How many tracking links a chief can create." hair={hair} t={t}><SettingField k="affiliate_max_links" unit="links" dark={dark} t={t} tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
              </div>

              {/* Save */}
              <div className="flex justify-end mt-[6px]">
                <button onClick={saveTierCfg} disabled={tierCfgSaving} className="py-[11px] px-5 rounded-[11px] text-[13.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)", boxShadow: "0 4px 14px rgba(196,125,142,.28)", fontFamily: "inherit" }}>
                  {tierCfgSaving ? "Saving..." : "Save settings"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MEMBER DRAWER ═══ */}
      {drawerMember && (() => {
        const dm = drawerMember;
        const isChief = dm.role === "chief";
        const isPending = dm.status === "pending";
        const isSuspended = dm.status === "suspended";
        const whatsappUrl = dm.phone ? `https://wa.me/${dm.phone.replace(/\D/g, "")}` : null;
        const chiefs = members.filter(m => m.role === "chief" && m.status === "approved");
        const currentChief = dm.leadId ? chiefs.find(c => c.id === dm.leadId) : null;

        const drawerAct = async (action, extra = {}) => {
          setBusy(dm.id);
          try {
            const res = await fetch("/api/admin/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId: dm.id, ...extra }) });
            const d = await res.json();
            if (d.error) { toast.error(d.error); return; }
            toast.success(action === "approve" ? "Approved" : action === "reject" ? "Rejected" : action === "suspend" ? "Suspended" : action === "reinstate" ? "Reinstated" : action === "promote-chief" ? "Promoted" : action === "demote-crew" ? "Demoted" : action === "assign-team" ? "Assigned to team" : action === "move-team" ? "Moved to new team" : action === "unassign-team" ? "Removed from team" : action === "delete" ? "Deleted" : "Done");
            if (action === "delete" || action === "reject") closeDrawer();
            const freshList = await load();
            if (action !== "delete" && action !== "reject" && freshList) {
              const fresh = freshList.find(m => m.id === dm.id);
              if (fresh) setDrawerMember(fresh); else closeDrawer();
            }
          } catch (err) { console.error("drawerAct error:", err); toast.error(err?.message || "Something went wrong"); } finally { setBusy(null); }
        };

        const confirmAct = async (action, extra = {}) => {
          const CONFIRMS = {
            approve: { title: "Approve Member", message: "Approve this member?", confirmLabel: "Approve" },
            reject: { title: "Reject Member", message: "Reject this member? They'll receive a notification email.", confirmLabel: "Reject", danger: true },
            suspend: { title: "Suspend Member", message: "Suspend this member? They will lose access.", confirmLabel: "Suspend", danger: true },
            reinstate: { title: "Reinstate Member", message: "Reinstate this member?", confirmLabel: "Reinstate" },
            "promote-chief": { title: "Promote to Chief", message: "Promote to chief? They'll be able to manage a team.", confirmLabel: "Promote" },
            "demote-crew": { title: "Demote to Crew", message: "Demote back to crew member?", confirmLabel: "Demote", danger: true },
            delete: { title: "Delete Member", message: "Delete this member? Records will be kept.", confirmLabel: "Delete", danger: true },
          };
          const cfg = CONFIRMS[action];
          if (cfg) { const ok = await confirm(cfg); if (!ok) return; }
          drawerAct(action, extra);
        };

        const cardS = { background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` };

        return (
          <>
            <div className="fixed inset-0 z-[999]" style={{ background: "rgba(0,0,0,.45)" }} onClick={closeDrawer} />
            <div className="fixed top-0 right-0 bottom-0 z-[1000] w-[440px] max-sm:w-full overflow-y-auto" style={{ background: dark ? "#121520" : "#f9fafb", borderLeft: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>

              {/* Close */}
              <button onClick={closeDrawer} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none p-0 z-10" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textMuted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold shrink-0 text-white" style={{ background: isChief ? "linear-gradient(135deg,#c47d8e,#a3586b)" : "linear-gradient(135deg,#7384c9,#5566b8)" }}>
                    {initials(dm.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[17px] font-bold truncate" style={{ color: t.text }}>{dm.name}</div>
                      {isPending && <span className="text-[9.5px] font-bold tracking-[.4px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: "#b45309", background: dark ? "rgba(217,119,6,.15)" : "rgba(217,119,6,.1)" }}>Pending</span>}
                      {isSuspended && <span className="text-[9.5px] font-bold tracking-[.4px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: "#dc2626", background: dark ? "rgba(220,38,38,.12)" : "rgba(220,38,38,.08)" }}>Suspended</span>}
                    </div>
                    <div className="text-[13px] truncate" style={{ color: t.textMuted }}>{dm.email}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold tracking-[.5px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: isChief ? t.accent : "#5566b8", background: isChief ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.1)") : (dark ? "rgba(85,102,184,.15)" : "rgba(85,102,184,.11)") }}>{dm.role}</span>
                      <span className="text-[10px] font-bold tracking-[.5px] uppercase py-[2px] px-2 rounded-[5px]" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>{dm.tier || "starter"}</span>
                      <span className="text-[12px]" style={{ color: t.textMuted }}>{dm.commissionRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Application note */}
                {isPending && dm.whyApply && (
                  <div className="text-[13px] leading-relaxed mb-4 py-3 px-[14px] rounded-[11px]" style={{ color: t.textSoft, ...cardS }}>
                    &ldquo;{dm.whyApply}&rdquo;
                  </div>
                )}

              </div>

              {/* Details + Actions card */}
              <div className="mx-6 mb-4 rounded-[14px] overflow-hidden" style={cardS}>
                {/* Info grid */}
                <div className="grid grid-cols-3 gap-2 p-4">
                  {[
                    ["Phone", dm.phone || "---", !!dm.phone],
                    ["X handle", dm.xHandle ? `@${dm.xHandle}` : "---", !!dm.xHandle, dm.xHandle ? `https://x.com/${dm.xHandle}` : null],
                    ["Telegram", dm.telegramHandle ? `@${dm.telegramHandle}` : "---", !!dm.telegramHandle, dm.telegramHandle ? `https://t.me/${dm.telegramHandle}` : null],
                    ["Approved", dm.approvedAt ? fD(dm.approvedAt, true) : "---", !!dm.approvedAt],
                    ["Links", dm.links, true],
                    ...(isChief ? [["Crew", dm.crewCount, true]] : [["Team", dm.leadName || "Unassigned", !!dm.leadName]]),
                    ["Commissions", dm.commissions, true],
                    ["Earned", fN(dm.totalEarned || 0), (dm.totalEarned || 0) > 0],
                    ["Paid out", fN(dm.totalPaid || 0), (dm.totalPaid || 0) > 0],
                  ].map(([label, val, has, href]) => (
                    <div key={label} className="rounded-lg py-2.5 px-3" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)" }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>{label}</div>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" title={val} className="text-[13px] font-bold mt-0.5 truncate block no-underline hover:underline" style={{ color: t.accent }}>{val}</a>
                      ) : (
                        <div className="text-[13px] font-bold mt-0.5 truncate" style={{ color: has ? t.text : t.textMuted }}>{val}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap px-4 pb-4" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, paddingTop: 14 }}>
                  {isPending && (
                    <>
                      <button disabled={busy === dm.id} onClick={() => confirmAct("approve")} className="text-[12px] font-semibold py-2 px-3 rounded-lg border-none cursor-pointer disabled:opacity-50" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.07)", color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>Approve</button>
                      <button disabled={busy === dm.id} onClick={() => confirmAct("reject")} className="text-[12px] font-semibold py-2 px-3 rounded-lg border-none cursor-pointer disabled:opacity-50" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Reject</button>
                    </>
                  )}
                  {!isPending && whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[6px] text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer no-underline border-none" style={{ background: dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.07)", color: "#25d366", fontFamily: "inherit" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .612.612l4.458-1.495A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.347 0-4.537-.67-6.396-1.827l-.387-.237-2.845.953.953-2.845-.237-.387A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      WhatsApp
                    </a>
                  )}
                  {dm.status === "approved" && isChief && (
                    <button disabled={busy === dm.id} onClick={() => confirmAct("demote-crew")} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none disabled:opacity-50" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", color: t.accent, fontFamily: "inherit" }}>Demote</button>
                  )}
                  {dm.status === "approved" && !isChief && (
                    <button onClick={() => { setShowPromoteForm(true); setPromoteTeamName(`${dm.name}'s team`); }} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none" style={{ background: dark ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.07)", color: dark ? "#a5b4fc" : "#4f46e5", fontFamily: "inherit" }}>Promote</button>
                  )}
                  {dm.status === "approved" && (
                    <button disabled={busy === dm.id} onClick={() => confirmAct("suspend")} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none disabled:opacity-50" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Suspend</button>
                  )}
                  {isSuspended && (
                    <button disabled={busy === dm.id} onClick={() => confirmAct("reinstate")} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none disabled:opacity-50" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.07)", color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>Reinstate</button>
                  )}
                  {!isPending && (
                    <button disabled={busy === dm.id} onClick={() => confirmAct("delete")} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none disabled:opacity-50" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Delete</button>
                  )}
                </div>
              </div>

              {/* Promote to chief form */}
              {showPromoteForm && (
                <div className="mx-6 mb-4 p-4 rounded-[14px]" style={cardS}>
                  <div className="text-[13px] font-semibold mb-3" style={{ color: t.text }}>Promote to Chief</div>
                  <div className="mb-3">
                    <label className="text-[11px] font-semibold uppercase tracking-[.5px] mb-1.5 block" style={{ color: t.textMuted }}>Team name</label>
                    <input value={promoteTeamName} onChange={e => setPromoteTeamName(e.target.value)} placeholder="e.g. Alpha Squad" maxLength={40} className="w-full py-2.5 px-3 rounded-lg text-[13.5px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, fontFamily: "inherit" }} />
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy === dm.id || !promoteTeamName.trim()} onClick={() => drawerAct("promote-chief", { teamName: promoteTeamName.trim() })} className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold cursor-pointer border-none text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)", fontFamily: "inherit" }}>
                      {busy === dm.id ? "Promoting..." : "Confirm Promote"}
                    </button>
                    <button onClick={() => { setShowPromoteForm(false); setPromoteTeamName(""); }} className="py-2.5 px-4 rounded-lg text-[12px] font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Team name (chiefs only) */}
              {isChief && !isPending && (
                <div className="mx-6 mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[.5px] mb-2" style={{ color: t.textMuted }}>Team name</div>
                  {editingTeamName ? (
                    <div className="flex gap-2">
                      <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} maxLength={40} className="flex-1 py-2 px-3 rounded-lg text-[13px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, fontFamily: "inherit" }} />
                      <button disabled={busy === dm.id || !editTeamName.trim()} onClick={async () => {
                        setBusy(dm.id);
                        try {
                          const res = await fetch("/api/admin/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-team-name", memberId: dm.id, teamName: editTeamName.trim() }) });
                          const d = await res.json();
                          if (d.error) { toast.error(d.error); return; }
                          toast.success("Team name updated");
                          setEditingTeamName(false);
                          setDrawerMember(prev => ({ ...prev, teamName: editTeamName.trim() }));
                          await load();
                        } catch { toast.error("Something went wrong"); } finally { setBusy(null); }
                      }} className="py-2 px-3 rounded-lg text-[12px] font-semibold cursor-pointer border-none text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)", fontFamily: "inherit" }}>Save</button>
                      <button onClick={() => setEditingTeamName(false)} className="py-2 px-3 rounded-lg text-[12px] font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: t.text }}>{dm.teamName || `${dm.name}'s team`}</span>
                      <button onClick={() => { setEditingTeamName(true); setEditTeamName(dm.teamName || `${dm.name}'s team`); }} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer border-none p-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textMuted }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Archived links */}
              {dm.archivedLinks?.length > 0 && (
                <div className="mx-6 mb-4">
                  <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none bg-transparent py-0" style={{ color: t.textMuted, fontFamily: "inherit" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showArchived ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                    {dm.archivedLinks.length} archived link{dm.archivedLinks.length !== 1 ? "s" : ""}
                  </button>
                  {showArchived && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {dm.archivedLinks.map(l => (
                        <div key={l.slug} className="flex items-center gap-2 py-2 px-3 rounded-lg text-[12px]" style={cardS}>
                          <span className="font-semibold truncate" style={{ color: t.textMuted }}>/{l.slug}</span>
                          <span className="ml-auto shrink-0 text-[11px]" style={{ color: t.textMuted }}>{fD(l.archivedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Team assignment (non-chiefs only) */}
              {!isChief && !isPending && (
                <div className="mx-6 mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[.5px] mb-2" style={{ color: t.textMuted }}>Team</div>
                  {currentChief ? (
                    <div className="flex items-center gap-3 py-3 px-4 rounded-xl mb-3" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold shrink-0 text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)" }}>
                        {initials(currentChief.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold truncate" style={{ color: t.text }}>{currentChief.teamName || `${currentChief.name}'s team`}</div>
                        <div className="text-[12px]" style={{ color: t.textMuted }}>{currentChief.crewCount} crew</div>
                      </div>
                      <button disabled={busy === dm.id} onClick={() => drawerAct("unassign-team")} className="text-[11px] font-semibold py-1.5 px-2.5 rounded-lg cursor-pointer border-none disabled:opacity-50" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Remove</button>
                    </div>
                  ) : (
                    <div className="py-3 px-4 rounded-xl text-[13px] mb-3" style={{ ...cardS, color: t.textMuted }}>
                      Not assigned to any team
                    </div>
                  )}
                  {chiefs.filter(c => c.id !== dm.leadId).length > 0 && (
                    <>
                      {!showTeamPicker ? (
                        <button onClick={() => setShowTeamPicker(true)} className="text-[12px] font-semibold py-2 px-3 rounded-lg cursor-pointer border-none" style={{ background: dark ? "rgba(56,189,248,.12)" : "rgba(14,165,233,.07)", color: dark ? "#38bdf8" : "#0284c7", fontFamily: "inherit" }}>
                          {currentChief ? "Move to another team" : "Assign to a team"}
                        </button>
                      ) : (() => {
                        const q = teamSearch.toLowerCase();
                        const filtered = chiefs.filter(c => c.id !== dm.leadId && (!q || c.name.toLowerCase().includes(q)));
                        return (
                          <div className="rounded-xl overflow-hidden" style={cardS}>
                            <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Search chiefs..." className="w-full py-2.5 px-3 text-[13px] bg-transparent border-none outline-none" style={{ color: t.text, fontFamily: "inherit", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }} />
                            {filtered.length === 0 ? (
                              <div className="py-3 px-3 text-[12px]" style={{ color: t.textMuted }}>No chiefs found</div>
                            ) : filtered.map(chief => (
                              <button
                                key={chief.id}
                                disabled={busy === dm.id}
                                onClick={() => drawerAct(dm.leadId ? "move-team" : "assign-team", { chiefId: chief.id })}
                                className="flex items-center w-full py-2.5 px-3 cursor-pointer border-none text-left disabled:opacity-50 transition-colors"
                                style={{ fontFamily: "inherit", background: "transparent", borderTop: chief !== filtered[0] ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"}` : "none" }}
                                onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                              >
                                <span className="text-[13px] font-semibold" style={{ color: t.text }}>{chief.name}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </>
  );
}
