'use client';
import { useState, useEffect } from "react";
import { fN } from "../lib/format";

const TABS = [
  { id: "spenders", label: "Top Spenders", shortLabel: "Spenders" },
  { id: "referrers", label: "Top Referrers", shortLabel: "Referrers" },
  { id: "active", label: "Most Active", shortLabel: "Active" },
];

/* Podium card colors per rank */
const POD = {
  1: { bg: "#2a2308", bgL: "#fef9e7", border: "#5c4a10", borderL: "#e8d576", medal: "🥇", valDk: "#ffd700", valLt: "#b8860b" },
  2: { bg: "#1a1e24", bgL: "#f0f2f5", border: "#3a4050", borderL: "#b0b8c8", medal: "🥈", valDk: "#c0c0c0", valLt: "#6b7280" },
  3: { bg: "#241a12", bgL: "#fdf3eb", border: "#5c3a1a", borderL: "#d4a574", medal: "🥉", valDk: "#cd7f32", valLt: "#a0522d" },
};

function PodiumCard({ entry, rank, dark, tab }) {
  const p = POD[rank];
  const val = tab === "referrers" ? `${entry.referrals} refs` : fN(entry.amount);
  const sub = tab === "referrers" ? null : `${entry.orders} order${entry.orders !== 1 ? "s" : ""}`;
  const isFirst = rank === 1;
  return (
    <div className="lb-pod" style={{
      background: dark ? p.bg : p.bgL,
      borderColor: dark ? p.border : p.borderL,
      order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
    }}>
      <div className="lb-medal" style={{ fontSize: isFirst ? 30 : 24 }}>{p.medal}</div>
      <div className="lb-pod-avatar" style={{
        width: isFirst ? 52 : 42, height: isFirst ? 52 : 42, fontSize: isFirst ? 18 : 15,
        background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)",
        color: dark ? "#c47d8e" : "#a3586b",
        ...(entry.isYou ? { border: "2px solid #c47d8e" } : {}),
      }}>{entry.initials}</div>
      <div className="lb-pod-name" style={{ fontSize: isFirst ? 15 : 13 }}>
        {entry.name}{entry.isYou ? " (You)" : ""}
      </div>
      <div className="m lb-pod-val" style={{ color: dark ? p.valDk : p.valLt, fontSize: isFirst ? 16 : 14 }}>{val}</div>
      {sub && <div className="lb-pod-sub">{sub}</div>}
    </div>
  );
}

