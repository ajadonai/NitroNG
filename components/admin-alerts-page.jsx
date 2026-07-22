'use client';
import { useEffect, useState } from "react";
import { useConfirm } from "./confirm-dialog";
import { fD } from "../lib/format";

export function AdminAlertsPage({ dark, t }) {
  const confirm = useConfirm();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [newType, setNewType] = useState("info");
  const [newActionLabel, setNewActionLabel] = useState("");
  const [newActionHref, setNewActionHref] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createAlert = async (target) => {
    if (!newMsg.trim() || saving) return;
    setSaving(true);
    try {
      const body = { action: "create", message: newMsg, type: newType, target };
      if (newActionLabel.trim() && newActionHref.trim()) {
        body.actionLabel = newActionLabel;
        body.actionHref = newActionHref;
      }
      const res = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.alert) {
        setAlerts(prev => [data.alert, ...prev.map(a => {
          if (target === "everyone") return { ...a, active: false };
          if (a.target === target) return { ...a, active: false };
          return a;
        })]);
        setNewMsg(""); setCreating(null); setNewType("info"); setNewActionLabel(""); setNewActionHref("");
      }
    } catch {}
    setSaving(false);
  };

  const toggleAlert = async (id, active, target) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
      if (!active) {
        // Activating: if everyone → pause all others, otherwise pause same-target
        setAlerts(prev => prev.map(a => {
          if (a.id === id) return { ...a, active: true };
          if (target === "everyone") return { ...a, active: false };
          if (a.target === target && a.active) return { ...a, active: false };
          return a;
        }));
      } else {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
      }
    } catch {}
  };

  const deleteAlert = async (id) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const typeColors = { info: t.accent, warning: dark ? "#fbbf24" : "#d97706", success: dark ? "#6ee7b7" : "#059669", urgent: dark ? "#fca5a5" : "#dc2626" };
  const typeIcons = {
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    urgent: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };
  const typeSvgs = {
    info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    warning: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    urgent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };

  const [histPage, setHistPage] = useState({});
  const getActive = (target) => alerts.find(a => a.target === target && a.active);
  const getHistory = (target) => alerts.filter(a => a.target === target && !a.active);
  const everyoneActive = getActive("everyone");

  const renderSlotCard = (target, title, desc, isOverride) => {
    const active = getActive(target);
    const history = getHistory(target);
    const isCreating = creating === target;
    const cardBorder = isOverride ? (dark ? "rgba(251,191,36,.24)" : "rgba(217,119,6,.19)") : t.cardBorder;
    const cardBg = isOverride ? (dark ? "rgba(251,191,36,.03)" : "rgba(217,119,6,.02)") : (dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)");
    const inputBg = dark ? "#131728" : "#fff";

    return (
        <div key={target} className="set-card" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: isOverride ? (dark ? "#fbbf24" : "#d97706") : t.textMuted }}>{isOverride ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>{" "}</> : ""}{title}</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>{desc}</div>
          </div>
          <div className="set-card-body">

          {active ? (
            <>
              <div className="flex items-center gap-2.5 py-3 px-3.5 rounded-[10px] mb-3" style={{
                background: dark ? `${typeColors[active.type]}15` : `${typeColors[active.type]}08`,
                border: `1px solid ${dark ? `${typeColors[active.type]}40` : `${typeColors[active.type]}30`}`,
                borderLeft: `3px solid ${typeColors[active.type]}`,
              }}>
                <span className="shrink-0" style={{ color: typeColors[active.type] }}>{typeIcons[active.type] || typeIcons.info}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: t.text }}>
                    {active.message.split(/(\*[^*]+\*)/).map((p, i) => p.startsWith('*') && p.endsWith('*') ? <strong key={i}>{p.slice(1, -1)}</strong> : p)}
                    {active.actionLabel && active.actionHref && <span className="text-xs font-semibold ml-1.5" style={{ color: typeColors[active.type] }}>{active.actionLabel}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-semibold py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669" }}>Live</span>
                    {active.created && <span className="text-[11px]" style={{ color: t.textMuted }}>{fD(active.created)}</span>}
                  </div>
                </div>
              </div>
              <div className={`flex gap-1.5 flex-wrap ${history.length > 0 ? "mb-3" : ""}`}>
                <button onClick={() => toggleAlert(active.id, true, target)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(251,191,36,.24)" : "rgba(217,119,6,.19)", color: dark ? "#fbbf24" : "#d97706" }}>Pause</button>
                <button onClick={async () => { const ok = await confirm({ title: "Delete Alert", message: `Delete "${active.message?.slice(0, 50)}..."?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(active.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); setNewActionLabel(""); setNewActionHref(""); }} className="adm-btn-sm ml-auto" style={{ borderColor: t.cardBorder, color: t.accent }}>+ New</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.textMuted }} />
              <span className="text-[13px]" style={{ color: t.textMuted }}>No active alert</span>
              <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); setNewActionLabel(""); setNewActionHref(""); }} className="adm-btn-primary ml-auto text-xs py-1.5 px-3.5">+ Create</button>
            </div>
          )}

          {isCreating && (
            <div className="mt-2 pt-3" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              {active && (
                <div className="flex items-center gap-2 text-xs mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(251,191,36,.06)" : "rgba(217,119,6,.04)", color: dark ? "#fbbf24" : "#d97706" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Current alert will be auto-paused when you create a new one.
                </div>
              )}
              <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="What do you want to announce?" rows={3} className="w-full py-2.5 px-3.5 rounded-lg border text-sm outline-none resize-y font-[inherit] box-border mb-1.5" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
              <div className="text-[11px] mb-3" style={{ color: t.textMuted }}>Wrap text in <code className="py-0.5 px-1 rounded text-[10px]" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" }}>*asterisks*</code> for <strong>bold</strong></div>
              <div className="flex gap-2 mb-3">
                <input value={newActionLabel} onChange={e => setNewActionLabel(e.target.value)} placeholder="Link text (optional)" className="flex-1 py-2 px-3 rounded-lg border text-[13px] outline-none font-[inherit] box-border" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
                <input value={newActionHref} onChange={e => setNewActionHref(e.target.value)} placeholder="URL, e.g. /services" className="flex-[2] py-2 px-3 rounded-lg border text-[13px] outline-none font-[inherit] box-border" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
              </div>
              <div className="flex gap-1.5 mb-3">
                {[["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["urgent", "Urgent"]].map(([ty, label]) => (
                  <button key={ty} onClick={() => setNewType(ty)} className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border font-[inherit] transition-transform duration-150 hover:-translate-y-px flex items-center justify-center gap-1.5" style={{
                    borderColor: newType === ty ? typeColors[ty] : t.cardBorder,
                    background: newType === ty ? (dark ? `${typeColors[ty]}15` : `${typeColors[ty]}08`) : "transparent",
                    color: newType === ty ? typeColors[ty] : t.textMuted,
                  }}><span style={{ color: newType === ty ? typeColors[ty] : t.textMuted }}>{typeSvgs[ty]}</span> {label}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => createAlert(target)} disabled={!newMsg.trim() || saving} className="adm-btn-primary flex-1 text-[13px]" style={{ opacity: newMsg.trim() && !saving ? 1 : .4 }}>{saving ? "Creating..." : isOverride ? "Create override" : "Create alert"}</button>
                <button onClick={() => setCreating(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
          )}

          {history.length > 0 && (() => {
            const PER_PAGE = 3;
            const page = histPage[target] || 0;
            const totalPages = Math.ceil(history.length / PER_PAGE);
            const slice = history.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
            return (
            <>
              <div className="flex items-center gap-2 mt-3.5 mb-2">
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase py-1 px-2 rounded" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)" }}>History</div>
                {totalPages > 1 && <span className="text-[11px] ml-auto" style={{ color: t.textMuted }}>{page + 1}/{totalPages}</span>}
              </div>
              {slice.map(a => (
                <div key={a.id} className="flex items-center gap-2 py-2 text-[13px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.05)"}` }}>
                  <span className="shrink-0" style={{ color: typeColors[a.type] || t.textMuted }}>{typeSvgs[a.type] || typeSvgs.info}</span>
                  <span className="flex-1 truncate" style={{ color: t.textMuted }}>{a.message}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleAlert(a.id, false, target)} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669" }}>Reactivate</button>
                    <button onClick={async () => { const ok = await confirm({ title: "Delete", message: `Delete this alert?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.24)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-1.5 mt-2">
                  <button onClick={() => setHistPage(p => ({ ...p, [target]: Math.max(0, page - 1) }))} disabled={page === 0} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 0 ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button onClick={() => setHistPage(p => ({ ...p, [target]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages - 1 ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </>
            );
          })()}
          </div>
        </div>
    );
  };

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Announcements</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div><div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[60px] rounded-[10px] mb-2`} />)}</div></>;

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>Announcements</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage banners for each audience independently</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {everyoneActive && (
        <div className="text-xs mb-2 flex items-center gap-1.5" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Everyone override is active — individual slot alerts are hidden while this is live.
        </div>
      )}

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
        {renderSlotCard("everyone", "Everyone override", "Overrides all slots. Shows on landing page, user dashboard, and admin panel simultaneously.", true)}
        {renderSlotCard("landing", "Landing page", "Shown to visitors on the landing page before they log in.")}
        {renderSlotCard("users", "Users", "Shown to logged-in users across all dashboard pages.")}
        {renderSlotCard("admin", "Admin", "Internal notes shown only in the admin panel.")}
      </div>
    </>
  );
}

