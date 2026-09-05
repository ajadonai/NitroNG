"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { SegPill } from "./seg-pill";
import { FilterDropdown } from "./date-range-picker";
import { SkelFacts, SkelList, SkelBar } from "./skeleton";
import { fN, fD } from "../lib/format";

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const CONFIRMS = {
  approve: { title: "Approve this member?", message: "They get their link and start earning on the customers they bring.", confirmLabel: "Approve" },
  reject: { title: "Reject this member?", message: "They will get an email saying no.", confirmLabel: "Reject", danger: true },
  suspend: { title: "Suspend this member?", message: "They lose access until they are reinstated.", confirmLabel: "Suspend", danger: true },
  reinstate: { title: "Reinstate this member?", message: "They get their access back.", confirmLabel: "Reinstate" },
  "promote-chief": { title: "Promote to chief?", message: "They will be able to run a team of their own.", confirmLabel: "Promote" },
  "demote-crew": { title: "Demote to crew?", message: "They lose their team and go back to being a crew member.", confirmLabel: "Demote", danger: true },
  delete: { title: "Delete this member?", message: "Their records are kept, but they are gone from the list.", confirmLabel: "Delete", danger: true },
};
const DONE = { approve: "Approved", reject: "Rejected", suspend: "Suspended", reinstate: "Reinstated", "update-tier": "Tier updated", "promote-chief": "Promoted", "demote-crew": "Demoted", "assign-team": "Assigned to team", "move-team": "Moved to new team", "unassign-team": "Removed from team", delete: "Deleted" };
const TABS = [["members", "Members"], ["payouts", "Payouts"], ["activity", "Activity"], ["settings", "Settings"]];

const tierOf = (m) => m.role === "chief" ? "chief" : (m.tier || "starter");

/* ── Member row ── */
function MemberRow({ m, busy, onOpen, onAct }) {
  const tier = tierOf(m);
  const st = m.status;
  const open = () => onOpen(m);
  const run = (e, action) => { e.stopPropagation(); onAct(action, m.id); };
  const buttons = st === "pending" ? [["approve", "Approve", "ok"], ["reject", "Reject", "bad"]] : st === "suspended" ? [["reinstate", "Reinstate", "ok"]] : st === "approved" ? [["suspend", "Suspend", "bad"]] : [];
  return (
    <div className={"cw-r" + (st === "suspended" ? " off" : "")} role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <span className="cw-n"><span className={`cw-av ${tier}`}>{initials(m.name)}</span><span className="cw-nt"><b>{m.name}</b><i>{m.email}{m.xHandle ? ` · @${m.xHandle}` : ""}</i></span></span>
      <span className="cw-chips"><span className={`cw-ty ${tier}`}>{tier}</span><span className={`cw-ty ${st}`}>{st}</span></span>
      <span className="cw-figs"><span className="cw-f m" data-l="Rate">{m.commissionRate}%</span><span className={"cw-f earn m" + ((m.totalEarned || 0) > 0 ? " pos" : "")} data-l="Earned">{fN(m.totalEarned || 0)}</span></span>
      <span className="cw-a">
        {buttons.map(([action, label, tone]) => <button key={action} type="button" className={`cw-b sm ${tone}`} disabled={busy === m.id} onClick={e => run(e, action)}>{label}</button>)}
        <span className="cw-ch">›</span>
      </span>
    </div>
  );
}

/* ── Settings helpers ── */
function SettingRow({ label, hint, children }) {
  return (
    <div className="cw-sr">
      <div className="cw-srt"><b>{label}</b>{hint && <i>{hint}</i>}</div>
      {children}
    </div>
  );
}

function SettingField({ k, unit, pre, disabled, val, tierCfg, setTierCfg }) {
  return (
    <div className={"cw-fld" + (disabled ? " off" : "")}>
      {pre && <span>{pre}</span>}
      <input type="number" min="0" className="m" value={val !== undefined ? val : (tierCfg[k] || "")} disabled={disabled} onChange={k ? e => setTierCfg(p => ({ ...p, [k]: e.target.value })) : undefined} />
      {unit && <span>{unit}</span>}
    </div>
  );
}

