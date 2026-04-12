'use client';
import { useState, useEffect } from "react";
import { fN } from "../lib/format";

const TABS = [
  { id: "spenders", label: "Top Spenders" },
  { id: "referrers", label: "Top Referrers" },
  { id: "active", label: "Most Active" },
];

export default function AdminLeaderboardPage({ dark, t }) {
  const [tab, setTab] = useState("spenders");
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardModal, setRewardModal] = useState(null); // { userId, name, email }
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardMsg, setRewardMsg] = useState(null);
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
        if (d.rewardAnnouncement) {
          setAnnoText(d.rewardAnnouncement.text || "");
          setAnnoEnabled(d.rewardAnnouncement.enabled ?? false);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(load, [period]);

  const list = data?.[tab] || [];

  const doReward = async () => {
    const amt = Number(rewardAmount);
    if (!amt || amt <= 0 || !rewardModal) return;
    setRewardLoading(true); setRewardMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reward", userId: rewardModal.userId, amount: amt, note: rewardNote || `Leaderboard reward — ₦${amt.toLocaleString()}` }),
      });
      const d = await res.json();
      if (!res.ok) { setRewardMsg({ type: "error", text: d.error }); }
      else { setRewardMsg({ type: "success", text: d.message }); setRewardAmount(""); setRewardNote(""); load(); }
    } catch { setRewardMsg({ type: "error", text: "Failed" }); }
    setRewardLoading(false);
  };

  const saveAnnouncement = async () => {
    setAnnoSaving(true); setAnnoMsg(null);
    try {
      const res = await fetch("/api/admin/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_announcement", announcement: { text: annoText, enabled: annoEnabled } }),
      });
      const d = await res.json();
      setAnnoMsg(d.success ? { type: "success", text: "Saved" } : { type: "error", text: d.error });
    } catch { setAnnoMsg({ type: "error", text: "Failed" }); }
    setAnnoSaving(false);
  };

  const periodLabel = period === "month" ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "All time";

  return (
    <div style={{ padding: "24px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: t.text, marginBottom: 2 }}>Leaderboard</div>
        <div style={{ fontSize: 14, color: t.textMuted }}>Top users · {periodLabel} · Reward your best customers</div>
        <div className="page-divider" style={{ background: t.cardBorder, marginTop: 12 }} />
      </div>

      {/* Reward Announcement Editor */}
      <div style={{ borderRadius: 12, padding: 16, marginBottom: 20, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: t.textMuted, marginBottom: 10 }}>Reward Announcement</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>This message shows on the user-facing leaderboard page</div>
        <input value={annoText} onChange={e => setAnnoText(e.target.value)} placeholder="🎁 Top 3 spenders this month win bonus credits! 1st: ₦5,000 · 2nd: ₦3,000 · 3rd: ₦1,000" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: t.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={annoEnabled} onChange={e => setAnnoEnabled(e.target.checked)} style={{ accentColor: "#c47d8e" }} />
            Show on leaderboard
          </label>
          <button onClick={saveAnnouncement} disabled={annoSaving} style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${t.accent}`, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)", color: t.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{annoSaving ? "Saving..." : "Save"}</button>
          {annoMsg && <span style={{ fontSize: 12, color: annoMsg.type === "success" ? t.green : t.red }}>{annoMsg.text}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${t.cardBorder}` }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: "8px 18px", fontSize: 14, fontWeight: tab === tb.id ? 600 : 500, color: tab === tb.id ? t.accent : t.textMuted, borderBottom: `2px solid ${tab === tb.id ? t.accent : "transparent"}`, marginBottom: -1, background: "none", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: tab === tb.id ? t.accent : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Time filter */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["month", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: `1px solid ${period === p ? t.accent : t.cardBorder}`, color: period === p ? t.accent : t.textMuted, background: period === p ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
            {p === "month" ? "This Month" : "All Time"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>No data for this period</div>
      ) : (
        <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)" }}>
          {/* Table header */}
          <div style={{ display: "flex", padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}`, gap: 12 }}>
            <span style={{ width: 36 }}>#</span>
            <span style={{ flex: 1 }}>User</span>
            {tab === "spenders" && <><span style={{ width: 100, textAlign: "right" }}>Spend</span><span style={{ width: 80, textAlign: "right" }}>Profit</span><span style={{ width: 60, textAlign: "right" }}>Orders</span></>}
            {tab === "referrers" && <span style={{ width: 80, textAlign: "right" }}>Referrals</span>}
            {tab === "active" && <><span style={{ width: 80, textAlign: "right" }}>Orders</span><span style={{ width: 100, textAlign: "right" }}>Spend</span></>}
            <span style={{ width: 80 }}></span>
          </div>

          {/* Rows */}
          {list.map((entry, i) => (
            <div key={entry.userId} style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, borderBottom: i < list.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: i < 3 ? (dark ? "rgba(196,125,142,.02)" : "rgba(196,125,142,.015)") : "transparent" }}>
              <span style={{ width: 36, fontSize: 14, fontWeight: 700, color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : t.textMuted }}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : entry.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{entry.name || entry.firstName + " " + entry.lastName}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{entry.email}</div>
              </div>
              {tab === "spenders" && <>
                <span className="m" style={{ width: 100, textAlign: "right", fontSize: 13, fontWeight: 600, color: dark ? "#6ee7b7" : "#059669" }}>{fN(entry.spend)}</span>
                <span className="m" style={{ width: 80, textAlign: "right", fontSize: 12, color: t.textMuted }}>{fN(entry.profit)}</span>
                <span style={{ width: 60, textAlign: "right", fontSize: 13, color: t.textMuted }}>{entry.orders}</span>
              </>}
              {tab === "referrers" && <span style={{ width: 80, textAlign: "right", fontSize: 14, fontWeight: 600, color: dark ? "#e0a458" : "#d97706" }}>{entry.referrals}</span>}
              {tab === "active" && <>
                <span style={{ width: 80, textAlign: "right", fontSize: 14, fontWeight: 600, color: dark ? "#a5b4fc" : "#4f46e5" }}>{entry.orders}</span>
                <span className="m" style={{ width: 100, textAlign: "right", fontSize: 12, color: t.textMuted }}>{fN(entry.spend)}</span>
              </>}
              <div style={{ width: 80, textAlign: "right" }}>
                <button onClick={() => { setRewardModal({ userId: entry.userId, name: entry.name || `${entry.firstName} ${entry.lastName}`, email: entry.email }); setRewardMsg(null); }} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${t.accent}`, background: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reward</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent rewards history */}
      {data?.rewards?.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: t.textMuted, marginBottom: 10 }}>Recent Rewards</div>
          <div style={{ borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.8)", overflow: "hidden" }}>
            {data.rewards.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", fontSize: 13, borderBottom: i < data.rewards.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(r.amount)}</span>
                <span style={{ color: t.text }}>{r.user?.name || "Unknown"}</span>
                <span style={{ flex: 1, color: t.textMuted, fontSize: 12 }}>{r.note}</span>
                <span style={{ color: t.textMuted, fontSize: 11 }}>{new Date(r.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reward modal */}
      {rewardModal && (
        <div onClick={() => setRewardModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, border: `1px solid ${t.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Reward User</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>{rewardModal.name} · {rewardModal.email}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Amount (₦)</label>
              <input type="number" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} placeholder="5000" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {[1000, 2000, 3000, 5000, 10000].map(q => (
                  <button key={q} onClick={() => setRewardAmount(String(q))} style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 12, border: `1px solid ${rewardAmount === String(q) ? t.accent : t.cardBorder}`, background: rewardAmount === String(q) ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: rewardAmount === String(q) ? t.accent : t.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{fN(q)}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Note (optional)</label>
              <input value={rewardNote} onChange={e => setRewardNote(e.target.value)} placeholder="Leaderboard reward — Top spender April" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            {rewardMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: rewardMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: rewardMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), border: `1px solid ${rewardMsg.type === "success" ? (dark ? "rgba(110,231,183,.2)" : "#a7f3d0") : (dark ? "rgba(220,38,38,.2)" : "#fecaca")}` }}>
                {rewardMsg.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRewardModal(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={doReward} disabled={!rewardAmount || Number(rewardAmount) <= 0 || rewardLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !rewardAmount || Number(rewardAmount) <= 0 || rewardLoading ? .5 : 1 }}>{rewardLoading ? "Sending..." : `Send ${rewardAmount ? fN(Number(rewardAmount)) : "₦0"}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
