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

/* ── Member Row ── */
function MemberRow({ m, dark, t, busy, onAction, expanded, onExpand, cardBg, hair }) {
  const isChief = m.role === "chief";
  const isPending = m.status === "pending";
  const isSuspended = m.status === "suspended";

  const whatsappUrl = m.phone ? `https://wa.me/${m.phone.replace(/\D/g, "")}` : null;

  return (
    <>
      <div
        className="grid items-center gap-[14px] px-[18px] min-h-[60px] cursor-pointer transition-colors hover:bg-[rgba(196,125,142,.04)]"
        style={{ gridTemplateColumns: "minmax(0,1fr) 96px 64px 110px 130px 38px", borderTop: `1px solid ${hair}` }}
        onClick={onExpand}
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
        {/* Joined */}
        <div className="text-[12.5px] whitespace-nowrap max-md:hidden" style={{ color: t.textMuted }}>{fD(m.createdAt)}</div>
        {/* Chevron */}
        <div className="justify-self-end transition-transform duration-200" style={{ color: t.textMuted, transform: expanded ? "rotate(180deg)" : "none" }}>{CHEV}</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-[18px] py-4" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderTop: `1px solid ${hair}` }}>
          {/* Pending: application note */}
          {isPending && m.whyApply && (
            <div className="text-[13px] leading-relaxed mb-4 py-3 px-[14px] rounded-[11px]" style={{ color: t.textSoft, background: cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
              &ldquo;{m.whyApply}&rdquo;
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-4 max-md:grid-cols-2 gap-x-[14px] gap-y-2 mb-[15px]">
            {m.phone && (
              <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>Phone</span><span className="m text-[13px] font-semibold truncate" style={{ color: t.text }}>{m.phone}</span></div>
            )}
            {m.xHandle && (
              <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>X handle</span><span className="text-[13px] font-semibold truncate" style={{ color: t.text }}>@{m.xHandle}</span></div>
            )}
            {m.approvedAt && (
              <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>Approved</span><span className="text-[13px] font-semibold" style={{ color: t.text }}>{fD(m.approvedAt)}</span></div>
            )}
            <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>Links</span><span className="m text-[13px] font-semibold" style={{ color: t.text }}>{m.links}</span></div>
            {isChief && (
              <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>Crew</span><span className="m text-[13px] font-semibold" style={{ color: t.text }}>{m.crewCount}</span></div>
            )}
            {m.telegramHandle && (
              <div className="flex flex-col gap-1"><span className="text-[9.5px] font-bold tracking-[.5px] uppercase" style={{ color: t.textMuted }}>Telegram</span><span className="text-[13px] font-semibold truncate" style={{ color: t.text }}>@{m.telegramHandle}</span></div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {isPending && (
              <>
                <button disabled={busy === m.id} onClick={() => onAction("approve", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] border-none cursor-pointer text-white disabled:opacity-50" style={{ background: dark ? "rgba(5,150,105,.8)" : "#059669", fontFamily: "inherit" }}>Approve</button>
                <button disabled={busy === m.id} onClick={() => onAction("reject", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: "transparent", border: `1px solid ${dark ? "rgba(220,38,38,.3)" : "rgba(220,38,38,.2)"}`, color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Reject</button>
              </>
            )}
            {!isPending && whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer no-underline" style={{ background: cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.textSoft, fontFamily: "inherit" }}>Message on WhatsApp</a>
            )}
            {m.status === "approved" && isChief && (
              <button disabled={busy === m.id} onClick={() => onAction("demote-crew", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.textSoft, fontFamily: "inherit" }}>Demote to Crew</button>
            )}
            {m.status === "approved" && !isChief && (
              <button disabled={busy === m.id} onClick={() => onAction("promote-chief", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.textSoft, fontFamily: "inherit" }}>Promote to Chief</button>
            )}
            {m.status === "approved" && (
              <button disabled={busy === m.id} onClick={() => onAction("suspend", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: "transparent", border: `1px solid ${dark ? "rgba(220,38,38,.3)" : "rgba(220,38,38,.2)"}`, color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Suspend</button>
            )}
            {isSuspended && (
              <button disabled={busy === m.id} onClick={() => onAction("reinstate", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>Reinstate</button>
            )}
            {!isPending && (
              <button disabled={busy === m.id} onClick={() => onAction("delete", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] cursor-pointer disabled:opacity-50" style={{ background: "transparent", border: `1px solid ${dark ? "rgba(220,38,38,.3)" : "rgba(220,38,38,.2)"}`, color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Delete</button>
            )}
          </div>
        </div>
      )}
    </>
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
  const [tierCfg, setTierCfg] = useState({ affiliate_starter_rate: "30", affiliate_growth_rate: "40", affiliate_pro_rate: "50", affiliate_growth_threshold: "30", affiliate_pro_threshold: "100", affiliate_lead_split: "40" });
  const [tierCfgLoading, setTierCfgLoading] = useState(false);
  const [tierCfgSaving, setTierCfgSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/crew");
      const d = await res.json();
      if (d.error) return;
      setMembers(d.members || []);
      setStats(d.stats || {});
    } catch {} finally { setLoading(false); }
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
      const res = await fetch("/api/admin/settings?keys=affiliate_starter_rate,affiliate_growth_rate,affiliate_pro_rate,affiliate_growth_threshold,affiliate_pro_threshold,affiliate_lead_split");
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

  const renderRow = (m) => (
    <MemberRow key={m.id} m={m} dark={dark} t={t} busy={busy} onAction={act} expanded={expandedId === m.id} onExpand={() => toggleExpand(m.id)} cardBg={cardBg} hair={hair} />
  );

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pit Crew</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage your crew, chiefs, tiers, and payouts</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

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
              ["Payouts", stats.pendingPayouts || 0, (stats.pendingPayouts || 0) > 0],
              ["Held", fN(stats.heldAmount || 0)],
            ].map(([label, val, warn]) => (
              <div key={label} className="py-[15px] px-[17px] rounded-[14px]" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="m text-[25px] font-semibold leading-none" style={{ color: warn ? "#b45309" : t.text }}>{val}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[.6px] mt-2" style={{ color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Money strip */}
          <div className="text-[12.5px] mb-[22px] px-1" style={{ color: t.textMuted }}>
            Paid out all-time <b className="m" style={{ color: t.textSoft, fontWeight: 600 }}>{fN(stats.totalPaidOut || 0)}</b>
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

          {/* Table */}
          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
            {/* Header */}
            <div className="grid items-center gap-[14px] px-[18px] h-[42px]" style={{ gridTemplateColumns: "minmax(0,1fr) 96px 64px 110px 130px 38px", borderBottom: `1px solid ${hair}` }}>
              <span className="text-[10.5px] font-bold tracking-[.6px] uppercase" style={{ color: t.textMuted }}>Member</span>
              <span className="text-[10.5px] font-bold tracking-[.6px] uppercase max-md:hidden" style={{ color: t.textMuted }}>Role</span>
              <span className="text-[10.5px] font-bold tracking-[.6px] uppercase max-md:hidden" style={{ color: t.textMuted }}>Base</span>
              <span className="text-[10.5px] font-bold tracking-[.6px] uppercase text-right" style={{ color: t.textMuted }}>Earned</span>
              <span className="text-[10.5px] font-bold tracking-[.6px] uppercase max-md:hidden" style={{ color: t.textMuted }}>Joined</span>
              <span />
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm" style={{ color: t.textMuted }}>Loading crew...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="text-[13px] font-medium" style={{ color: t.textMuted }}>No members found</div>
              </div>
            ) : view === "team" ? (
              <>
                {teamGroups.groups.map(({ chief, crew, totalEarned }, gi) => (
                  <div key={chief.id}>
                    {/* Team header */}
                    <div className="flex items-center gap-[9px] px-[18px] py-[11px] text-[12.5px] font-semibold" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderTop: gi > 0 || filtered.some(m => m.status === "pending") ? `1px solid ${hair}` : "none", color: t.textSoft }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                      {chief.name}&apos;s team
                      <span className="ml-auto m text-[12px] font-medium" style={{ color: t.textMuted }}>{crew.length} crew · {fN(totalEarned)}</span>
                    </div>
                    {renderRow(chief)}
                    {crew.map(renderRow)}
                  </div>
                ))}
                {teamGroups.unassigned.length > 0 && (
                  <div>
                    <div className="flex items-center gap-[9px] px-[18px] py-[11px] text-[12.5px] font-semibold" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderTop: `1px solid ${hair}`, color: t.textSoft }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                      Unassigned
                      <span className="ml-auto m text-[12px] font-medium" style={{ color: t.textMuted }}>{teamGroups.unassigned.length}</span>
                    </div>
                    {teamGroups.unassigned.map(renderRow)}
                  </div>
                )}
              </>
            ) : (
              filtered.map(renderRow)
            )}
          </div>
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
        <div className="flex flex-col gap-[14px] max-w-[560px]">
          {tierCfgLoading ? null : (
            <>
              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-5 px-5">
                  <div className="text-[14px] font-bold mb-[3px]" style={{ color: t.text }}>Tier rates</div>
                  <div className="text-[12.5px] mb-[14px] leading-relaxed" style={{ color: t.textMuted }}>The commission pot for each crew tier. Chiefs always earn the top tier.</div>
                  <div className="grid grid-cols-3 gap-[14px]">
                    {[["affiliate_starter_rate", "Starter"], ["affiliate_growth_rate", "Growth"], ["affiliate_pro_rate", "Pro"]].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[12px] font-semibold block mb-[6px]" style={{ color: t.textSoft }}>{label}</label>
                        <div className="flex items-center rounded-[9px] px-3" style={{ background: dark ? "#161b2b" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                          <input type="number" min="1" max="100" value={tierCfg[key] || ""} onChange={e => setTierCfg(p => ({ ...p, [key]: e.target.value }))} className="m flex-1 text-[15px] font-semibold py-[10px] bg-transparent border-none outline-none" style={{ color: t.text }} />
                          <span className="text-[13px]" style={{ color: t.textMuted }}>%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd, boxShadow: shadow }}>
                <div className="py-5 px-5">
                  <div className="text-[14px] font-bold mb-[3px]" style={{ color: t.text }}>Rules</div>
                  <div className="text-[12.5px] mb-[14px] leading-relaxed" style={{ color: t.textMuted }}>Thresholds for the whole program.</div>
                  <div className="grid grid-cols-3 max-md:grid-cols-1 gap-[14px]">
                    {[["affiliate_growth_threshold", "Growth threshold", "referrals"], ["affiliate_pro_threshold", "Pro threshold", "referrals"], ["affiliate_lead_split", "Chief cut", "%"]].map(([key, label, unit]) => (
                      <div key={key}>
                        <label className="text-[12px] font-semibold block mb-[6px]" style={{ color: t.textSoft }}>{label}</label>
                        <div className="flex items-center rounded-[9px] px-3" style={{ background: dark ? "#161b2b" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                          <input type="number" min="0" value={tierCfg[key] || ""} onChange={e => setTierCfg(p => ({ ...p, [key]: e.target.value }))} className="m flex-1 text-[15px] font-semibold py-[10px] bg-transparent border-none outline-none" style={{ color: t.text }} />
                          <span className="text-[13px]" style={{ color: t.textMuted }}>{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={saveTierCfg} disabled={tierCfgSaving} className="self-start py-2.5 px-6 rounded-xl text-[13px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: t.accent, fontFamily: "inherit" }}>
                {tierCfgSaving ? "Saving..." : "Save Settings"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
