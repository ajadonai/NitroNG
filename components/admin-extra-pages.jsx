'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";


const ROLE_COLORS = { superadmin: "#c47d8e", admin: "#a5b4fc", support: "#6ee7b7", finance: "#fcd34d" };

/* ═══════════════════════════════════════════ */
/* ═══ ACTIVITY LOG                        ═══ */
/* ═══════════════════════════════════════════ */
export function AdminActivityPage({ dark, t }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/activity").then(r => r.json()).then(d => { setLogs(d.activity || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const typeLabels = { user: "Users", order: "Orders", alert: "Alerts", blog: "Blog", coupon: "Coupons", settings: "Settings", service: "Services", payment: "Payments", reward: "Rewards", leaderboard_reward: "Rewards", leaderboard_announcement: "Rewards", auto_reward_config: "Rewards", team: "Team", admin: "Admin", ticket: "Tickets", maintenance: "Maintenance" };
  const getTypeLabel = (type) => {
    if (!type) return "Other";
    if (typeLabels[type]) return typeLabels[type];
    if (type.startsWith("Rewarded") || type.startsWith("Updated auto-reward") || type.startsWith("Updated leaderboard")) return "Rewards";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  const groupedTypes = {};
  logs.forEach(l => { const label = getTypeLabel(l.type); groupedTypes[label] = (groupedTypes[label] || 0) + 1; });
  const typeEntries = Object.entries(groupedTypes).sort((a, b) => b[1] - a[1]);
  const filtered = filter === "all" ? logs : logs.filter(l => getTypeLabel(l.type) === filter);

  const typeColor = (type) => {
    if (type === "order") return t.blue;
    if (type === "credit" || type === "deposit") return t.green;
    if (type === "admin" || type === "maintenance") return t.amber;
    if (type === "notification") return t.accent;
    return t.textMuted;
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Admin Logs</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin audit trail — {logs.length} entries</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-filters flex justify-end">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        }}>
          <option value="all">All ({logs.length})</option>
          {typeEntries.map(([label, count]) => <option key={label} value={label}>{label} ({count})</option>)}
        </select>
      </div>

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-10 rounded-md mb-1.5`} />)}</div>
        ) : filtered.length > 0 ? filtered.map((l, i) => (
          <div key={l.id || i} className="adm-list-row" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: typeColor(l.type) }} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-[450]" style={{ color: t.text }}>{l.action}</div>
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
      </div>
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
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text };

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Team</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{admins.length} members · Manage roles, permissions & passwords</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowGuide(!showGuide); if (!showGuide) setShowAdd(false); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>{showGuide ? "Hide Guide" : "Role Guide"}</button>
            {canManage && <button onClick={() => { setShowAdd(!showAdd); if (!showAdd) setShowGuide(false); }} className="adm-btn-primary">{showAdd ? "Cancel" : "+ Add Admin"}</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      {showGuide && (
        <div className="adm-card p-[18px] mt-4 mb-4 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
          <div className="text-[15px] font-semibold mb-3.5" style={{ color: t.text }}>Role Permissions</div>
          {Object.entries(ROLE_INFO).map(([role, info], idx, arr) => (
            <div key={role} className={`flex gap-3 items-start ${idx < arr.length - 1 ? "mb-3 pb-3" : ""}`} style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <span className="text-xs py-0.5 px-2 rounded font-semibold capitalize shrink-0" style={{ background: `${info.color}20`, color: info.color }}>{role === "owner" ? "👑 owner" : role}</span>
              <span className="text-sm leading-normal" style={{ color: t.textMuted }}>{info.desc}</span>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="adm-card p-[18px] mt-4 mb-4 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-sm block mb-1" style={{ color: t.textMuted }}>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className={inputCls} style={inputStyle} /></div>
            <div><label className="text-sm block mb-1" style={{ color: t.textMuted }}>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@nitro.ng" type="email" className={inputCls} style={inputStyle} /></div>
            <div><label className="text-sm block mb-1" style={{ color: t.textMuted }}>Password</label><input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Password" type="password" className={inputCls} style={inputStyle} /></div>
            <div><label className="text-sm block mb-1" style={{ color: t.textMuted }}>Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] capitalize bg-no-repeat bg-[position:right_8px_center]" style={{
                backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
                border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
                color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
              }}>
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button onClick={createAdmin} disabled={saving} className="adm-btn-primary" style={{ opacity: newName && newEmail && newPw && !saving ? 1 : .4 }}>{saving ? "Creating..." : "Create Admin"}</button>
        </div>
      )}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, marginTop: showAdd || showGuide ? 0 : 16 }}>
        {loading ? <div className="adm-empty">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[52px] rounded-lg mb-1.5`} />)}</div> : admins.map((a, i) => {
          const owner = a.role === "owner";
          const ri = ROLE_INFO[a.role] || { color: "#888" };
          const expanded = expandedId === a.id && !owner && canManage;
          const hasCustom = a.customPages !== null && !owner && a.role !== "superadmin";
          const pages = expanded && localPages !== null ? localPages : (a.customPages || DEFAULT_PAGES[a.role] || []);

          return (
            <div key={a.id} style={{ borderBottom: i < admins.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { if (!owner && canManage) { if (expanded) { setExpandedId(null); } else { setExpandedId(a.id); setPermTab("permissions"); setResetPw(""); setLocalPages(null); setLocalActions(null); } } }} className="py-3 px-4 flex justify-between items-center gap-2.5 flex-wrap" style={{ cursor: owner || !canManage ? "default" : "pointer", background: expanded ? (dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.02)") : "transparent" }}>
                <div className="flex items-center gap-2.5 flex-1 min-w-[180px]">
                  <div className="adm-user-avatar" style={{ background: ri.color }}>{(a.name || "A")[0]}</div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[15px] font-medium" style={{ color: t.text }}>{a.name}</span>
                      <span className="text-xs py-px px-1.5 rounded font-semibold capitalize" style={{ background: `${ri.color}20`, color: ri.color }}>{a.role}</span>
                      {owner && <span className="text-[11px]">👑</span>}
                      {hasCustom && <span className="text-[11px] py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", color: t.accent }}>custom</span>}
                      {a.status !== "Active" && <span className="text-xs py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}>Inactive</span>}
                    </div>
                    <div className="text-sm mt-px" style={{ color: t.textMuted }}>{a.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px]" style={{ color: t.textMuted }}>{a.lastActive ? fD(a.lastActive) : "Never"}</span>
                  {owner ? <span className="text-[13px] italic" style={{ color: t.textMuted }}>Protected</span> : canManage ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" className="transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9" /></svg> : null}
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4" style={{ background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)" }}>
                  <div className="flex gap-1 mb-3.5 rounded-lg p-0.5" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
                    {[["permissions","🔐 Permissions"],["password","🔑 Password"],["role","🏷️ Role"]].map(([id, label]) => (
                      <button key={id} onClick={e => { e.stopPropagation(); setPermTab(id); }} className="flex-1 py-[7px] rounded-md text-[13px] border-none cursor-pointer" style={{ fontWeight: permTab === id ? 600 : 430, background: permTab === id ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : "transparent", color: permTab === id ? t.accent : t.textMuted }}>{label}</button>
                    ))}
                  </div>

                  {permTab === "permissions" && (a.role !== "superadmin" ? (
                    <div>
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-[13px]" style={{ color: t.textSoft }}>{pages.length} of {ALL_PAGES.length} pages enabled</span>
                        {(localPages !== null || a.customPages !== null) && <button onClick={e => { e.stopPropagation(); setLocalPages(null); act({ action: "updatePermissions", adminId: a.id, pages: null }).then(() => toast.success("Reset to default", "")); }} className="text-xs bg-none border-none cursor-pointer underline" style={{ color: t.textMuted }}>Reset to default</button>}
                      </div>
                      {PAGE_GROUPS.map(group => (
                        <div key={group} className="mb-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: t.accent }}>{group}</div>
                          <div className="grid grid-cols-3 gap-1">
                            {ALL_PAGES.filter(p => p.g === group).map(page => {
                              const enabled = pages.includes(page.id);
                              const defEnabled = (DEFAULT_PAGES[a.role] || []).includes(page.id);
                              const customized = (localPages !== null || a.customPages !== null) && enabled !== defEnabled;
                              return (
                                <button key={page.id} onClick={e => { e.stopPropagation(); const next = enabled ? pages.filter(p => p !== page.id) : [...pages, page.id]; setLocalPages(next); }} className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-left cursor-pointer" style={{ borderColor: enabled ? t.accent : t.cardBorder, background: enabled ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent" }}>
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
                      <div className="mt-4 pt-3.5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: t.textMuted }}>Action Permissions</div>
                        <div className="text-xs mb-2.5 leading-normal" style={{ color: t.textMuted }}>Grant specific abilities beyond page access.</div>
                        {ACTION_GROUPS.map(group => (
                          <div key={group} className="mb-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: t.accent }}>{group}</div>
                            <div className="grid grid-cols-2 gap-1">
                              {GRANTABLE_ACTIONS.filter(ga => ga.g === group).map(ga => {
                                const parsed = localActions !== null ? localActions : parseActions(a.customActions);
                                const on = parsed.includes(ga.id);
                                return (
                                  <button key={ga.id} onClick={e => { e.stopPropagation(); const cur = localActions !== null ? localActions : parseActions(a.customActions); setLocalActions(on ? cur.filter(x => x !== ga.id) : [...cur, ga.id]); }} className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-left cursor-pointer" style={{ borderColor: on ? t.accent : t.cardBorder, background: on ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent" }}>
                                    <div className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${on ? t.accent : t.textMuted}`, background: on ? t.accent : "transparent" }}>
                                      {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                    </div>
                                    <span className="text-xs" style={{ color: on ? t.text : t.textMuted, fontWeight: on ? 500 : 400 }}>{ga.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button onClick={e => { e.stopPropagation(); const savePages = act({ action: "updatePermissions", adminId: a.id, pages: localPages || pages }); const saveActions = localActions !== null ? act({ action: "updateActions", adminId: a.id, actions: localActions }) : Promise.resolve(true); Promise.all([savePages, saveActions]).then(([p, ac]) => { if (p && ac !== false) { toast.success("Permissions saved", ""); setLocalPages(null); setLocalActions(null); } }); }} disabled={saving} className="adm-btn-primary w-full mt-2" style={{ opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Permissions"}</button>
                    </div>
                  ) : <div className="py-4 text-center text-[13px]" style={{ color: t.textMuted }}>Superadmin has full access. No customization needed.</div>)}

                  {permTab === "password" && (
                    <div>
                      <div className="text-sm mb-3 leading-relaxed" style={{ color: t.textMuted }}>Set a new password for <strong style={{ color: t.text }}>{a.name}</strong>.</div>
                      <div className="mb-3">
                        <label className="text-xs font-semibold block mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>New Password</label>
                        <input type="password" placeholder="Min. 6 characters" value={resetPw} onChange={e => setResetPw(e.target.value)} onClick={e => e.stopPropagation()} className={inputCls} style={inputStyle} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); act({ action: "resetPassword", adminId: a.id, newPassword: resetPw }).then(ok => { if (ok) { toast.success("Password reset", a.name); setResetPw(""); } }); }} disabled={resetPw.length < 6 || saving} className="adm-btn-primary w-full" style={{ opacity: resetPw.length >= 6 && !saving ? 1 : .4 }}>{saving ? "Resetting..." : "Reset Password"}</button>
                    </div>
                  )}

                  {permTab === "role" && (
                    <div>
                      <div className="text-sm mb-3 leading-relaxed" style={{ color: t.textMuted }}>Change <strong style={{ color: t.text }}>{a.name}</strong>'s role. Custom permissions are preserved.</div>
                      <div className="flex gap-1.5 mb-3.5 flex-wrap">
                        {ASSIGNABLE_ROLES.map(r => {
                          const ri2 = ROLE_INFO[r]; const active = a.role === r;
                          return <button key={r} onClick={e => { e.stopPropagation(); act({ action: "updateRole", adminId: a.id, role: r }).then(ok => { if (ok) toast.success("Role updated", `${a.name} is now ${r}`); }); }} className="py-2 px-4 rounded-lg border text-sm cursor-pointer capitalize" style={{ borderColor: active ? ri2.color : t.cardBorder, background: active ? `${ri2.color}15` : "transparent", color: active ? ri2.color : t.textMuted, fontWeight: active ? 600 : 430 }}>{r}</button>;
                        })}
                      </div>
                      <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: a.status === "Active" ? "Deactivate Admin" : "Activate Admin", message: a.status === "Active" ? `Deactivate ${a.name}?` : `Reactivate ${a.name}?`, confirmLabel: a.status === "Active" ? "Deactivate" : "Activate", danger: a.status === "Active" }); if (ok) { const r = await act({ action: "toggleStatus", adminId: a.id }); if (r) toast.success("Status changed", `${a.name} ${r.status === "Active" ? "activated" : "deactivated"}`); } }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: a.status === "Active" ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{a.status === "Active" ? "Deactivate" : "Activate"}</button>
                      <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: "Delete Admin", message: `Permanently delete ${a.name}? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) { const r = await act({ action: "delete", adminId: a.id }); if (r) toast.success("Admin deleted", a.name); } }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
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
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expires: "" });

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
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...form, value: Number(form.value), minOrder: Number(form.minOrder) || 0, maxUses: Number(form.maxUses) || 0 }) });
      if (res.ok) { setShowAdd(false); setForm({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expires: "" }); fetch("/api/admin/coupons").then(r => r.json()).then(d => setCoupons(d.coupons || [])); }
    } catch {}
  };

  const deleteCoupon = async (id) => {
    try {
      await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text };
  const numInputCls = "py-[9px] px-3 rounded-lg border-solid text-[15px] outline-none text-right w-20";
  const numInput = { background: dark ? "rgba(255,255,255,.04)" : "#fff", borderWidth: "0.5px", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", color: t.text, fontFamily: "'JetBrains Mono',monospace" };
  const cardBg = dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`;
  const divBg = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Rewards</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage referrals, coupons, and loyalty program</div>
          </div>
          <div className="flex gap-1">
            {[["referrals", "Referrals"], ["coupons", "Coupons"], ["loyalty", "Loyalty"]].map(([id, label]) => (
              <button key={id} onClick={() => setRewardsTab(id)} className="py-2 px-5 rounded-lg text-[13px] cursor-pointer font-[inherit]" style={{ fontWeight: rewardsTab === id ? 600 : 400, background: rewardsTab === id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: rewardsTab === id ? t.accent : t.textMuted, border: `1px solid ${rewardsTab === id ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}` }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ REFERRAL TAB ═══ */}
      {rewardsTab === "referrals" && (
      <div className="adm-card p-5 mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Referral program</div>
        <div className="set-card-divider" style={{ background: divBg }} />

        <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.03)", color: t.textMuted }}>
          When a user shares their referral code and someone signs up with it, both receive wallet credit after the new user verifies their email.
        </div>

        {refMsg && <div className="py-2 px-3.5 rounded-lg mb-3 text-[13px]" style={{ background: refMsg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: refMsg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{refMsg.ok ? "✓" : "⚠️"} {refMsg.text}</div>}

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Referral program</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Enable or disable the entire system</div></div>
          <div role="switch" aria-checked={refEnabled} aria-label="Referral program" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setRefEnabled(!refEnabled)} className="w-[44px] h-6 rounded-xl relative cursor-pointer shrink-0" style={{ background: refEnabled ? "#c47d8e" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)") }}>
            <div className="w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: refEnabled ? 23 : 3 }} />
          </div>
        </div>

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Referrer bonus</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Amount credited to the person who shared the code</div></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm" style={{ color: t.textMuted }}>₦</span>
            <input value={refReferrer} onChange={e => setRefReferrer(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={numInputCls} style={numInput} />
          </div>
        </div>

        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
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
      )}

      {/* ═══ COUPONS TAB ═══ */}
      {rewardsTab === "coupons" && (
      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="flex justify-between items-center pt-4 px-4">
          <div>
            <div className="set-card-title mb-0.5" style={{ color: t.textMuted }}>Coupons</div>
            <div className="text-[13px]" style={{ color: t.textSoft }}>Promo codes users can apply when funding their wallet</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>{showAdd ? "Cancel" : "+ New"}</button>
        </div>
        <div className="h-px mt-3" style={{ background: divBg }} />

        {showAdd && (
          <div className="p-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} placeholder="WELCOME20" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
                  backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
                  border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
                  color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                }}>
                  <option value="percent">% Bonus</option>
                  <option value="fixed">₦ Bonus</option>
                </select>
              </div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Value</label><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === "percent" ? "20" : "500"} className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Min Deposit (₦)</label><input type="number" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} placeholder="0" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Max Uses (0 = unlimited)</label><input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="0" className={inputCls} style={inputStyle} /></div>
              <div><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Expires</label><input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} className={inputCls} style={inputStyle} /></div>
            </div>
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
                {!c.enabled && <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textMuted }}>Disabled</span>}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>
                Min: {c.minOrder ? `₦${c.minOrder.toLocaleString()}` : "None"} · Uses: {c.used || 0}/{c.maxUses || "∞"} · {c.expires ? `Exp: ${c.expires}` : "No expiry"}
              </div>
            </div>
            <button onClick={async () => { const ok = await confirm({ title: "Delete Coupon", message: `Delete coupon "${c.code}"? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) deleteCoupon(c.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
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
      <div className="adm-card p-5 mb-5" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-title" style={{ color: t.textMuted }}>Loyalty program</div>
        <div className="set-card-divider" style={{ background: divBg }} />

        <div className="py-2.5 px-3.5 rounded-lg text-[13px] leading-relaxed mb-4 border-l-[3px] border-l-[#c47d8e]" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.03)", color: t.textMuted }}>
          Users earn tiers based on total lifetime spend. Each tier grants an automatic discount on future orders.
        </div>

        {loyaltyMsg && <div className="py-2 px-3.5 rounded-lg mb-3 text-[13px]" style={{ background: loyaltyMsg.ok ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: loyaltyMsg.ok ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{loyaltyMsg.ok ? "✓" : "⚠️"} {loyaltyMsg.text}</div>}

        <div className="flex items-center justify-between py-3 mb-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
          <div><div className="text-sm font-medium" style={{ color: t.text }}>Loyalty program</div><div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Enable automatic tier-based discounts</div></div>
          <div role="switch" aria-checked={loyaltyEnabled} aria-label="Loyalty program" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setLoyaltyEnabled(!loyaltyEnabled)} className="w-[44px] h-6 rounded-xl relative cursor-pointer shrink-0" style={{ background: loyaltyEnabled ? "#c47d8e" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)") }}>
            <div className="w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-[left] duration-200" style={{ left: loyaltyEnabled ? 23 : 3 }} />
          </div>
        </div>

        {loyaltyTiers.map((tier, idx) => (
          <div key={idx} className="p-4 rounded-[10px] border mb-4" style={{ borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", borderLeft: `3px solid ${tier.color}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
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
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Email Blasts</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Send email blasts to users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Compose */}
      <div className="adm-card p-[18px] mt-4 mb-5 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        <div className="text-base font-semibold mb-3" style={{ color: t.text }}>Compose Notification</div>
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
              backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
              border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
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

      {/* History */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        <div className="flex items-center justify-between pt-4 px-4 pb-0">
          <div className="adm-card-title" style={{ color: t.textMuted }}>Sent history</div>
          {history.length > 0 && <button onClick={async () => { const ok = await confirm({ title: "Clear History", message: "Clear all notification history? This cannot be undone.", confirmLabel: "Clear", danger: true }); if (ok) { fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearHistory: true }) }).then(r => r.json()).then(() => setHistory([])).catch(() => {}); } }} className="bg-transparent border-none text-[12px] cursor-pointer font-[inherit]" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Clear all</button>}
        </div>
        <div className="adm-card-divider mt-3" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
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
          <div className="rounded-2xl border p-6 mb-5" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div className="mb-6">
              <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Platform Status</div>
              <div className="text-[15px]" style={{ color: t.textMuted }}>{enabled ? "⚠️ Platform is currently offline" : "✅ Platform is online and operational"}</div>
            </div>

            {/* Duration presets */}
            <div className="text-[13px] font-semibold uppercase tracking-widest mb-3" style={{ color: t.textMuted }}>Estimated Duration</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map(p => {
                const active = !useCustom && duration === p.m;
                return (<button key={p.m} onClick={() => { setDuration(p.m); setUseCustom(false); }} className="py-2.5 rounded-[10px] text-sm font-semibold text-center border cursor-pointer" style={{ borderColor: active ? t.accent : t.cardBorder, background: active ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: active ? t.accent : t.textSoft }}>{p.label}</button>);
              })}
            </div>
            <button onClick={() => setUseCustom(!useCustom)} className="text-[15px] font-medium bg-none cursor-pointer" style={{ color: useCustom ? t.accent : t.textSoft, marginBottom: useCustom ? 12 : 0 }}>{useCustom ? "▾ Custom duration" : "▸ Custom duration"}</button>
            {useCustom && (
              <div className="flex gap-2.5 items-center">
                <div className="flex-1"><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Hours</label><input type="number" min="0" max="72" value={customH} onChange={e => setCustomH(e.target.value)} placeholder="0" className="w-full py-2.5 px-3.5 rounded-[10px] border text-base font-semibold outline-none text-center" style={{ background: dark ? "#0d1020" : "#fff", borderColor: t.cardBorder, color: t.text }} /></div>
                <span className="text-xl mt-4" style={{ color: t.textMuted }}>:</span>
                <div className="flex-1"><label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Minutes</label><input type="number" min="0" max="59" value={customM} onChange={e => setCustomM(e.target.value)} placeholder="0" className="w-full py-2.5 px-3.5 rounded-[10px] border text-base font-semibold outline-none text-center" style={{ background: dark ? "#0d1020" : "#fff", borderColor: t.cardBorder, color: t.text }} /></div>
                <div className="flex-1 text-sm mt-4" style={{ color: t.textMuted }}>= {(Number(customH) || 0) * 60 + (Number(customM) || 0)} min</div>
              </div>
            )}
          </div>

          {/* Message card */}
          <div className="rounded-2xl border p-6 mb-5" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div className="text-[13px] font-semibold uppercase tracking-widest mb-2" style={{ color: t.textMuted }}>Maintenance Message</div>
            <div className="text-sm mb-2.5" style={{ color: t.textMuted }}>This is what users will see on the maintenance page</div>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} className="w-full py-3 px-3.5 rounded-xl border outline-none text-[15px] font-[inherit] leading-relaxed resize-y" style={{ background: dark ? "#0d1020" : "#fff", borderColor: t.cardBorder, color: t.text }} />
          </div>

          {/* Action */}
          <button onClick={async () => { const ok = await confirm({ title: enabled ? "Bring Platform Online" : "Take Platform Offline", message: enabled ? "Bring the platform back online for all users?" : "This will take the platform offline. All users will see a maintenance page.", confirmLabel: enabled ? "Go Online" : "Take Offline", danger: !enabled }); if (ok) save(!enabled); }} className="w-full py-3.5 rounded-xl text-base font-semibold border-none cursor-pointer" style={{ background: enabled ? (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)") : `linear-gradient(135deg,#c47d8e,#8b5e6b)`, color: enabled ? t.green : "#fff", boxShadow: enabled ? "none" : "0 4px 16px rgba(196,125,142,.25)" }}>{enabled ? "🟢 Bring Platform Online" : "🔴 Take Platform Offline"}</button>
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
      const data = await res.json();
      if (res.ok) {
        setResult({ id: provider.id, type: "success", message: `Synced! ${data.created} new, ${data.updated} updated, ${data.skipped} skipped (${data.total} total)` });
        loadData(); // Refresh counts
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

      <div className="py-3 px-4 rounded-[10px] mt-4 mb-4 text-sm leading-relaxed" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}`, color: t.textSoft }}>
        API keys are configured via environment variables for security. Add them in your <strong style={{ color: t.text }}>.env</strong> file locally or in <strong style={{ color: t.text }}>Vercel → Settings → Environment Variables</strong> for production.
      </div>

      <div>
        {PROVIDERS.map((p, i) => {
          const configured = envStatus[p.id] || false;
          const pResult = result?.id === p.id ? result : null;

          return (
            <div key={p.id} className="adm-card p-[18px] mb-3 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
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

              {pResult && (
                <div className="mt-2.5 py-2 px-3 rounded-lg text-[13px]" style={{ background: pResult.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: pResult.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>
                  {pResult.type === "success" ? "✓" : "⚠️"} {pResult.message}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mt-3.5 pt-3.5 text-[13px]" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                <div><span style={{ color: t.textMuted }}>Env var:</span> <span style={{ color: t.textSoft }}>{p.envKey}</span></div>
                <div><span style={{ color: t.textMuted }}>Services:</span> <span style={{ color: t.text }}>{(svcCounts[p.id] || 0).toLocaleString()}</span></div>
                <div><span style={{ color: t.textMuted }}>Priority:</span> <span style={{ color: t.text }}>{i + 1}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
