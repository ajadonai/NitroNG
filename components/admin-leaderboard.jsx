'use client';
import { useState, useEffect } from "react";
import { fN, fD } from "../lib/format";

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
  const inp = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const card = { borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" };
  const pill = (on) => ({ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: `1px solid ${on ? t.accent : t.cardBorder}`, color: on ? t.accent : t.textMuted, background: on ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent", cursor: "pointer", fontFamily: "inherit" });
  const smBtn = { padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, fontSize: 11, cursor: "pointer", fontFamily: "inherit" };
  const gradBtn = { padding: "5px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  const presetBtn = (on) => ({ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 12, border: `1px solid ${on ? t.accent : t.cardBorder}`, background: on ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: on ? t.accent : t.textMuted, cursor: "pointer", fontFamily: "inherit" });
  const msgBox = (type) => ({ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), border: `1px solid ${type === "success" ? (dark ? "rgba(110,231,183,.2)" : "#a7f3d0") : (dark ? "rgba(220,38,38,.2)" : "#fecaca")}` });
  const modalOvr = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
  const modalBox = { background: dark ? "#0e1120" : "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, border: `1px solid ${t.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" };

  const viewStyle = (id) => ({ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: view === id ? 600 : 400, background: view === id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: view === id ? t.accent : t.textMuted, border: `1px solid ${view === id ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}`, cursor: "pointer", fontFamily: "inherit" });
  const ddStyle = { padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", appearance: "none", cursor: "pointer", fontFamily: "inherit", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" };

  return (
    <div style={{ padding: "24px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: t.text, marginBottom: 2 }}>Leaderboard</div>
            <div style={{ fontSize: 14, color: t.textMuted }}>{view === "settings" ? "Announcement & reward settings" : `Top users · ${periodLabel}`}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setView("settings")} style={viewStyle("settings")}>Settings</button>
            <button onClick={() => setView("leaderboard")} style={viewStyle("leaderboard")}>Leaderboard</button>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder, marginTop: 12 }} />
      </div>

      {/* ═══ SETTINGS TAB ═══ */}
      {view === "settings" && <>
        {/* Announcement */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: t.textMuted, marginBottom: 8 }}>Reward Announcement</div>
          <input value={annoText} onChange={e => setAnnoText(e.target.value)} placeholder="🎁 Top 3 spenders this month win bonus credits!" style={{ ...inp, marginBottom: 8 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, cursor: "pointer" }}><input type="checkbox" checked={annoEnabled} onChange={e => setAnnoEnabled(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> Show on leaderboard</label>
            <button onClick={saveAnno} disabled={annoSaving} style={{ ...smBtn, borderColor: t.accent, color: t.accent }}>{annoSaving ? "..." : "Save"}</button>
            {annoMsg && <span style={{ fontSize: 11, color: annoMsg.type === "success" ? t.green : t.red }}>{annoMsg.text}</span>}
          </div>
        </div>

        {/* Auto-reward */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: t.textMuted }}>Auto-Reward (Monthly)</div>
            <button onClick={() => { if (!autoConfig) setAutoConfig({ enabled: false, category: "spenders", slots: [{ rank: 1, amount: 5000 }, { rank: 2, amount: 3000 }, { rank: 3, amount: 1000 }] }); setAutoModal(!autoModal); }} style={smBtn}>{autoModal ? "Close" : "Configure"}</button>
          </div>
          {autoConfig && !autoModal && <div style={{ fontSize: 13, color: autoConfig.enabled ? t.green : t.textMuted, marginTop: 6 }}>{autoConfig.enabled ? `Active — ${autoConfig.category}, top ${autoConfig.slots?.length || 0} rewarded monthly` : "Disabled"}</div>}
          {autoModal && autoConfig && (
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: t.textMuted, marginBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={autoConfig.enabled} onChange={e => setAutoConfig({ ...autoConfig, enabled: e.target.checked })} style={{ accentColor: "#c47d8e" }} /> Enable auto-reward</label>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Category</label>
                <select value={autoConfig.category} onChange={e => setAutoConfig({ ...autoConfig, category: e.target.value })} style={{ ...inp, width: "auto" }}><option value="spenders">Top Spenders</option><option value="referrers">Top Referrers</option><option value="active">Most Active</option></select>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>Reward per rank</div>
              {(autoConfig.slots || []).map((slot, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: t.textMuted, width: 40 }}>#{slot.rank}</span>
                  <input type="number" value={slot.amount} onChange={e => { const s = [...autoConfig.slots]; s[i] = { ...slot, amount: Number(e.target.value) }; setAutoConfig({ ...autoConfig, slots: s }); }} style={{ ...inp, width: 100 }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>₦</span>
                  <button onClick={() => setAutoConfig({ ...autoConfig, slots: autoConfig.slots.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: t.red, fontSize: 14, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <button onClick={() => setAutoConfig({ ...autoConfig, slots: [...(autoConfig.slots || []), { rank: (autoConfig.slots?.length || 0) + 1, amount: 1000 }] })} style={{ fontSize: 12, color: t.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>+ Add slot</button>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={saveAuto} disabled={autoSaving} style={gradBtn}>{autoSaving ? "Saving..." : "Save Config"}</button>
                {autoMsg && <span style={{ fontSize: 12, color: autoMsg.type === "success" ? t.green : t.red, alignSelf: "center" }}>{autoMsg.text}</span>}
              </div>
            </div>
          )}
        </div>
      </>}

      {/* ═══ LEADERBOARD TAB ═══ */}
      {view === "leaderboard" && <>
        {/* Filters + mass actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }} />
          <select value={tab} onChange={e => { setTab(e.target.value); clearSel(); }} style={ddStyle}>
            {TABS.map(tb => <option key={tb.id} value={tb.id}>{tb.label}</option>)}
          </select>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={ddStyle}>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {list.length > 0 && <>
            <button onClick={() => selectTop(3)} style={smBtn}>Top 3</button>
            <button onClick={() => selectTop(5)} style={smBtn}>Top 5</button>
            <button onClick={() => selectTop(10)} style={smBtn}>Top 10</button>
            {selected.size > 0 && <>
              <button onClick={clearSel} style={smBtn}>Clear</button>
              <button onClick={() => { setMassModal(true); setMassMsg(null); }} style={gradBtn}>Reward {selected.size} users</button>
            </>}
          </>}
        </div>

      {/* Table */}
      {loading ? <div>{[1,2,3,4,5,6].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 48, borderRadius: 8, marginBottom: 6 }} />)}</div> : list.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>No data for this period</div> : (
        <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" }}>
          <div style={{ display: "flex", padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}`, gap: 12, alignItems: "center" }}>
            <span style={{ width: 24 }}></span><span style={{ width: 30 }}>#</span><span style={{ flex: 1 }}>User</span>
            {tab === "spenders" && <><span style={{ width: 90, textAlign: "right" }}>Spend</span><span style={{ width: 70, textAlign: "right" }}>Profit</span><span style={{ width: 50, textAlign: "right" }}>Orders</span></>}
            {tab === "referrers" && <span style={{ width: 70, textAlign: "right" }}>Refs</span>}
            {tab === "active" && <><span style={{ width: 60, textAlign: "right" }}>Orders</span><span style={{ width: 90, textAlign: "right" }}>Spend</span></>}
            <span style={{ width: 70 }}></span>
          </div>
          {list.map((e, i) => {
            const sel = selected.has(e.userId);
            return (
              <div key={e.userId} style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: i < list.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: sel ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)") : i < 3 ? (dark ? "rgba(255,255,255,.015)" : "rgba(0,0,0,.01)") : "transparent" }}>
                <input type="checkbox" checked={sel} onChange={() => toggleSelect(e.userId)} style={{ accentColor: "#c47d8e", width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ width: 30, fontSize: 14, fontWeight: 700, color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : t.textMuted, textAlign: "center" }}>{i < 3 ? ["🥇","🥈","🥉"][i] : e.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{e.name || `${e.firstName} ${e.lastName}`}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{e.email}</div>
                </div>
                {tab === "spenders" && <><span className="m" style={{ width: 90, textAlign: "right", fontSize: 13, fontWeight: 600, color: dark ? "#6ee7b7" : "#059669" }}>{fN(e.spend)}</span><span className="m" style={{ width: 70, textAlign: "right", fontSize: 12, color: t.textMuted }}>{fN(e.profit)}</span><span style={{ width: 50, textAlign: "right", fontSize: 13, color: t.textMuted }}>{e.orders}</span></>}
                {tab === "referrers" && <span style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 600, color: dark ? "#e0a458" : "#d97706" }}>{e.referrals}</span>}
                {tab === "active" && <><span style={{ width: 60, textAlign: "right", fontSize: 14, fontWeight: 600, color: dark ? "#a5b4fc" : "#4f46e5" }}>{e.orders}</span><span className="m" style={{ width: 90, textAlign: "right", fontSize: 12, color: t.textMuted }}>{fN(e.spend)}</span></>}
                <div style={{ width: 70, textAlign: "right" }}>
                  <button onClick={() => { setRewardModal({ userId: e.userId, name: e.name || `${e.firstName} ${e.lastName}`, email: e.email }); setRewardMsg(null); }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.accent}`, background: "none", color: t.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reward</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>}

      {/* Single reward modal */}
      {rewardModal && (
        <div onClick={() => setRewardModal(null)} style={modalOvr}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Reward User</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>{rewardModal.name} · {rewardModal.email}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Amount (₦)</label>
              <input type="number" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} placeholder="5000" style={{ ...inp, fontSize: 15 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>{[1000,2000,3000,5000,10000].map(q => <button key={q} onClick={() => setRewardAmount(String(q))} style={presetBtn(rewardAmount === String(q))}>{fN(q)}</button>)}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Note (optional)</label>
              <input value={rewardNote} onChange={e => setRewardNote(e.target.value)} placeholder="Leaderboard reward — Top spender" style={{ ...inp, fontSize: 14 }} />
            </div>
            {rewardMsg && <div style={msgBox(rewardMsg.type)}>{rewardMsg.text}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRewardModal(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={doReward} disabled={!rewardAmount || Number(rewardAmount) <= 0 || rewardLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, ...gradBtn, fontSize: 14, opacity: !rewardAmount || Number(rewardAmount) <= 0 || rewardLoading ? .5 : 1 }}>{rewardLoading ? "Sending..." : `Send ${rewardAmount ? fN(Number(rewardAmount)) : "₦0"}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mass reward modal */}
      {massModal && (
        <div onClick={() => { if (!massLoading) setMassModal(false); }} style={modalOvr}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Reward {selected.size} Users</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Each user receives the same amount</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, padding: "8px 10px", borderRadius: 8, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", maxHeight: 80, overflow: "auto" }}>
              {list.filter(e => selected.has(e.userId)).map(e => e.name || e.email).join(", ")}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Amount per user (₦)</label>
              <input type="number" value={massAmount} onChange={e => setMassAmount(e.target.value)} placeholder="5000" style={{ ...inp, fontSize: 15 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>{[1000,2000,3000,5000,10000].map(q => <button key={q} onClick={() => setMassAmount(String(q))} style={presetBtn(massAmount === String(q))}>{fN(q)}</button>)}</div>
              {massAmount && <div style={{ fontSize: 12, color: t.accent, marginTop: 6 }}>Total: {fN(Number(massAmount) * selected.size)} (₦{Number(massAmount).toLocaleString()} × {selected.size})</div>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Note (optional)</label>
              <input value={massNote} onChange={e => setMassNote(e.target.value)} placeholder="Monthly leaderboard reward" style={{ ...inp, fontSize: 14 }} />
            </div>
            {massProgress && <div style={{ fontSize: 13, color: t.accent, marginBottom: 10 }}>Processing {massProgress.done}/{massProgress.total}...</div>}
            {massMsg && <div style={msgBox(massMsg.type)}>{massMsg.text}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMassModal(false)} disabled={massLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={doMassReward} disabled={!massAmount || Number(massAmount) <= 0 || massLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, ...gradBtn, fontSize: 14, opacity: !massAmount || Number(massAmount) <= 0 || massLoading ? .5 : 1 }}>{massLoading ? "Processing..." : `Send to ${selected.size} users`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
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
        <div key={r.id} style={{ padding: "8px 4px", borderBottom: i < Math.min(rewards.length, 8) - 1 ? `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: dark ? "#6ee7b7" : "#059669" }}>+{fN(r.amount)}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{r.date ? new Date(r.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}</span>
          </div>
          <div style={{ fontSize: 13, color: t.text, marginTop: 1 }}>{r.user?.name || "Unknown"}</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{r.note}</div>
        </div>
      )) : <div style={{ fontSize: 13, color: t.textMuted, padding: "8px 4px" }}>No rewards yet</div>}
    </>
  );
}
