"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";

const STATUS_COLORS = { pending: "#F59E0B", approved: "#059669", suspended: "#EF4444" };
const TIER_COLORS = { starter: "#6B7280", growth: "#3B82F6", pro: "#c47d8e" };

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ── Member Card ── */
function MemberCard({ m, dark, t, busy, onAction, chiefs, selected, onSelect, expanded, onExpand }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const menuRef = useRef(null);
  const assignRef = useRef(null);

  useEffect(() => {
    if (!menuOpen && !assignOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (assignRef.current && !assignRef.current.contains(e.target)) setAssignOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen, assignOpen]);

  const isChief = m.role === "chief";
  const isPending = m.status === "pending";
  const isSuspended = m.status === "suspended";
  const tint = isChief
    ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.07)")
    : isPending
      ? (dark ? "rgba(217,119,6,.07)" : "rgba(217,119,6,.06)")
      : isSuspended
        ? (dark ? "rgba(220,38,38,.06)" : "rgba(220,38,38,.05)")
        : (dark ? "rgba(85,102,184,.06)" : "rgba(85,102,184,.055)");
  const brd = isChief
    ? (dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.26)")
    : isPending
      ? (dark ? "rgba(217,119,6,.26)" : "rgba(217,119,6,.24)")
      : isSuspended
        ? (dark ? "rgba(220,38,38,.22)" : "rgba(220,38,38,.2)")
        : (dark ? "rgba(85,102,184,.20)" : "rgba(85,102,184,.18)");

  const tileBg = dark ? "#161b2b" : "#fff";
  const shadow = dark ? "none" : "0 1px 2px rgba(0,0,0,.035),0 6px 16px rgba(0,0,0,.045)";

  return (
    <div className="rounded-2xl mb-3 transition-transform duration-150 hover:-translate-y-px" style={{ background: tint, border: `1px solid ${brd}`, boxShadow: shadow }}>
      {/* Top row */}
      <div className="flex items-center gap-3 p-4 pb-0 cursor-pointer" onClick={onExpand}>
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} className="w-[17px] h-[17px] rounded shrink-0 cursor-pointer accent-[#c47d8e]" />
        <div className="w-10 h-10 rounded-[11px] flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ background: isChief ? "linear-gradient(135deg,#c47d8e,#a3586b)" : isPending ? (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)") : "linear-gradient(135deg,#7384c9,#5566b8)", color: isPending ? t.textMuted : "#fff" }}>
          {initials(m.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-semibold" style={{ color: t.text }}>{m.name}</span>
            <span className="text-[9.5px] font-bold tracking-[.4px] uppercase py-[2px] px-[7px] rounded-[5px]" style={{ color: isChief ? t.accent : "#5566b8", background: isChief ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.1)") : (dark ? "rgba(85,102,184,.15)" : "rgba(85,102,184,.11)") }}>
              {m.role}
            </span>
            {isPending && <span className="text-[10px] font-semibold py-[2px] px-2 rounded-full" style={{ color: "#b45309", background: dark ? "rgba(217,119,6,.15)" : "rgba(217,119,6,.12)" }}>Pending</span>}
            {isSuspended && <span className="text-[10px] font-semibold py-[2px] px-2 rounded-full" style={{ color: "#dc2626", background: dark ? "rgba(220,38,38,.12)" : "rgba(220,38,38,.09)" }}>Suspended</span>}
            {!m.leadId && !isChief && m.status === "approved" && <span className="text-[10px] font-semibold py-[2px] px-2 rounded-full" style={{ color: "#b45309", background: dark ? "rgba(217,119,6,.15)" : "rgba(217,119,6,.12)" }}>No team</span>}
          </div>
          <div className="text-[12.5px] mt-[2px]" style={{ color: t.textMuted }}>
            {m.email}{isChief ? ` · Chief base ${m.commissionRate}%` : m.status === "approved" ? ` · ${m.tier} ${m.commissionRate}%` : ""}
          </div>
        </div>
        <div className="relative shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-[32px] h-[32px] rounded-[9px] border-none flex items-center justify-center cursor-pointer" style={{ background: "transparent", color: t.textMuted }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
          {menuOpen && (
            <div className="absolute top-9 right-0 min-w-[178px] rounded-[12px] p-[5px] z-10" style={{ background: dark ? "#0f1320" : "#fffdfb", border: `1px solid ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)"}`, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
              {m.status === "approved" && !isChief && (
                <button onClick={() => { setMenuOpen(false); setAssignOpen(true); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.textSoft, fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  {m.leadId ? "Move to another team" : "Assign to team"}
                </button>
              )}
              {m.status === "approved" && !isChief && (
                <button onClick={() => { setMenuOpen(false); onAction("promote-chief", m.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.textSoft, fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                  Promote to Chief
                </button>
              )}
              {m.status === "approved" && isChief && (
                <button onClick={() => { setMenuOpen(false); onAction("demote-crew", m.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.textSoft, fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  Demote to Crew
                </button>
              )}
              {m.status === "approved" && (
                <button onClick={() => { setMenuOpen(false); onAction("suspend", m.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.textSoft, fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  Suspend
                </button>
              )}
              {isSuspended && (
                <button onClick={() => { setMenuOpen(false); onAction("reinstate", m.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Reinstate
                </button>
              )}
              <div className="h-px mx-[6px] my-1" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)" }} />
              <button onClick={() => { setMenuOpen(false); onAction("delete", m.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[8px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assign dropdown (separate from kebab) */}
      {assignOpen && (
        <div className="relative mx-4 mt-2" ref={assignRef}>
          <div className="rounded-[12px] p-[6px] z-10" style={{ background: dark ? "#0f1320" : "#fffdfb", border: `1px solid ${dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)"}`, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
            <div className="text-[9.5px] font-bold tracking-[.5px] uppercase py-[6px] px-[10px]" style={{ color: t.textMuted }}>Assign to team</div>
            {chiefs.filter(c => c.id !== m.leadId).map(c => (
              <button key={c.id} onClick={() => { setAssignOpen(false); onAction(m.leadId ? "move-team" : "assign-team", m.id, { chiefId: c.id }); }} className="w-full flex items-center gap-[9px] py-2 px-[10px] rounded-[8px] border-none cursor-pointer text-[13px] font-medium" style={{ background: "transparent", color: t.text, fontFamily: "inherit" }}>
                <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg,#c47d8e,#a3586b)" }}>{initials(c.name)}</span>
                {c.name}&apos;s team
              </button>
            ))}
            {m.leadId && (
              <button onClick={() => { setAssignOpen(false); onAction("unassign-team", m.id); }} className="w-full flex items-center gap-[9px] py-2 px-[10px] rounded-[8px] border-none cursor-pointer text-[13px] font-medium" style={{ background: "transparent", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Remove from team
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded body */}
      {(expanded || isPending) && (
        <div className="px-4 pb-4">
          {/* Pending: why + contacts */}
          {isPending && m.whyApply && (
            <div className="text-[13px] leading-relaxed mt-3 py-3 px-[14px] rounded-[11px]" style={{ color: t.textSoft, background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
              &ldquo;{m.whyApply}&rdquo;
            </div>
          )}

          {/* Contact cards (pending) */}
          {isPending && (
            <div className="grid grid-cols-3 max-md:grid-cols-1 gap-[9px] mt-3">
              {m.phone && (
                <div className="flex items-center gap-[10px] py-[10px] px-3 rounded-[11px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div className="min-w-0"><div className="text-[9.5px] uppercase tracking-[.5px]" style={{ color: t.textMuted }}>Phone</div><div className="text-[12.5px] font-semibold truncate" style={{ color: t.text }}>{m.phone}</div></div>
                </div>
              )}
              {m.xHandle && (
                <div className="flex items-center gap-[10px] py-[10px] px-3 rounded-[11px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </div>
                  <div className="min-w-0"><div className="text-[9.5px] uppercase tracking-[.5px]" style={{ color: t.textMuted }}>X</div><div className="text-[12.5px] font-semibold truncate" style={{ color: t.text }}>@{m.xHandle}</div></div>
                </div>
              )}
              {m.telegramHandle && (
                <div className="flex items-center gap-[10px] py-[10px] px-3 rounded-[11px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                  <div className="min-w-0"><div className="text-[9.5px] uppercase tracking-[.5px]" style={{ color: t.textMuted }}>Telegram</div><div className="text-[12.5px] font-semibold truncate" style={{ color: t.text }}>@{m.telegramHandle}</div></div>
                </div>
              )}
            </div>
          )}

          {/* Pending actions */}
          {isPending && (
            <div className="flex gap-2 mt-3">
              <button disabled={busy === m.id} onClick={() => onAction("reject", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] border cursor-pointer" style={{ background: "transparent", borderColor: dark ? "rgba(220,38,38,.3)" : "rgba(220,38,38,.2)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Reject</button>
              <button disabled={busy === m.id} onClick={() => onAction("approve", m.id)} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] border-none cursor-pointer text-white" style={{ background: dark ? "rgba(5,150,105,.8)" : "#059669", fontFamily: "inherit" }}>Approve as member</button>
            </div>
          )}

          {/* Approved/suspended: stat tiles */}
          {!isPending && (
            <>
              <div className={`grid gap-[9px] mt-3 ${isChief ? "grid-cols-3" : "grid-cols-3"}`}>
                <div className="rounded-[11px] py-[11px] px-[13px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div className="text-[9.5px] uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>Earned</div>
                  <div className="m text-[17px] font-semibold tracking-[-0.3px]" style={{ color: m.totalEarned > 0 ? (dark ? "#6ee7b7" : "#059669") : t.text }}>{fN(m.totalEarned || 0)}</div>
                </div>
                {isChief ? (
                  <>
                    <div className="rounded-[11px] py-[11px] px-[13px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[9.5px] uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>Crew</div>
                      <div className="m text-[17px] font-semibold tracking-[-0.3px]" style={{ color: t.text }}>{m.crewCount}</div>
                    </div>
                    <div className="rounded-[11px] py-[11px] px-[13px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[9.5px] uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>Links</div>
                      <div className="m text-[17px] font-semibold tracking-[-0.3px]" style={{ color: t.text }}>{m.links}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-[11px] py-[11px] px-[13px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[9.5px] uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>Commissions</div>
                      <div className="m text-[17px] font-semibold tracking-[-0.3px]" style={{ color: t.text }}>{m.commissions}</div>
                    </div>
                    <div className="rounded-[11px] py-[11px] px-[13px]" style={{ background: tileBg, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[9.5px] uppercase tracking-[.5px] mb-1" style={{ color: t.textMuted }}>Links</div>
                      <div className="m text-[17px] font-semibold tracking-[-0.3px]" style={{ color: t.text }}>{m.links}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer info */}
              <div className="flex items-center gap-2 mt-3 flex-wrap text-[12px]" style={{ color: t.textMuted }}>
                {m.phone && <span>Phone <b style={{ color: t.textSoft, fontWeight: 600 }}>{m.phone}</b></span>}
                {m.phone && <span style={{ opacity: .4 }}>·</span>}
                <span>Joined <b style={{ color: t.textSoft, fontWeight: 600 }}>{fD(m.createdAt)}</b></span>
                {m.totalPaid > 0 && <><span style={{ opacity: .4 }}>·</span><span>Paid out <b style={{ color: t.textSoft, fontWeight: 600 }}>{fN(m.totalPaid)}</b></span></>}
              </div>

              {/* Tier selector */}
              {m.status === "approved" && (
                <div className="mt-3">
                  <select value={m.tier} onChange={e => onAction("update-tier", m.id, { tier: e.target.value })} disabled={busy === m.id} className="py-1.5 px-2.5 rounded-lg text-[12px] border cursor-pointer bg-transparent outline-none" style={{ borderColor: dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)", color: t.text, fontFamily: "inherit" }}>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Collapsed footer for non-pending */}
      {!expanded && !isPending && (
        <div className="px-4 pb-3 pt-1 text-[12px]" style={{ color: t.textMuted }}>
          {m.totalEarned > 0 && <span className="m font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(m.totalEarned)}</span>}
          {m.totalEarned > 0 && <span style={{ opacity: .4 }}> · </span>}
          <span>Joined {fD(m.createdAt)}</span>
        </div>
      )}
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
  const [selected, setSelected] = useState(new Set());
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

  const bulkAct = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm({ title: `Bulk ${action}`, message: `${action} ${ids.length} member${ids.length > 1 ? "s" : ""}?`, confirmLabel: action, danger: action === "suspend" || action === "delete" });
    if (!ok) return;
    for (const id of ids) {
      await fetch("/api/admin/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId: id }) }).catch(() => {});
    }
    setSelected(new Set());
    toast.success(`${action} applied to ${ids.length} members`);
    await load();
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

  const chiefs = useMemo(() => members.filter(m => m.role === "chief" && m.status === "approved"), [members]);
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

  const pending = filtered.filter(m => m.status === "pending");
  const approved = filtered.filter(m => m.status !== "pending");

  const teamGroups = useMemo(() => {
    const groups = [];
    const teamChiefs = approved.filter(m => m.role === "chief");
    for (const chief of teamChiefs) {
      const crew = approved.filter(m => m.role !== "chief" && m.leadId === chief.id);
      const totalEarned = [chief, ...crew].reduce((s, m) => s + (m.totalEarned || 0), 0);
      groups.push({ chief, crew, totalEarned });
    }
    const unassigned = approved.filter(m => m.role !== "chief" && !m.leadId);
    return { groups, unassigned };
  }, [approved]);

  const PAYOUT_COLORS = { pending: "#F59E0B", processing: "#3B82F6", completed: "#059669", rejected: "#EF4444" };
  const filteredPayouts = payoutFilter === "all" ? payouts : payouts.filter(p => p.status === payoutFilter);
  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
  const cardBd = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Pit Crew</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage your crew, chiefs, tiers, and payouts</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", boxShadow: dark ? "none" : "0 1px 2px rgba(0,0,0,.035),0 6px 16px rgba(0,0,0,.045)" }}>
        {[["members", "Members"], ["payouts", `Payouts${pendingPayoutCount > 0 ? ` (${pendingPayoutCount})` : ""}`], ["activity", "Activity"], ["settings", "Settings"]].map(([id, label]) => (
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
              <div key={label} className="py-[15px] px-[17px] rounded-[14px]" style={{ background: cardBg, border: cardBd, boxShadow: dark ? "none" : "0 1px 2px rgba(0,0,0,.035),0 6px 16px rgba(0,0,0,.045)" }}>
                <div className="m text-[24px] font-semibold leading-none" style={{ color: warn ? "#b45309" : t.text }}>{val}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[.5px] mt-[7px]" style={{ color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Money strip */}
          <div className="mb-5 py-[11px] px-[15px] rounded-[12px]" style={{ background: cardBg, border: cardBd }}>
            <div className="text-[12.5px]" style={{ color: t.textMuted }}>Paid out all-time <b className="m" style={{ color: t.textSoft, fontWeight: 600 }}>{fN(stats.totalPaidOut || 0)}</b></div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-[10px] flex-wrap mb-4">
            <label className="flex items-center gap-[9px] flex-1 min-w-[180px] max-md:flex-[100%] max-md:order-[-1] px-[13px] rounded-[11px]" style={{ background: cardBg, border: cardBd }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members" className="border-none bg-transparent outline-none text-[14px] py-[10px] w-full" style={{ color: t.text, fontFamily: "inherit" }} />
            </label>
            <div className="relative flex items-center rounded-[11px] px-[11px]" style={{ background: cardBg, border: cardBd }}>
              <select value={view} onChange={e => setView(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[10px] pr-5 cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="team">By team</option>
                <option value="flat">All members</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div className="relative flex items-center rounded-[11px] px-[11px]" style={{ background: cardBg, border: cardBd }}>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[10px] pr-5 cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div className="relative flex items-center rounded-[11px] px-[11px]" style={{ background: cardBg, border: cardBd }}>
              <select value={sort} onChange={e => setSort(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[10px] pr-5 cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="name">Name</option>
                <option value="joined">Joined</option>
                <option value="earned">Earnings</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-[10px] rounded-xl py-[9px] px-[14px] mb-4" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)", border: `1px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.26)"}` }}>
              <span className="text-[13px] font-semibold" style={{ color: t.accent }}>{selected.size} selected</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => bulkAct("approve")} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] border-none cursor-pointer" style={{ background: dark ? "rgba(5,150,105,.15)" : "rgba(5,150,105,.1)", color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>Approve</button>
                <button onClick={() => bulkAct("suspend")} className="text-[12.5px] font-semibold py-2 px-[13px] rounded-[9px] border cursor-pointer" style={{ background: "transparent", borderColor: dark ? "rgba(220,38,38,.3)" : "rgba(220,38,38,.2)", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>Suspend</button>
                <button onClick={() => setSelected(new Set())} className="text-[12.5px] font-semibold border-none cursor-pointer bg-transparent" style={{ color: t.textMuted, fontFamily: "inherit" }}>Clear</button>
              </div>
            </div>
          )}

          <div className="text-[12.5px] font-medium mb-3 mx-0.5" style={{ color: t.textMuted }}>
            {filtered.length} member{filtered.length !== 1 ? "s" : ""}{view === "team" ? ` across ${teamGroups.groups.length} team${teamGroups.groups.length !== 1 ? "s" : ""}` : ""}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: t.textMuted }}>Loading crew...</div>
          ) : view === "team" ? (
            <>
              {/* Pending applications */}
              {pending.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-3 mx-0.5" style={{ color: "#b45309" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                    Pending applications <span className="font-semibold">{pending.length}</span>
                  </div>
                  {pending.map(m => (
                    <MemberCard key={m.id} m={m} dark={dark} t={t} busy={busy} onAction={act} chiefs={chiefs} selected={selected.has(m.id)} onSelect={() => setSelected(prev => { const s = new Set(prev); s.has(m.id) ? s.delete(m.id) : s.add(m.id); return s; })} expanded={expandedId === m.id} onExpand={() => setExpandedId(expandedId === m.id ? null : m.id)} />
                  ))}
                </div>
              )}

              {/* Teams */}
              {teamGroups.groups.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-3 mx-0.5" style={{ color: t.textSoft }}>
                    Teams <span style={{ color: t.textMuted }}>{teamGroups.groups.length}</span>
                  </div>
                  {teamGroups.groups.map(({ chief, crew, totalEarned }) => (
                    <div key={chief.id} className="mb-5">
                      <div className="flex items-center gap-2 text-[13px] font-semibold mb-2 mx-0.5" style={{ color: t.textSoft }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                        {chief.name}&apos;s team
                        <span className="ml-auto text-[12px] font-medium" style={{ color: t.textMuted }}>{crew.length} crew · {fN(totalEarned)}</span>
                      </div>
                      <MemberCard m={chief} dark={dark} t={t} busy={busy} onAction={act} chiefs={chiefs} selected={selected.has(chief.id)} onSelect={() => setSelected(prev => { const s = new Set(prev); s.has(chief.id) ? s.delete(chief.id) : s.add(chief.id); return s; })} expanded={expandedId === chief.id} onExpand={() => setExpandedId(expandedId === chief.id ? null : chief.id)} />
                      {crew.map(cm => (
                        <MemberCard key={cm.id} m={cm} dark={dark} t={t} busy={busy} onAction={act} chiefs={chiefs} selected={selected.has(cm.id)} onSelect={() => setSelected(prev => { const s = new Set(prev); s.has(cm.id) ? s.delete(cm.id) : s.add(cm.id); return s; })} expanded={expandedId === cm.id} onExpand={() => setExpandedId(expandedId === cm.id ? null : cm.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Unassigned */}
              {teamGroups.unassigned.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-3 mx-0.5" style={{ color: t.textSoft }}>
                    Unassigned crew <span style={{ color: t.textMuted }}>{teamGroups.unassigned.length}</span>
                  </div>
                  {teamGroups.unassigned.map(m => (
                    <MemberCard key={m.id} m={m} dark={dark} t={t} busy={busy} onAction={act} chiefs={chiefs} selected={selected.has(m.id)} onSelect={() => setSelected(prev => { const s = new Set(prev); s.has(m.id) ? s.delete(m.id) : s.add(m.id); return s; })} expanded={expandedId === m.id} onExpand={() => setExpandedId(expandedId === m.id ? null : m.id)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Flat view */
            filtered.map(m => (
              <MemberCard key={m.id} m={m} dark={dark} t={t} busy={busy} onAction={act} chiefs={chiefs} selected={selected.has(m.id)} onSelect={() => setSelected(prev => { const s = new Set(prev); s.has(m.id) ? s.delete(m.id) : s.add(m.id); return s; })} expanded={expandedId === m.id} onExpand={() => setExpandedId(expandedId === m.id ? null : m.id)} />
            ))
          )}
        </>
      )}

      {/* ═══ PAYOUTS TAB ═══ */}
      {tab === "payouts" && (
        <>
          <div className="flex mb-4">
            <div className="relative flex items-center rounded-[11px] px-[11px]" style={{ background: cardBg, border: cardBd }}>
              <select value={payoutFilter} onChange={e => setPayoutFilter(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13px] font-semibold py-[10px] pr-5 cursor-pointer capitalize" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="all">All</option>
                <option value="pending">Pending{pendingPayoutCount > 0 ? ` (${pendingPayoutCount})` : ""}</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBd }}>
            {filteredPayouts.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: t.textMuted }}>No {payoutFilter === "all" ? "" : payoutFilter} payouts</div>
            ) : filteredPayouts.map((p, i) => {
              const expanded = expandedId === p.id;
              const statusColor = PAYOUT_COLORS[p.status] || "#6B7280";
              return (
                <div key={p.id}>
                  <div className="py-3.5 px-[18px] flex items-center gap-3 cursor-pointer hover:bg-[rgba(196,125,142,.03)] transition-colors" style={{ borderBottom: (i < filteredPayouts.length - 1 || expanded) ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` : "none" }} onClick={() => setExpandedId(expanded ? null : p.id)}>
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: `${statusColor}18`, color: statusColor }}>{initials(p.memberName)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-[13.5px] font-semibold" style={{ color: t.text }}>{p.memberName}</span><span className="text-[10.5px] py-[1px] px-[6px] rounded-full font-medium capitalize" style={{ background: `${statusColor}18`, color: statusColor }}>{p.status}</span></div>
                      <div className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{p.memberEmail} · {fD(p.createdAt)}</div>
                    </div>
                    <div className="m text-[15px] font-bold shrink-0" style={{ color: t.text }}>{fN(p.amount)}</div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {expanded && (
                    <div className="px-[18px] py-4 flex flex-col gap-3.5" style={{ background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
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
          <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: cardBd }}>
            {activityLogs.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: t.textMuted }}>No activity yet</div>
            ) : activityLogs.map((log, i) => (
              <div key={log.id} className="flex items-start gap-3 py-[13px] px-[18px]" style={{ borderTop: i > 0 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` : "none" }}>
                <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 mt-px" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
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
        <div className="flex flex-col gap-5 max-w-[560px]">
          {tierCfgLoading ? null : (
            <>
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: cardBd }}>
                <div className="py-5 px-5">
                  <div className="text-[14px] font-bold mb-1" style={{ color: t.text }}>Tier rates</div>
                  <div className="text-[12.5px] mb-4" style={{ color: t.textMuted }}>The commission pot for each crew tier.</div>
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
                  <div className="flex gap-[9px] items-start mt-[14px] py-3 px-[14px] rounded-[11px]" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)", border: `1px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.2)"}` }}>
                    <svg className="shrink-0 mt-px" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span className="text-[12.5px] leading-relaxed" style={{ color: t.textSoft }}><b style={{ color: t.text }}>Chiefs always earn the top tier rate</b> (now <b style={{ color: t.text }}>{tierCfg.affiliate_pro_rate || 50}%</b>). Raise Pro and every chief&apos;s base moves up with it.</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: cardBd }}>
                <div className="py-5 px-5">
                  <div className="text-[14px] font-bold mb-1" style={{ color: t.text }}>Rules</div>
                  <div className="text-[12.5px] mb-4" style={{ color: t.textMuted }}>Thresholds for the whole program.</div>
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