/* ── Main page ── */
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
  const [tierCfg, setTierCfg] = useState({ affiliate_enabled: "true", affiliate_starter_rate: "30", affiliate_growth_rate: "40", affiliate_pro_rate: "50", affiliate_growth_threshold: "50", affiliate_pro_threshold: "150", affiliate_lead_split: "40", affiliate_hold_days: "7", affiliate_min_payout: "5000", affiliate_min_order: "1000" });
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
      const res = await fetch("/api/admin/settings?keys=affiliate_enabled,affiliate_starter_rate,affiliate_growth_rate,affiliate_pro_rate,affiliate_growth_threshold,affiliate_pro_threshold,affiliate_lead_split,affiliate_hold_days,affiliate_min_payout,affiliate_min_order");
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
    if (tab !== "members") return;
    const iv = setInterval(load, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [tab, load]);

  const closeDrawer = useCallback(() => { setDrawerMember(null); setShowArchived(false); setShowTeamPicker(false); setTeamSearch(""); setShowPromoteForm(false); setPromoteTeamName(""); setEditingTeamName(false); setEditTeamName(""); }, []);

  useEffect(() => {
    if (!drawerMember) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [drawerMember, closeDrawer]);

  const act = async (action, memberId, extra = {}) => {
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
      toast.success(DONE[action] || "Done");
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
  const approvedCount = members.filter(m => m.status === "approved").length;
  const suspendedCount = members.filter(m => m.status === "suspended").length;
  const chiefCount = members.filter(m => m.status === "approved" && m.role === "chief").length;
  const pendingPayoutCount = payouts.filter(p => p.status === "pending").length;
  const waitingPayouts = payouts.length ? pendingPayoutCount : (stats.pendingPayouts || 0);

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

  const pendingRows = filtered.filter(m => m.status === "pending");
  const filteredPayouts = payoutFilter === "all" ? payouts : payouts.filter(p => p.status === payoutFilter);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const vars = {
    "--card": dark ? "#171126" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828", "--blue": dark ? "#a5b4fc" : "#4c62c4", "--in": dark ? "#160f22" : "#fff",
    "--cols": "minmax(0,1fr) 88px 96px 60px 110px 160px",
  };

  const renderRow = (m) => <MemberRow key={m.id} m={m} busy={busy} onOpen={setDrawerMember} onAct={act} />;

  const facts = (
    <div className="cw-stats">
      <div className="cw-stt"><b className="m">{approvedCount}</b><span>Members</span><i>{plural(chiefCount, "chief")}, {approvedCount - chiefCount} crew{suspendedCount ? `, ${suspendedCount} suspended` : ""}</i></div>
      <div className={"cw-stt" + (pendingCount ? " warn" : "")}><b className="m">{pendingCount}</b><span>Pending</span><i>{pendingCount ? "waiting for a yes or no" : "nobody waiting"}</i></div>
      <div className="cw-stt"><b className="m">{fN(stats.totalPaidOut || 0)}</b><span>Paid out</span><i>{waitingPayouts ? `${plural(waitingPayouts, "payout request")} waiting` : "no payout requests waiting"}</i></div>
      <div className="cw-stt"><b className="m">{fN(stats.heldAmount || 0)}</b><span>On hold</span><i>{stats.heldAmount ? "commissions still in the hold period" : "nothing on hold"}</i></div>
    </div>
  );

  return (
    <div className="cw" style={vars}>
      <style>{CW_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Crew</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Affiliates who bring customers to Nitro and earn a commission on what those customers spend.</div>
          </div>
          <SegPill value={tab} options={TABS.map(([value, label]) => ({ value, label: value === "payouts" && waitingPayouts ? `Payouts · ${waitingPayouts}` : label }))} onChange={setTab} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {!affiliateEnabled && <div className="cw-note warn"><b>Affiliate program paused</b><span>No new commissions are being created. Turn it back on in Settings.</span></div>}
      {moneyIssues.length > 0 && <div className="cw-note bad"><b>{plural(moneyIssues.length, "open money-path issue")}</b><span>{moneyIssues.map(i => i.title).join(", ")}</span></div>}

      {/* ═══ MEMBERS ═══ */}
      {tab === "members" && (loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} pills={3} right /><SkelList dark={dark} rows={6} title rowH={62} /></> : <>
        {facts}
        <div className="cw-bar">
          <label className="cw-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email or X handle" />
          </label>
          <FilterDropdown dark={dark} t={t} value={view} onChange={setView} options={[{ value: "team", label: "By team" }, { value: "flat", label: "All members" }]} />
          <FilterDropdown dark={dark} t={t} value={filter} onChange={setFilter} alert={pendingCount > 0 && filter === "all"} options={[{ value: "all", label: "Any status" }, { value: "pending", label: pendingCount ? `Pending · ${pendingCount}` : "Pending" }, { value: "approved", label: "Approved" }, { value: "suspended", label: "Suspended" }]} />
          <FilterDropdown dark={dark} t={t} value={sort} onChange={setSort} options={[{ value: "name", label: "By name" }, { value: "joined", label: "Newest first" }, { value: "earned", label: "Top earners" }]} />
          <span className="cw-count">{plural(filtered.length, "member")}{view === "team" ? ` across ${plural(teamGroups.groups.length, "team")}` : ""}</span>
        </div>

        <section className="cw-card">
          <header><h3>Members</h3><span className="cw-cnt">tap a member to see their details and act on them</span></header>
          {filtered.length === 0 ? <div className="cw-empty">No members match.</div> : <>
            <div className="cw-th"><span>Member</span><span>Tier</span><span>Status</span><span>Rate</span><span className="r">Earned</span><span /></div>
            {view === "team" ? <>
              {pendingRows.length > 0 && (
                <div>
                  <div className="cw-grp"><b>Pending</b><span className="cw-gm"><span className="cw-ty pending">{plural(pendingRows.length, "application")}</span></span></div>
                  {pendingRows.map(renderRow)}
                </div>
              )}
              {teamGroups.groups.map(({ chief, crew, totalEarned }) => (
                <div key={chief.id}>
                  <div className="cw-grp"><b>{chief.teamName || `${chief.name}'s team`}</b><span className="cw-gm"><span className="cw-ty">{crew.length} crew</span><span className="cw-ty m">{fN(totalEarned)}</span></span></div>
                  {renderRow(chief)}
                  {crew.map(renderRow)}
                </div>
              ))}
              {teamGroups.unassigned.length > 0 && (
                <div>
                  <div className="cw-grp"><b>Not on a team</b><span className="cw-gm"><span className="cw-ty">{teamGroups.unassigned.length}</span></span></div>
                  {teamGroups.unassigned.map(renderRow)}
                </div>
              )}
            </> : filtered.map(renderRow)}
          </>}
        </section>
      </>)}

      {/* ═══ PAYOUTS ═══ */}
      {tab === "payouts" && (loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} search={false} pills={1} right /><SkelList dark={dark} rows={5} title rowH={62} /></> : <>
        {facts}
        <div className="cw-bar">
          <FilterDropdown dark={dark} t={t} value={payoutFilter} onChange={setPayoutFilter} alert={pendingPayoutCount > 0 && payoutFilter === "all"} options={[{ value: "all", label: "Any status" }, { value: "pending", label: pendingPayoutCount ? `Pending · ${pendingPayoutCount}` : "Pending" }, { value: "processing", label: "Processing" }, { value: "completed", label: "Completed" }, { value: "rejected", label: "Rejected" }]} />
          <span className="cw-count">{plural(filteredPayouts.length, "payout request")}</span>
        </div>
        {payoutsLoading && payouts.length === 0 ? <SkelList dark={dark} rows={5} title rowH={62} /> : (
          <section className="cw-card" style={{ opacity: payoutsLoading ? .55 : 1 }}>
            <header><h3>Payouts</h3><span className="cw-cnt">tap a request to see bank details and settle it</span></header>
            {filteredPayouts.length === 0 ? <div className="cw-empty">No payout requests right now.</div> : filteredPayouts.map(p => {
              const on = expandedId === p.id;
              return (
                <div key={p.id} className={"cw-pw" + (on ? " on" : "")}>
                  <div className="cw-pr" role="button" tabIndex={0} onClick={() => setExpandedId(on ? null : p.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(on ? null : p.id); } }}>
                    <span className="cw-n"><span className={`cw-av ${p.status}`}>{initials(p.memberName)}</span><span className="cw-nt"><b>{p.memberName}</b><i>{p.memberEmail} · asked {fD(p.createdAt)}</i></span></span>
                    <span className={`cw-ty ${p.status}`}>{p.status}</span>
                    <span className="cw-f earn m">{fN(p.amount)}</span>
                    <span className="cw-ch" style={{ transform: on ? "rotate(90deg)" : "none" }}>›</span>
                  </div>
                  {on && (
                    <div className="cw-px">
                      <div className="cw-grid">
                        {[["Bank", p.bankName], ["Account number", p.bankAccountNo], ["Account name", p.bankAccountName]].map(([l, v]) => (
                          <div key={l} className={"cw-gi" + (v ? "" : " no")}><span>{l}</span><b>{v || "Not set"}</b></div>
                        ))}
                      </div>
                      {p.reference && <div className="cw-sub">Reference: <b>{p.reference}</b></div>}
                      {(p.status === "pending" || p.status === "processing") && (
                        <div className="cw-pa">
                          <input className="cw-in" value={refInput[p.id] || ""} onChange={e => setRefInput(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="Transfer reference (optional)" />
                          {p.status === "pending" && <button type="button" className="cw-b sm" disabled={busy === p.id} onClick={() => payoutAct("process", p.id)}>Mark processing</button>}
                          <button type="button" className="cw-b sm pri" disabled={busy === p.id} onClick={() => payoutAct("complete", p.id)}>Mark paid</button>
                          <button type="button" className="cw-b sm bad" disabled={busy === p.id} onClick={() => payoutAct("reject", p.id)}>Reject</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </>)}

      {/* ═══ ACTIVITY ═══ */}
      {tab === "activity" && (activityLoading && activityLogs.length === 0 ? <SkelList dark={dark} rows={6} title avatar={false} rowH={52} /> : (
        <section className="cw-card" style={{ opacity: activityLoading ? .55 : 1 }}>
          <header><h3>Activity</h3><span className="cw-cnt">what admins have done here, latest first</span></header>
          {activityLogs.length === 0 ? <div className="cw-empty">Nothing has happened here yet.</div> : activityLogs.map(log => (
            <div key={log.id} className="cw-lr"><b>{log.action}</b><i>{log.adminName} · {fD(log.createdAt)}</i></div>
          ))}
        </section>
      ))}

      {/* ═══ SETTINGS ═══ */}
      {tab === "settings" && (tierCfgLoading ? <div className="cw-set"><SkelList dark={dark} rows={1} title avatar={false} rowH={56} /><SkelList dark={dark} rows={4} title avatar={false} rowH={56} /><SkelList dark={dark} rows={2} title avatar={false} rowH={56} /></div> : (
        <div className="cw-set">
          <section className="cw-card">
            <div className="cw-sr">
              <div className="cw-srt"><b>Crew program</b><i>The master switch. When it is off, the apply page is hidden and no new commissions are created.</i></div>
              <button type="button" className={"cw-sw" + (tierCfg.affiliate_enabled === "true" ? " on" : "")} role="switch" aria-checked={tierCfg.affiliate_enabled === "true"} aria-label="Crew program" onClick={() => setTierCfg(p => ({ ...p, affiliate_enabled: p.affiliate_enabled === "true" ? "false" : "true" }))} />
            </div>
          </section>

          <section className="cw-card">
            <header><h3>Commission tiers</h3><span className="cw-cnt">the commission pot for each tier, as a % of every completed order</span></header>
            <SettingRow label="Starter" hint="0 to 49 active referred users"><SettingField k="affiliate_starter_rate" unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Growth" hint="50 to 149 active referred users"><SettingField k="affiliate_growth_rate" unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Pro" hint="150 or more active referred users"><SettingField k="affiliate_pro_rate" unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Chiefs' rate" hint="Chiefs always earn the top tier. Set automatically."><SettingField disabled val={tierCfg.affiliate_pro_rate || "50"} unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
          </section>

          <section className="cw-card">
            <header><h3>Team split</h3><span className="cw-cnt">when a chief hands a link to a crew member, how the pot divides between them</span></header>
            <SettingRow label="Chief's cut" hint="The chief's share of the pot on their crew's sales."><SettingField k="affiliate_lead_split" unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Crew's cut" hint="The rest of the pot. Worked out automatically."><SettingField disabled val={100 - (parseInt(tierCfg.affiliate_lead_split) || 40)} unit="%" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
          </section>

          <section className="cw-card">
            <header><h3>Tier thresholds</h3><span className="cw-cnt">active referred users (1+ completed order in the last 30 days) needed for each tier</span></header>
            <SettingRow label="Growth threshold" hint="Active users to move from Starter to Growth."><SettingField k="affiliate_growth_threshold" unit="users" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Pro threshold" hint="Active users to move from Growth to Pro."><SettingField k="affiliate_pro_threshold" unit="users" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
          </section>

          <section className="cw-card">
            <header><h3>Payouts and limits</h3><span className="cw-cnt">holds, minimums and caps for the whole program</span></header>
            <SettingRow label="Hold period" hint="Days a commission is held after an order completes before it can be paid."><SettingField k="affiliate_hold_days" unit="days" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Minimum payout" hint="The smallest amount a member can ask for."><SettingField k="affiliate_min_payout" pre="₦" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
            <SettingRow label="Minimum order to earn" hint="Orders below this earn no commission."><SettingField k="affiliate_min_order" pre="₦" tierCfg={tierCfg} setTierCfg={setTierCfg} /></SettingRow>
          </section>

          <div className="cw-save"><button type="button" className="cw-b pri" onClick={saveTierCfg} disabled={tierCfgSaving}>{tierCfgSaving ? "Saving…" : "Save settings"}</button></div>
        </div>
      ))}

      {/* ═══ MEMBER DRAWER ═══ */}
      {drawerMember && (() => {
        const dm = drawerMember;
        const isChief = dm.role === "chief";
        const isPending = dm.status === "pending";
        const isSuspended = dm.status === "suspended";
        const tier = tierOf(dm);
        const whatsappUrl = dm.phone ? `https://wa.me/${dm.phone.replace(/\D/g, "")}` : null;
        const chiefs = members.filter(m => m.role === "chief" && m.status === "approved");
        const currentChief = dm.leadId ? chiefs.find(c => c.id === dm.leadId) : null;

        const drawerAct = async (action, extra = {}) => {
          setBusy(dm.id);
          try {
            const res = await fetch("/api/admin/crew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId: dm.id, ...extra }) });
            const d = await res.json();
            if (d.error) { toast.error(d.error); return; }
            toast.success(DONE[action] || "Done");
            if (action === "delete" || action === "reject") closeDrawer();
            const freshList = await load();
            if (action !== "delete" && action !== "reject" && freshList) {
              const fresh = freshList.find(m => m.id === dm.id);
              if (fresh) setDrawerMember(fresh); else closeDrawer();
            }
          } catch (err) { console.error("drawerAct error:", err); toast.error(err?.message || "Something went wrong"); } finally { setBusy(null); }
        };

        const confirmAct = async (action, extra = {}) => {
          const cfg = CONFIRMS[action];
          if (cfg) { const ok = await confirm(cfg); if (!ok) return; }
          drawerAct(action, extra);
        };

        const saveTeamName = async () => {
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
        };

        const info = [
          ["Phone", dm.phone || "Not given", !!dm.phone],
          ["X handle", dm.xHandle ? `@${dm.xHandle}` : "Not given", !!dm.xHandle, dm.xHandle ? `https://x.com/${dm.xHandle}` : null],
          ["Telegram", dm.telegramHandle ? `@${dm.telegramHandle}` : "Not given", !!dm.telegramHandle, dm.telegramHandle ? `https://t.me/${dm.telegramHandle}` : null],
          ["Approved", dm.approvedAt ? fD(dm.approvedAt, true) : "Not yet", !!dm.approvedAt],
          ["Links", dm.links, true],
          ...(isChief ? [["Crew", dm.crewCount, true]] : [["Team", dm.leadName || "None", !!dm.leadName]]),
          ["Commissions", dm.commissions, true],
          ["Earned", fN(dm.totalEarned || 0), (dm.totalEarned || 0) > 0],
          ["Paid out", fN(dm.totalPaid || 0), (dm.totalPaid || 0) > 0],
        ];
        const otherChiefs = chiefs.filter(c => c.id !== dm.leadId);
        const q = teamSearch.toLowerCase();
        const pickable = otherChiefs.filter(c => !q || c.name.toLowerCase().includes(q));

        return (
          <div className="cw-bd" onClick={closeDrawer}>
            <aside className="cw-dw" role="dialog" aria-modal="true" aria-label={dm.name} onClick={e => e.stopPropagation()}>
              <div className="cw-dh">
                <span className={`cw-av lg ${tier}`}>{initials(dm.name)}</span>
                <div className="cw-dht">
                  <b>{dm.name}</b>
                  <i>{dm.email}{dm.phone ? ` · ${dm.phone}` : ""}</i>
                  <span className="cw-chips"><span className={`cw-ty ${tier}`}>{tier}</span><span className={`cw-ty ${dm.status}`}>{dm.status}</span><span className="cw-ty m">{dm.commissionRate}%</span></span>
                </div>
                <button type="button" className="cw-b sm" onClick={closeDrawer}>Close</button>
              </div>

              <div className="cw-body">
                {isPending && dm.whyApply && <blockquote className="cw-quote">&ldquo;{dm.whyApply}&rdquo;</blockquote>}

                <div className="cw-grid">
                  {info.map(([label, val, has, href]) => (
                    <div key={label} className={"cw-gi" + (has ? "" : " no")}>
                      <span>{label}</span>
                      {href ? <a href={href} target="_blank" rel="noopener noreferrer" title={val}>{val}</a> : <b>{val}</b>}
                    </div>
                  ))}
                </div>

                {showPromoteForm && (
                  <div className="cw-sec cw-box">
                    <div className="cw-sub" style={{ marginTop: 0 }}>Give the new team a name. It shows on the members list.</div>
                    <label className="cw-lbl">Team name</label>
                    <input className="cw-in" value={promoteTeamName} onChange={e => setPromoteTeamName(e.target.value)} placeholder="e.g. Alpha squad" maxLength={40} />
                    <div className="cw-row">
                      <button type="button" className="cw-b sm pri" disabled={busy === dm.id || !promoteTeamName.trim()} onClick={() => drawerAct("promote-chief", { teamName: promoteTeamName.trim() })}>{busy === dm.id ? "Promoting…" : "Promote to chief"}</button>
                      <button type="button" className="cw-b sm" onClick={() => { setShowPromoteForm(false); setPromoteTeamName(""); }}>Cancel</button>
                    </div>
                  </div>
                )}

                {isChief && !isPending && (
                  <div className="cw-sec">
                    <label className="cw-lbl">Team name</label>
                    {editingTeamName ? (
                      <div className="cw-row">
                        <input className="cw-in" value={editTeamName} onChange={e => setEditTeamName(e.target.value)} maxLength={40} />
                        <button type="button" className="cw-b sm pri" disabled={busy === dm.id || !editTeamName.trim()} onClick={saveTeamName}>Save</button>
                        <button type="button" className="cw-b sm" onClick={() => setEditingTeamName(false)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="cw-row"><b className="cw-val">{dm.teamName || `${dm.name}'s team`}</b><button type="button" className="cw-b sm" onClick={() => { setEditingTeamName(true); setEditTeamName(dm.teamName || `${dm.name}'s team`); }}>Rename</button></div>
                    )}
                  </div>
                )}

                {!isChief && !isPending && (
                  <div className="cw-sec">
                    <label className="cw-lbl">Team</label>
                    {currentChief ? (
                      <div className="cw-team">
                        <span className="cw-av chief">{initials(currentChief.name)}</span>
                        <span className="cw-nt"><b>{currentChief.teamName || `${currentChief.name}'s team`}</b><i>{plural(currentChief.crewCount, "crew member")}</i></span>
                        <button type="button" className="cw-b sm bad" disabled={busy === dm.id} onClick={() => drawerAct("unassign-team")}>Remove</button>
                      </div>
                    ) : <div className="cw-sub" style={{ marginTop: 0 }}>Not on any team.</div>}
                    {otherChiefs.length > 0 && (!showTeamPicker ? (
                      <button type="button" className="cw-b sm" style={{ marginTop: 8 }} onClick={() => setShowTeamPicker(true)}>{currentChief ? "Move to another team" : "Put on a team"}</button>
                    ) : (
                      <div className="cw-pick">
                        <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Search chiefs" />
                        {pickable.length === 0 ? <div className="cw-sub" style={{ padding: "10px 12px", margin: 0 }}>No chiefs match.</div> : pickable.map(chief => (
                          <button key={chief.id} type="button" className="cw-pk" disabled={busy === dm.id} onClick={() => drawerAct(dm.leadId ? "move-team" : "assign-team", { chiefId: chief.id })}>{chief.name}<i>{chief.teamName || `${chief.name}'s team`}</i></button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {dm.archivedLinks?.length > 0 && (
                  <div className="cw-sec">
                    <button type="button" className="cw-link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Hide" : "Show"} {plural(dm.archivedLinks.length, "archived link")}</button>
                    {showArchived && (
                      <div className="cw-arch">
                        {dm.archivedLinks.map(l => <div key={l.slug} className="cw-al"><span className="m">/{l.slug}</span><i>{fD(l.archivedAt)}</i></div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cw-df">
                {isPending && <>
                  <button type="button" className="cw-b sm ok" disabled={busy === dm.id} onClick={() => confirmAct("approve")}>Approve</button>
                  <button type="button" className="cw-b sm bad" disabled={busy === dm.id} onClick={() => confirmAct("reject")}>Reject</button>
                </>}
                {!isPending && whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="cw-b sm">WhatsApp</a>}
                {dm.status === "approved" && isChief && <button type="button" className="cw-b sm" disabled={busy === dm.id} onClick={() => confirmAct("demote-crew")}>Demote to crew</button>}
                {dm.status === "approved" && !isChief && !showPromoteForm && <button type="button" className="cw-b sm" onClick={() => { setShowPromoteForm(true); setPromoteTeamName(`${dm.name}'s team`); }}>Promote to chief</button>}
                {dm.status === "approved" && <button type="button" className="cw-b sm bad" disabled={busy === dm.id} onClick={() => confirmAct("suspend")}>Suspend</button>}
                {isSuspended && <button type="button" className="cw-b sm ok" disabled={busy === dm.id} onClick={() => confirmAct("reinstate")}>Reinstate</button>}
                {!isPending && <button type="button" className="cw-b sm bad" style={{ marginLeft: "auto" }} disabled={busy === dm.id} onClick={() => confirmAct("delete")}>Delete</button>}
              </div>
            </aside>
          </div>
        );
      })()}
    </div>
  );
}

const CW_CSS = `
.cw{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.cw *{box-sizing:border-box}
.cw .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.cw-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;transition:transform .15s}.cw-b:hover{transform:translateY(-1px)}.cw-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.cw-b.sm{height:30px;padding:0 10px;font-size:12px}.cw-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.cw-b.bad{color:var(--bad)}.cw-b.ok{color:var(--ok)}
.cw-note{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:11px 16px;border-radius:12px;border:1px solid;font-size:12.5px;color:var(--mut)}.cw-note b{font-size:13px;font-weight:600}
.cw-note.warn{border-color:color-mix(in srgb,var(--warn) 35%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}.cw-note.warn b{color:var(--warn)}
.cw-note.bad{border-color:color-mix(in srgb,var(--bad) 35%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent)}.cw-note.bad b{color:var(--bad)}
.cw-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.cw-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.cw-stt:first-child{border-left:0}
.cw-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.cw-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-stt.warn b{color:var(--warn)}
.cw-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cw-search{display:flex;align-items:center;gap:8px;flex:1;min-width:200px;max-width:340px;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--mut)}.cw-search:focus-within{border-color:var(--ac)}.cw-search input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:13.5px;color:var(--ink)}
.cw-count{margin-left:auto;font-size:12.5px;color:var(--mut);white-space:nowrap}
.cw-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.cw-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.cw-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700;white-space:nowrap}.cw-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.cw-th{display:grid;grid-template-columns:var(--cols);gap:12px;align-items:center;height:32px;padding:0 16px;background:var(--soft);border-bottom:1px solid var(--line);font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut)}.cw-th .r{text-align:right}
.cw-grp{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:12.5px;font-weight:600;color:var(--mut)}.cw-th+div>.cw-grp,.cw-card>header+div>.cw-grp{border-top:0}.cw-grp b{color:var(--ink);font-weight:700}.cw-gm{margin-left:auto;display:flex;gap:6px}
.cw-r{display:grid;grid-template-columns:var(--cols);align-items:center;gap:12px;min-height:62px;padding:10px 16px;border-top:1px solid var(--rail);cursor:pointer;outline:none;text-align:left}.cw-th+.cw-r,.cw-grp+.cw-r{border-top:0}.cw-r:hover,.cw-r:focus-visible{background:var(--soft)}.cw-r.off .cw-nt{opacity:.55}
.cw-n{display:flex;align-items:center;gap:10px;min-width:0}
.cw-av{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;color:var(--tc,var(--mut));background:color-mix(in srgb,var(--tc,var(--mut)) 14%,transparent);border:1px solid color-mix(in srgb,var(--tc,var(--mut)) 35%,transparent)}.cw-av.lg{width:48px;height:48px;font-size:16px}
.cw-nt{display:flex;flex-direction:column;min-width:0}.cw-nt b{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-nt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:999px;white-space:nowrap;display:inline-block;color:var(--tc,var(--mut));background:color-mix(in srgb,var(--tc,var(--mut)) 10%,transparent);border:1px solid color-mix(in srgb,var(--tc,var(--mut)) 40%,transparent)}
.cw-av.starter,.cw-ty.starter{--tc:var(--mut)}.cw-av.growth,.cw-ty.growth,.cw-av.processing,.cw-ty.processing{--tc:var(--blue)}.cw-av.pro,.cw-ty.pro,.cw-av.chief,.cw-ty.chief{--tc:var(--ac)}
.cw-av.pending,.cw-ty.pending{--tc:var(--warn)}.cw-av.approved,.cw-ty.approved,.cw-av.completed,.cw-ty.completed{--tc:var(--ok)}.cw-av.suspended,.cw-ty.suspended,.cw-av.rejected,.cw-ty.rejected{--tc:var(--bad)}
.cw-chips,.cw-figs{display:contents}
.cw-f{font-size:13px;color:var(--mut);white-space:nowrap}.cw-f.earn{font-size:14px;font-weight:700;color:var(--ink);text-align:right}.cw-f.earn.pos{color:var(--ok)}
.cw-a{display:flex;gap:6px;justify-content:flex-end;align-items:center}.cw-ch{color:var(--dim);font-size:18px;line-height:1;margin-left:4px;transition:transform .15s}
.cw-pw.on{background:var(--soft)}.cw-pr{display:grid;grid-template-columns:minmax(0,1fr) 100px 120px 20px;align-items:center;gap:12px;min-height:62px;padding:10px 16px;border-top:1px solid var(--rail);cursor:pointer;outline:none}.cw-card>header+.cw-pw .cw-pr{border-top:0}.cw-pr:hover,.cw-pr:focus-visible{background:var(--soft)}
.cw-px{padding:0 16px 14px}.cw-px .cw-grid{margin-bottom:10px}.cw-pa{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.cw-pa .cw-in{flex:1;min-width:180px;height:30px;font-size:12.5px}
.cw-lr{display:flex;flex-direction:column;gap:2px;padding:11px 16px;border-top:1px solid var(--rail)}.cw-card>header+.cw-lr{border-top:0}.cw-lr b{font-size:13px;font-weight:500}.cw-lr i{font-style:normal;font-size:11.5px;color:var(--dim)}
.cw-set{display:flex;flex-direction:column;gap:14px;max-width:620px}
.cw-sr{display:flex;align-items:center;gap:16px;padding:12px 16px;border-top:1px solid var(--rail)}.cw-card>header+.cw-sr,.cw-card>.cw-sr:first-child{border-top:0}.cw-srt{flex:1;min-width:0}.cw-srt b{display:block;font-size:13.5px;font-weight:600}.cw-srt i{display:block;font-style:normal;font-size:11.5px;color:var(--mut);margin-top:2px;line-height:1.4}
.cw-fld{display:flex;align-items:center;width:132px;height:36px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--in);flex-shrink:0}.cw-fld:focus-within{border-color:var(--ac)}.cw-fld.off{opacity:.6;background:var(--soft)}.cw-fld input{flex:1;min-width:0;width:100%;border:0;background:none;outline:none;font-size:14px;font-weight:600;color:var(--ink);padding:0 4px}.cw-fld span{font-size:12.5px;color:var(--mut)}
.cw-sw{position:relative;width:44px;height:24px;border-radius:12px;border:0;padding:0;cursor:pointer;background:var(--line);flex-shrink:0}.cw-sw.on{background:var(--ac)}.cw-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}.cw-sw.on::after{left:23px}
.cw-save{display:flex;justify-content:flex-end}
.cw-bd{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4)}
.cw-dw{position:absolute;top:0;right:0;bottom:0;width:460px;max-width:100%;background:var(--card);border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-12px 0 30px rgba(0,0,0,.2)}
.cw-dh{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}.cw-dht{flex:1;display:flex;flex-direction:column;min-width:0;gap:2px}.cw-dht b{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-dht i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-dht .cw-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.cw-body{flex:1;overflow:auto;padding:14px 18px 18px}
.cw-quote{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:var(--soft);border:1px solid var(--line);font-size:13px;line-height:1.5;color:var(--mut)}
.cw-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.cw-gi{padding:8px 10px;border-radius:9px;background:var(--soft);border:1px solid var(--line);min-width:0}.cw-gi span{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mut)}.cw-gi b,.cw-gi a{display:block;font-size:13px;font-weight:700;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-gi a{color:var(--ac);text-decoration:none}.cw-gi a:hover{text-decoration:underline}.cw-gi.no b{color:var(--dim);font-weight:500}
.cw-sec{margin-top:16px}.cw-box{padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--soft)}.cw-box .cw-lbl{margin-top:8px}
.cw-sub{font-size:12.5px;color:var(--mut);line-height:1.5;margin:8px 0 0}.cw-sub b{color:var(--ink);font-weight:600}
.cw-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:0 0 6px}
.cw-in{width:100%;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:13.5px;outline:none}.cw-in:focus{border-color:var(--ac)}
.cw-row{display:flex;align-items:center;gap:8px;margin-top:8px}.cw-row .cw-in{flex:1;min-width:0}.cw-val{flex:1;font-size:13.5px;font-weight:600}
.cw-team{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}.cw-team .cw-nt{flex:1}
.cw-pick{margin-top:8px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--in)}.cw-pick input{width:100%;height:36px;padding:0 12px;border:0;border-bottom:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:13px;outline:none}
.cw-pk{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:9px 12px;border:0;border-top:1px solid var(--rail);background:none;color:var(--ink);font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer}.cw-pick input+.cw-pk{border-top:0}.cw-pk i{font-style:normal;font-size:11.5px;font-weight:500;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-pk:hover{background:var(--soft)}.cw-pk:disabled{opacity:.5;cursor:not-allowed}
.cw-link{font:inherit;font-size:12.5px;font-weight:600;color:var(--mut);background:none;border:0;padding:0;cursor:pointer}.cw-link:hover{color:var(--ink)}
.cw-arch{display:flex;flex-direction:column;gap:4px;margin-top:8px}.cw-al{display:flex;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;background:var(--soft);border:1px solid var(--line);font-size:12px;color:var(--mut)}.cw-al i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap}
.cw-df{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:12px 18px;border-top:1px solid var(--line);background:var(--soft)}
@media (max-width:900px){
  .cw-stats{grid-template-columns:1fr 1fr}.cw-stt:nth-child(3){border-left:0}.cw-stt:nth-child(n+3){border-top:1px solid var(--line)}.cw-stt b{font-size:17px}
  .cw-search{max-width:none;flex-basis:100%}.cw-count{margin-left:0;flex-basis:100%}
  .cw-th{display:none}.cw-card>header+.cw-r,.cw-card>header+div>.cw-r:first-child{border-top:0}
  .cw-r{grid-template-columns:1fr;grid-template-areas:"n" "c" "f" "a";gap:8px;padding:12px 14px}.cw-r .cw-n{grid-area:n}
  .cw-r .cw-chips{grid-area:c;display:flex;gap:6px;flex-wrap:wrap;padding-left:44px}
  .cw-figs{grid-area:f;display:flex;gap:18px;padding-top:8px;border-top:1px solid var(--rail)}.cw-f::before{content:attr(data-l) " ";font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut)}.cw-f.earn{text-align:left}
  .cw-a{grid-area:a;justify-content:stretch}.cw-a .cw-b{flex:1;height:36px}.cw-r .cw-ch{display:none}
  .cw-pr{grid-template-columns:1fr auto;grid-template-areas:"n amt" "st st";gap:6px 10px;padding:12px 14px}.cw-pr .cw-n{grid-area:n}.cw-pr .cw-ty{grid-area:st;justify-self:start;margin-left:44px}.cw-pr .cw-f{grid-area:amt}.cw-pr .cw-ch{display:none}
  .cw-grid{grid-template-columns:1fr 1fr}
  .cw-sr{flex-direction:column;align-items:stretch;gap:8px}.cw-fld{width:100%}.cw-sr .cw-sw{align-self:flex-start}
  .cw-dw{width:100%;top:8vh;border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0}
}
`;