function ListRow({ entry, dark, t, tab, isLast }) {
  const val = tab === "referrers" ? `${entry.referrals} refs` : fN(entry.amount);
  const sub = tab === "referrers" ? null : `${entry.orders} order${entry.orders !== 1 ? "s" : ""}`;
  return (
    <div className="lb-row" style={{ borderBottom: isLast ? "none" : `1px solid ${t.cardBorder}`, background: entry.isYou ? (dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)") : "transparent" }}>
      <div className="lb-rank" style={{ color: t.textMuted }}>{entry.rank}</div>
      <div className="lb-avatar" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.45)" }}>{entry.initials}</div>
      <div className="lb-info">
        <div className="lb-name" style={{ color: t.text }}>{entry.name}{entry.isYou ? " (You)" : ""}</div>
        {sub && <div className="lb-sub-text" style={{ color: t.textMuted }}>{sub}</div>}
      </div>
      <div className="m lb-val" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{val}</div>
    </div>
  );
}

export default function LeaderboardPage({ dark, t }) {
  const [tab, setTab] = useState("spenders");
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const list = data?.[tab] || [];
  const podium = list.slice(0, 3);
  const rest = list.slice(3);
  const yourRank = data?.yourRank?.[tab];

  const periodLabel = period === "month" ? new Date().toLocaleDateString("en-US", { month: "long" }) : "All time";
  const rewardAnnouncement = data?.rewardAnnouncement;

  return (
    <>
      <div className="lb-header">
        <div className="lb-title" style={{ color: t.text }}>Leaderboard</div>
        <div className="lb-subtitle" style={{ color: t.textMuted }}>Top Nitro users · {periodLabel}</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Reward announcement */}
      {rewardAnnouncement && (
        <div className="lb-reward-banner" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", borderColor: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.12)", color: t.text }}>
          {rewardAnnouncement}
        </div>
      )}

      {/* Tabs */}
      <div className="lb-tabs" style={{ borderBottomColor: t.cardBorder }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className={`lb-tab${tab === tb.id ? " lb-tab-on" : ""}`} style={{ color: tab === tb.id ? t.accent : t.textMuted, borderBottomColor: tab === tb.id ? t.accent : "transparent" }}>
            <span className="lb-tab-full">{tb.label}</span>
            <span className="lb-tab-short">{tb.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Time filter */}
      <div className="lb-time">
        {["month", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className="lb-time-btn" style={{ borderColor: period === p ? t.accent : t.cardBorder, color: period === p ? t.accent : t.textMuted, background: period === p ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent" }}>
            {p === "month" ? "This Month" : "All Time"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Loading leaderboard...</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>No data yet. Place orders to appear on the leaderboard!</div>
      ) : <>

        {/* Your rank callout */}
        {yourRank && (
          <div className="lb-you" style={{ background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.04)", borderColor: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)" }}>
            <div className="m lb-you-rank" style={{ color: t.accent }}>#{yourRank}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Your Rank</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                {tab === "spenders" && `₦${(list.find(e => e.isYou)?.amount || 0).toLocaleString()} spent`}
                {tab === "referrers" && `${list.find(e => e.isYou)?.referrals || 0} referrals`}
                {tab === "active" && `${list.find(e => e.isYou)?.orders || 0} orders`}
              </div>
            </div>
          </div>
        )}

        {/* Podium — top 3 */}
        {podium.length >= 3 && (
          <div className="lb-podium">
            {podium.map((entry, i) => (
              <PodiumCard key={i} entry={entry} rank={i + 1} dark={dark} tab={tab} />
            ))}
          </div>
        )}

        {/* List — 4-10 */}
        {rest.length > 0 && (
          <div className="lb-list" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", borderColor: t.cardBorder }}>
            {rest.map((entry, i) => (
              <ListRow key={i} entry={entry} dark={dark} t={t} tab={tab} isLast={i === rest.length - 1} />
            ))}
          </div>
        )}

        {/* Less than 3 — show as list instead of podium */}
        {podium.length < 3 && (
          <div className="lb-list" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", borderColor: t.cardBorder }}>
            {list.map((entry, i) => (
              <ListRow key={i} entry={entry} dark={dark} t={t} tab={tab} isLast={i === list.length - 1} />
            ))}
          </div>
        )}
      </>}
    </>
  );
}

/* ═══ COMPACT CARD for dashboard home / right sidebar ═══ */
export function LeaderboardCard({ dark, t, onViewAll }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/leaderboard?period=month")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, []);

  const top3 = data?.spenders?.slice(0, 3) || [];
  if (top3.length === 0) return null;

  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  return (
    <div className="lb-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", borderColor: t.cardBorder }}>
      <div className="lb-card-title" style={{ color: t.textMuted }}>Top Spenders · {month}</div>
      {top3.map((entry, i) => (
        <div key={i} className="lb-card-row">
          <div className="lb-card-medal">{POD[i + 1].medal}</div>
          <div className="lb-card-name" style={{ color: t.text }}>{entry.name}{entry.isYou ? " (You)" : ""}</div>
          <div className="m lb-card-val" style={{ color: dark ? "#6ee7b7" : "#059669" }}>
            {entry.amount >= 1000 ? `₦${(entry.amount / 1000).toFixed(entry.amount % 1000 === 0 ? 0 : 1)}K` : fN(entry.amount)}
          </div>
        </div>
      ))}
      {onViewAll && <button onClick={onViewAll} className="lb-card-link" style={{ color: t.accent }}>View full leaderboard →</button>}
    </div>
  );
}
