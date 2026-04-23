'use client';
import { useState, useEffect } from "react";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";

const TABS = [
  { id: "spenders", label: "Top Spenders" },
  { id: "referrers", label: "Top Referrers" },
  { id: "active", label: "Most Active" },
];

export default function AdminLeaderboardPage({ dark, t }) {
  const [view, setView] = useState("leaderboard");
  const [tab, setTab] = useState("spenders");
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardModal, setRewardModal] = useState(null);
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardMsg, setRewardMsg] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [massModal, setMassModal] = useState(false);
  const [massAmount, setMassAmount] = useState("");
  const [massNote, setMassNote] = useState("");
  const [massLoading, setMassLoading] = useState(false);
  const [massMsg, setMassMsg] = useState(null);
  const [massProgress, setMassProgress] = useState(null);
  const [autoModal, setAutoModal] = useState(false);
  const [autoConfig, setAutoConfig] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoMsg, setAutoMsg] = useState(null);
  const [annoText, setAnnoText] = useState("");
  const [annoEnabled, setAnnoEnabled] = useState(false);
  const [annoSaving, setAnnoSaving] = useState(false);
  const [annoMsg, setAnnoMsg] = useState(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/leaderboard?period=${period}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.rewardAnnouncement) { setAnnoText(d.rewardAnnouncement.text || ""); setAnnoEnabled(d.rewardAnnouncement.enabled ?? false); }
        if (d.autoReward) setAutoConfig(d.autoReward);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(load, [period]);

  const list = data?.[tab] || [];
  const toggleSelect = (uid) => { setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; }); };
  const selectTop = (n) => setSelected(new Set(list.slice(0, n).map(e => e.userId)));
  const clearSel = () => setSelected(new Set());

  const doReward = async () => {
    const amt = Number(rewardAmount);
    if (!amt || amt <= 0 || !rewardModal) return;
    setRewardLoading(true); setRewardMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reward", userId: rewardModal.userId, amount: amt, note: rewardNote || `Leaderboard reward — ₦${amt.toLocaleString()}` }) });
      const d = await res.json();
      if (!res.ok) setRewardMsg({ type: "error", text: d.error }); else { setRewardMsg({ type: "success", text: d.message }); setRewardAmount(""); setRewardNote(""); load(); }
    } catch { setRewardMsg({ type: "error", text: "Failed" }); }
    setRewardLoading(false);
  };

  const doMassReward = async () => {
    const amt = Number(massAmount);
    if (!amt || amt <= 0 || selected.size === 0) return;
    setMassLoading(true); setMassMsg(null); setMassProgress({ done: 0, total: selected.size });
    let done = 0, failed = 0;
    for (const uid of selected) {
      try {
        const res = await fetch("/api/admin/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reward", userId: uid, amount: amt, note: massNote || `Leaderboard reward (${tab}) — ₦${amt.toLocaleString()}` }) });
        if (res.ok) done++; else failed++;
      } catch { failed++; }
      setMassProgress({ done: done + failed, total: selected.size });
    }
    setMassMsg({ type: failed === 0 ? "success" : "error", text: `${done} rewarded${failed > 0 ? `, ${failed} failed` : ""}` });
    setMassLoading(false); setMassProgress(null); setSelected(new Set()); load();
  };

  const saveAnno = async () => {
    setAnnoSaving(true); setAnnoMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_announcement", announcement: { text: annoText, enabled: annoEnabled } }) });
      const d = await res.json();
      setAnnoMsg(d.success ? { type: "success", text: "Saved" } : { type: "error", text: d.error });
    } catch { setAnnoMsg({ type: "error", text: "Failed" }); }
    setAnnoSaving(false);
  };

  const saveAuto = async () => {
    setAutoSaving(true); setAutoMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_auto_reward", config: autoConfig }) });
      const d = await res.json();
      setAutoMsg(d.success ? { type: "success", text: "Saved" } : { type: "error", text: d.error });
    } catch { setAutoMsg({ type: "error", text: "Failed" }); }
    setAutoSaving(false);
  };

  const periodLabel = period === "month" ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "All time";
  const inpCls = "w-full py-[9px] px-3 rounded-lg text-[13px] outline-none font-[inherit]";
  const inp = { border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text };
  const cardCls = "rounded-xl p-4 mb-4 border";
  const card = { borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" };
  const pillCls = "py-[5px] px-3.5 rounded-[20px] text-[13px] font-medium cursor-pointer font-[inherit]";
  const pill = (on) => ({ border: `1px solid ${on ? t.accent : t.cardBorder}`, color: on ? t.accent : t.textMuted, background: on ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent" });
  const smBtnCls = "py-1 px-2.5 rounded-md text-[11px] cursor-pointer font-[inherit]";
  const smBtn = { border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft };
  const gradBtnCls = "py-[5px] px-3.5 rounded-lg border-none text-xs font-semibold cursor-pointer font-[inherit]";
  const gradBtn = { background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff" };
  const presetBtnCls = "flex-1 py-[5px] rounded-md text-xs cursor-pointer font-[inherit]";
  const presetBtn = (on) => ({ border: `1px solid ${on ? t.accent : t.cardBorder}`, background: on ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: on ? t.accent : t.textMuted });
  const msgBoxCls = "py-2 px-3 rounded-lg mb-3 text-[13px]";
  const msgBox = (type) => ({ background: type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), border: `1px solid ${type === "success" ? (dark ? "rgba(110,231,183,.2)" : "#a7f3d0") : (dark ? "rgba(220,38,38,.2)" : "#fecaca")}` });
  const modalOvrCls = "fixed inset-0 z-50 flex items-center justify-center p-6";
  const modalOvr = { background: "rgba(0,0,0,.4)" };
  const modalBoxCls = "rounded-2xl p-6 w-full max-w-[420px]";
  const modalBox = { background: dark ? "#0e1120" : "#fff", border: `1px solid ${t.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" };

  const ddCls = "py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]";
  const ddStyle = { backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" };

  return (
    <>
      {/* Header */}
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Leaderboard</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{view === "settings" ? "Announcement & reward settings" : `Top users · ${periodLabel}`}</div>
          </div>
          <SegPill value={view} options={[{value: "settings", label: "Settings"}, {value: "leaderboard", label: "Leaderboard"}]} onChange={setView} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ SETTINGS TAB ═══ */}
      {view === "settings" && <>
        {/* Announcement */}
        <div className={cardCls} style={card}>
          <div className="text-xs font-semibold uppercase tracking-[1.2px] mb-2" style={{ color: t.textMuted }}>Reward Announcement</div>
          <input value={annoText} onChange={e => setAnnoText(e.target.value)} placeholder="🎁 Top 3 spenders this month win bonus credits!" className={`${inpCls} mb-2`} style={inp} />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-[5px] text-xs cursor-pointer" style={{ color: t.textMuted }}><input type="checkbox" checked={annoEnabled} onChange={e => setAnnoEnabled(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> Show on leaderboard</label>
            <button onClick={saveAnno} disabled={annoSaving} className={smBtnCls} style={{ ...smBtn, borderColor: t.accent, color: t.accent }}>{annoSaving ? "..." : "Save"}</button>
            {annoMsg && <span className="text-[11px]" style={{ color: annoMsg.type === "success" ? t.green : t.red }}>{annoMsg.text}</span>}
          </div>
        </div>

        {/* Auto-reward */}
        <div className={cardCls} style={card}>
          <div className="flex justify-between items-center">
            <div className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: t.textMuted }}>Auto-Reward (Monthly)</div>
            <button onClick={() => { if (!autoConfig) setAutoConfig({ enabled: false, category: "spenders", slots: [{ rank: 1, amount: 5000 }, { rank: 2, amount: 3000 }, { rank: 3, amount: 1000 }] }); setAutoModal(!autoModal); }} className={smBtnCls} style={smBtn}>{autoModal ? "Close" : "Configure"}</button>
          </div>
          {autoConfig && !autoModal && <div className="text-[13px] mt-1.5" style={{ color: autoConfig.enabled ? t.green : t.textMuted }}>{autoConfig.enabled ? `Active — ${autoConfig.category}, top ${autoConfig.slots?.length || 0} rewarded monthly` : "Disabled"}</div>}
          {autoModal && autoConfig && (
            <div className="mt-2.5">
              <label className="flex items-center gap-1.5 text-[13px] mb-2.5 cursor-pointer" style={{ color: t.textMuted }}><input type="checkbox" checked={autoConfig.enabled} onChange={e => setAutoConfig({ ...autoConfig, enabled: e.target.checked })} style={{ accentColor: "#c47d8e" }} /> Enable auto-reward</label>
              <div className="mb-2.5">
                <label className="text-xs block mb-1" style={{ color: t.textMuted }}>Category</label>
                <select value={autoConfig.category} onChange={e => setAutoConfig({ ...autoConfig, category: e.target.value })} className={`${inpCls} w-auto`} style={inp}><option value="spenders">Top Spenders</option><option value="referrers">Top Referrers</option><option value="active">Most Active</option></select>
              </div>
              <div className="text-xs mb-1.5" style={{ color: t.textMuted }}>Reward per rank</div>
              {(autoConfig.slots || []).map((slot, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[13px] w-10" style={{ color: t.textMuted }}>#{slot.rank}</span>
                  <input type="number" value={slot.amount} onChange={e => { const s = [...autoConfig.slots]; s[i] = { ...slot, amount: Number(e.target.value) }; setAutoConfig({ ...autoConfig, slots: s }); }} className={`${inpCls} w-[100px]`} style={inp} />
                  <span className="text-xs" style={{ color: t.textMuted }}>₦</span>
                  <button onClick={() => setAutoConfig({ ...autoConfig, slots: autoConfig.slots.filter((_, j) => j !== i) })} className="bg-transparent border-none text-sm cursor-pointer" style={{ color: t.red }}>✕</button>
                </div>
              ))}
              <button onClick={() => setAutoConfig({ ...autoConfig, slots: [...(autoConfig.slots || []), { rank: (autoConfig.slots?.length || 0) + 1, amount: 1000 }] })} className="text-xs bg-transparent border-none cursor-pointer font-[inherit] py-1" style={{ color: t.accent }}>+ Add slot</button>
              <div className="flex gap-2 mt-3">
                <button onClick={saveAuto} disabled={autoSaving} className={gradBtnCls} style={gradBtn}>{autoSaving ? "Saving..." : "Save Config"}</button>
                {autoMsg && <span className="text-xs self-center" style={{ color: autoMsg.type === "success" ? t.green : t.red }}>{autoMsg.text}</span>}
              </div>
            </div>
          )}
        </div>
      </>}

      {/* ═══ LEADERBOARD TAB ═══ */}
      {view === "leaderboard" && <>
        {/* Filters + mass actions */}
        <div className="flex gap-2 mb-4 items-center flex-wrap justify-end">
          <select value={tab} onChange={e => { setTab(e.target.value); clearSel(); }} className={ddCls} style={ddStyle}>
            {TABS.map(tb => <option key={tb.id} value={tb.id}>{tb.label}</option>)}
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value)} className={ddCls} style={ddStyle}>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div className="flex gap-2 mb-4 items-center flex-wrap justify-end">
          {list.length > 0 && <>
            <button onClick={() => selectTop(3)} className={smBtnCls} style={smBtn}>Top 3</button>
            <button onClick={() => selectTop(5)} className={smBtnCls} style={smBtn}>Top 5</button>
            <button onClick={() => selectTop(10)} className={smBtnCls} style={smBtn}>Top 10</button>
            {selected.size > 0 && <>
              <button onClick={clearSel} className={smBtnCls} style={smBtn}>Clear</button>
              <button onClick={() => { setMassModal(true); setMassMsg(null); }} className={gradBtnCls} style={gradBtn}>Reward {selected.size} users</button>
            </>}
          </>}
        </div>

      {/* Table */}
      {loading ? <div>{[1,2,3,4,5,6].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-12 rounded-lg mb-1.5`} />)}</div> : list.length === 0 ? (
        <div className="py-[60px] px-5 text-center">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
            <rect x="6" y="28" width="14" height="24" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
            <rect x="25" y="12" width="14" height="40" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
            <rect x="44" y="20" width="14" height="32" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
          </svg>
          <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No leaderboard data yet</div>
          <div className="text-sm" style={{ color: t.textMuted }}>Rankings will appear once users start placing orders</div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" }}>
          <div className="flex py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px] gap-3 items-center" style={{ color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}` }}>
            <span className="w-6"></span><span className="w-[30px]">#</span><span className="flex-1">User</span>
            {tab === "spenders" && <><span className="w-[90px] text-right">Spend</span><span className="w-[70px] text-right">Profit</span><span className="w-[50px] text-right">Orders</span></>}
            {tab === "referrers" && <span className="w-[70px] text-right">Refs</span>}
            {tab === "active" && <><span className="w-[60px] text-right">Orders</span><span className="w-[90px] text-right">Spend</span></>}
            <span className="w-[70px]"></span>
          </div>
          {list.map((e, i) => {
            const sel = selected.has(e.userId);
            return (
              <div key={e.userId} className="flex items-center py-2.5 px-4 gap-3" style={{ borderBottom: i < list.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: sel ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)") : i < 3 ? (dark ? "rgba(255,255,255,.015)" : "rgba(0,0,0,.01)") : "transparent" }}>
                <input type="checkbox" checked={sel} onChange={() => toggleSelect(e.userId)} className="w-4 h-4 cursor-pointer" style={{ accentColor: "#c47d8e" }} />
                <span className="w-[30px] text-sm font-bold text-center" style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : t.textMuted }}>{i < 3 ? ["🥇","🥈","🥉"][i] : e.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: t.text }}>{e.name || `${e.firstName} ${e.lastName}`}</div>
                  <div className="text-xs" style={{ color: t.textMuted }}>{e.email}</div>
                </div>
                {tab === "spenders" && <><span className="m w-[90px] text-right text-[13px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(e.spend)}</span><span className="m w-[70px] text-right text-xs" style={{ color: t.textMuted }}>{fN(e.profit)}</span><span className="w-[50px] text-right text-[13px]" style={{ color: t.textMuted }}>{e.orders}</span></>}
                {tab === "referrers" && <span className="w-[70px] text-right text-sm font-semibold" style={{ color: dark ? "#e0a458" : "#d97706" }}>{e.referrals}</span>}
                {tab === "active" && <><span className="w-[60px] text-right text-sm font-semibold" style={{ color: dark ? "#a5b4fc" : "#4f46e5" }}>{e.orders}</span><span className="m w-[90px] text-right text-xs" style={{ color: t.textMuted }}>{fN(e.spend)}</span></>}
                <div className="w-[70px] text-right">
                  <button onClick={() => { setRewardModal({ userId: e.userId, name: e.name || `${e.firstName} ${e.lastName}`, email: e.email }); setRewardMsg(null); }} className="py-1 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer font-[inherit] bg-transparent" style={{ border: `1px solid ${t.accent}`, color: t.accent }}>Reward</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>}

      {/* Single reward modal */}
      {rewardModal && (
        <div onClick={() => setRewardModal(null)} onKeyDown={e=>{if(e.key==='Escape')setRewardModal(null)}} className={modalOvrCls} style={modalOvr}>
          <div role="dialog" aria-modal="true" aria-label="Reward user" onClick={e => e.stopPropagation()} className={modalBoxCls} style={modalBox}>
            <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Reward User</div>
            <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>{rewardModal.name} · {rewardModal.email}</div>
            <div className="mb-3">
              <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Amount (₦)</label>
              <input type="number" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} placeholder="5000" className={inpCls} style={{ ...inp, fontSize: 15 }} />
              <div className="flex gap-1 mt-1.5">{[1000,2000,3000,5000,10000].map(q => <button key={q} onClick={() => setRewardAmount(String(q))} className={presetBtnCls} style={presetBtn(rewardAmount === String(q))}>{fN(q)}</button>)}</div>
            </div>
            <div className="mb-4">
              <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Note (optional)</label>
              <input value={rewardNote} onChange={e => setRewardNote(e.target.value)} placeholder="Leaderboard reward — Top spender" className={inpCls} style={{ ...inp, fontSize: 14 }} />
            </div>
            {rewardMsg && <div className={msgBoxCls} style={msgBox(rewardMsg.type)}>{rewardMsg.text}</div>}
            <div className="flex max-md:flex-col gap-2">
              <button onClick={() => setRewardModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer font-[inherit] bg-transparent" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>Cancel</button>
              <button onClick={doReward} disabled={!rewardAmount || Number(rewardAmount) <= 0 || rewardLoading} className="flex-1 py-2.5 rounded-lg border-none text-sm cursor-pointer font-[inherit]" style={{ ...gradBtn, opacity: !rewardAmount || Number(rewardAmount) <= 0 || rewardLoading ? .5 : 1 }}>{rewardLoading ? "Sending..." : `Send ${rewardAmount ? fN(Number(rewardAmount)) : "₦0"}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mass reward modal */}
      {massModal && (
        <div onClick={() => { if (!massLoading) setMassModal(false); }} onKeyDown={e=>{if(e.key==='Escape'&&!massLoading)setMassModal(false)}} className={modalOvrCls} style={modalOvr}>
          <div role="dialog" aria-modal="true" aria-label="Mass reward" onClick={e => e.stopPropagation()} className={modalBoxCls} style={modalBox}>
            <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Reward {selected.size} Users</div>
            <div className="text-[13px] mb-1.5" style={{ color: t.textMuted }}>Each user receives the same amount</div>
            <div className="text-xs mb-3.5 py-2 px-2.5 rounded-lg max-h-20 overflow-auto" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>
              {list.filter(e => selected.has(e.userId)).map(e => e.name || e.email).join(", ")}
            </div>
            <div className="mb-3">
              <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Amount per user (₦)</label>
              <input type="number" value={massAmount} onChange={e => setMassAmount(e.target.value)} placeholder="5000" className={inpCls} style={{ ...inp, fontSize: 15 }} />
              <div className="flex gap-1 mt-1.5">{[1000,2000,3000,5000,10000].map(q => <button key={q} onClick={() => setMassAmount(String(q))} className={presetBtnCls} style={presetBtn(massAmount === String(q))}>{fN(q)}</button>)}</div>
              {massAmount && <div className="text-xs mt-1.5" style={{ color: t.accent }}>Total: {fN(Number(massAmount) * selected.size)} (₦{Number(massAmount).toLocaleString()} × {selected.size})</div>}
            </div>
            <div className="mb-4">
              <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Note (optional)</label>
              <input value={massNote} onChange={e => setMassNote(e.target.value)} placeholder="Monthly leaderboard reward" className={inpCls} style={{ ...inp, fontSize: 14 }} />
            </div>
            {massProgress && <div className="text-[13px] mb-2.5" style={{ color: t.accent }}>Processing {massProgress.done}/{massProgress.total}...</div>}
            {massMsg && <div className={msgBoxCls} style={msgBox(massMsg.type)}>{massMsg.text}</div>}
            <div className="flex max-md:flex-col gap-2">
              <button onClick={() => setMassModal(false)} disabled={massLoading} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer font-[inherit] bg-transparent" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>Cancel</button>
              <button onClick={doMassReward} disabled={!massAmount || Number(massAmount) <= 0 || massLoading} className="flex-1 py-2.5 rounded-lg border-none text-sm cursor-pointer font-[inherit]" style={{ ...gradBtn, opacity: !massAmount || Number(massAmount) <= 0 || massLoading ? .5 : 1 }}>{massLoading ? "Processing..." : `Send to ${selected.size} users`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══ RIGHT SIDEBAR — Recent Rewards ═══ */
export function AdminLeaderboardSidebar({ dark, t }) {
  const [rewards, setRewards] = useState([]);
  useEffect(() => {
    fetch("/api/admin/leaderboard?period=all").then(r => r.json()).then(d => setRewards(d.rewards || [])).catch(() => {});
  }, []);

  return (
    <>
      <div className="adm-rs-title" style={{ color: t.textMuted }}>Recent Rewards</div>
      {rewards.length > 0 ? rewards.slice(0, 8).map((r, i) => (
        <div key={r.id} className="py-2 px-1" style={{ borderBottom: i < Math.min(rewards.length, 8) - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none" }}>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>+{fN(r.amount)}</span>
            <span className="text-[11px]" style={{ color: t.textMuted }}>{r.date ? new Date(r.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}</span>
          </div>
          <div className="text-[13px] mt-px" style={{ color: t.text }}>{r.user?.name || "Unknown"}</div>
          <div className="text-[11px] mt-px" style={{ color: t.textMuted }}>{r.note}</div>
        </div>
      )) : <div className="text-[13px] py-2 px-1" style={{ color: t.textMuted }}>No rewards yet</div>}
    </>
  );
}
