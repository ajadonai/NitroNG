'use client';
import { useState, useEffect } from "react";

const TABS = [
  { id: "spenders", label: "Top Spenders", shortLabel: "Spenders" },
  { id: "referrers", label: "Top Referrers", shortLabel: "Referrers" },
  { id: "active", label: "Most Active", shortLabel: "Active" },
];

const POD = {
  1: { bg: "#352e0c", bgL: "#fdf3c7", border: "#5c4a10", borderL: "#d4a820", medal: "🥇", valDk: "#ffd700", valLt: "#92650a" },
  2: { bg: "#1e2430", bgL: "#e8ecf2", border: "#3a4050", borderL: "#8898b0", medal: "🥈", valDk: "#c0c0c0", valLt: "#4b5563" },
  3: { bg: "#2e1e0e", bgL: "#fdecd8", border: "#5c3a1a", borderL: "#c48040", medal: "🥉", valDk: "#cd7f32", valLt: "#8b4513" },
};

const UserIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

/* Shield badge SVG — scales with size prop, color from tier */
function ShieldBadge({ color = "#6B7280", size = 20, tier = "Starter" }) {
  const s = size / 40;
  const isStarter = tier === "Starter";
  const isRegular = tier === "Regular";
  const isPower = tier === "Power User";
  const isElite = tier === "Elite";
  const isLegend = tier === "Legend";
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 40 44" fill="none">
      <path d="M20 2L38 10V22C38 32 30 40 20 44C10 40 2 32 2 22V10L20 2Z" fill={color} fillOpacity={isStarter ? 0.15 : 0.2} stroke={color} strokeWidth={isLegend ? 2 : 1.5}/>
      <path d="M20 14L22 18H26L23 21L24 25L20 22L16 25L17 21L14 18H18Z" fill={color} fillOpacity={isStarter ? 0.4 : 1} transform={isElite || isLegend ? "translate(0,-2) scale(1.15) translate(-2.6, -0.5)" : undefined}/>
      {(isPower || isElite || isLegend) && <line x1="12" y1="8" x2="28" y2="8" stroke={color} strokeWidth="1" opacity="0.5"/>}
      {(isElite || isLegend) && <line x1="14" y1="5" x2="26" y2="5" stroke={color} strokeWidth="0.8" opacity="0.3"/>}
      {isLegend && <circle cx="20" cy="22" r="16" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3"/>}
    </svg>
  );
}

function getVal(entry, tab) {
  if (tab === "referrers") return `${entry.referrals} refs`;
  return `${entry.orders} order${entry.orders !== 1 ? "s" : ""}`;
}

function PodiumCard({ entry, rank, dark, tab }) {
  const p = POD[rank];
  const val = getVal(entry, tab);
  const isFirst = rank === 1;
  return (
    <div className="lb-pod" style={{
      background: dark ? p.bg : p.bgL,
      borderColor: dark ? p.border : p.borderL,
      order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
    }}>
      <div className="lb-medal" style={{ fontSize: isFirst ? 30 : 24 }}>{p.medal}</div>
      <div className="lb-pod-avatar" style={{
        width: isFirst ? 48 : 40, height: isFirst ? 48 : 40,
        background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)",
        color: dark ? "#c47d8e" : "#a3586b",
        ...(entry.isYou ? { border: "2px solid #c47d8e" } : {}),
      }}><UserIcon size={isFirst ? 20 : 16} /></div>
      <div className="lb-pod-name" style={{ fontSize: isFirst ? 15 : 13, marginBottom: 4 }}>
        {entry.name}{entry.isYou ? " (You)" : ""}
      </div>
      {entry.badge && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}><ShieldBadge color={entry.badgeColor || "#6B7280"} size={14} tier={entry.badge} /><span style={{ fontSize: 11, color: entry.badgeColor || (dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.4)") }}>{entry.badge}</span></div>}
      <div className="m lb-pod-val" style={{ color: dark ? p.valDk : p.valLt, fontSize: isFirst ? 16 : 14 }}>{val}</div>
    </div>
  );
}

function ListRow({ entry, dark, t, tab, isLast }) {
  const val = getVal(entry, tab);
  return (
    <div className="lb-row" style={{ borderBottom: isLast ? "none" : `1px solid ${t.cardBorder}`, background: entry.isYou ? (dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)") : "transparent" }}>
      <div className="lb-rank" style={{ color: t.textMuted }}>{entry.rank}</div>
      <div className="lb-avatar" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.45)" }}><UserIcon size={14} /></div>
      <div className="lb-info">
        <div className="lb-name" style={{ color: t.text }}>{entry.name}{entry.isYou ? " (You)" : ""}</div>
        {entry.badge && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><ShieldBadge color={entry.badgeColor || "#6B7280"} size={12} tier={entry.badge} /><span style={{ fontSize: 11, color: t.textMuted }}>{entry.badge}</span></div>}
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <div className="m lb-val" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{val}</div>
      </div>
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
  const yourBadge = data?.yourBadge;

  const periodLabel = period === "month" ? new Date().toLocaleDateString("en-US", { month: "long" }) : "All time";
  const rewardAnnouncement = data?.rewardAnnouncement;

  return (
    <>
      <div className="lb-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="lb-title" style={{ color: t.text }}>Leaderboard</div>
            <div className="lb-subtitle" style={{ color: t.textMuted }}>Top Nitro users · {periodLabel}</div>
          </div>
          <div className="lb-tabs">
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)} className={`lb-tab${tab === tb.id ? " lb-tab-on" : ""}`}>
                <span className="lb-tab-full">{tb.label}</span>
                <span className="lb-tab-short">{tb.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {rewardAnnouncement && (
        <div className="lb-reward-banner" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", borderColor: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.12)", color: t.text }}>
          {rewardAnnouncement}
        </div>
      )}

      <div className="lb-time">
        {["month", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className="lb-time-btn" style={{ borderColor: period === p ? t.accent : t.cardBorder, color: period === p ? t.accent : t.textMuted, background: period === p ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent" }}>
            {p === "month" ? "This Month" : "All Time"}
          </button>
        ))}
      </div>

      {/* Mobile/tablet: merged loyalty + your rank card (hidden on desktop via CSS) */}
      {data?.tiers?.length > 0 && (
        <details className="lb-tiers-mobile" style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.9)" }}>
          <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: t.text, listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {yourBadge && <ShieldBadge color={yourBadge.color} size={18} tier={yourBadge.name} />}
              <span>Loyalty Tiers</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {yourBadge && <span style={{ fontSize: 12, color: yourBadge.color, fontWeight: 600 }}>{yourBadge.name}</span>}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lb-chevron"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </summary>
          <div style={{ padding: "0 16px 14px" }}>
            {yourBadge && yourRank && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", marginBottom: 12 }}>
                <div className="m" style={{ fontSize: 20, fontWeight: 700, color: t.accent }}>#{yourRank}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Your Rank</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {yourBadge.nextTier ? `Keep ordering to reach ${yourBadge.nextTier.name}` : "Max tier reached"}
                  </div>
                </div>
              </div>
            )}
            {data.tiers.map((tier, i) => {
              const isCurrent = yourBadge?.name === tier.name;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < data.tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` : "none" }}>
                  <ShieldBadge color={tier.color} size={16} tier={tier.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? tier.color : t.text }}>{tier.name}{isCurrent ? " (You)" : ""}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{tier.perks || (tier.discount > 0 ? `${tier.discount}% discount` : "No perks")}</div>
                  </div>
                  {tier.discount > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: dark ? "#6ee7b7" : "#059669", flexShrink: 0 }}>{tier.discount}% off</div>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {loading ? (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>{[1,2].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 30, width: 90, borderRadius: 20 }} />)}</div>
          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 52, borderRadius: 10, marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ flex: 1, height: 140, borderRadius: 14 }} />)}</div>
          {[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 48, borderRadius: 8, marginBottom: 6 }} />)}
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          {tab === "spenders" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg>}
          {tab === "referrers" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
          {tab === "active" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 6 }}>
            {tab === "spenders" && "No top spenders yet"}
            {tab === "referrers" && "No referrals yet"}
            {tab === "active" && "No activity yet"}
          </div>
          <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 280, margin: "0 auto" }}>
            {tab === "spenders" && "Place orders to climb the leaderboard and unlock loyalty perks."}
            {tab === "referrers" && "Share your referral code with friends to appear here."}
            {tab === "active" && "Start ordering to see your name on the board."}
          </div>
        </div>
      ) : <>

        {/* Your rank — desktop only (mobile shows it in the collapsible above) */}
        {yourRank && (
          <div className="lb-you lb-you-desktop" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", borderColor: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)" }}>
            <div className="m lb-you-rank" style={{ color: t.accent }}>#{yourRank}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>Your Rank {yourBadge && <><ShieldBadge color={yourBadge.color} size={14} tier={yourBadge.name} /><span style={{ color: yourBadge.color }}>{yourBadge.name}</span></>}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                {tab === "spenders" && `${list.find(e => e.isYou)?.orders || 0} orders`}
                {tab === "referrers" && `${list.find(e => e.isYou)?.referrals || 0} referrals`}
                {tab === "active" && `${list.find(e => e.isYou)?.orders || 0} orders`}
              </div>
            </div>
          </div>
        )}

        {podium.length >= 3 && (
          <div className="lb-podium">
            {podium.map((entry, i) => (
              <PodiumCard key={i} entry={entry} rank={i + 1} dark={dark} tab={tab} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="lb-list" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" }}>
            {rest.map((entry, i) => (
              <ListRow key={i} entry={entry} dark={dark} t={t} tab={tab} isLast={i === rest.length - 1} />
            ))}
          </div>
        )}

        {podium.length < 3 && (
          <div className="lb-list" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)" }}>
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
            {entry.orders} order{entry.orders !== 1 ? "s" : ""}
          </div>
        </div>
      ))}
      {onViewAll && <button onClick={onViewAll} className="lb-card-link" style={{ color: t.accent }}>View full leaderboard →</button>}
    </div>
  );
}

/* ═══ TIER PERKS — right sidebar on desktop ═══ */
export function TierPerksCard({ dark, t }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/leaderboard?period=all")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, []);

  const tiers = data?.tiers || [];
  const yourBadge = data?.yourBadge;
  if (!tiers.length) return null;

  return (
    <div style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.9)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, marginBottom: 12 }}>Loyalty tiers</div>
      {yourBadge && (
        <div style={{ padding: "10px 12px", borderRadius: 8, background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", marginBottom: 12, fontSize: 13, color: t.text }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <ShieldBadge color={yourBadge.color} size={16} tier={yourBadge.name} />
            <span>You are <strong style={{ color: yourBadge.color }}>{yourBadge.name}</strong></span>
            {yourBadge.discount > 0 && <span style={{ color: dark ? "#6ee7b7" : "#059669", fontSize: 12 }}>{yourBadge.discount}% off</span>}
          </div>
          {yourBadge.nextTier && (
            <div style={{ fontSize: 11, color: t.textMuted }}>
              Keep ordering to reach {yourBadge.nextTier.name}
            </div>
          )}
        </div>
      )}
      {tiers.map((tier, i) => {
        const isCurrent = yourBadge?.name === tier.name;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` : "none", opacity: isCurrent ? 1 : 0.65 }}>
            <ShieldBadge color={tier.color} size={14} tier={tier.name} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? tier.color : t.text }}>{tier.name}</div>
              <div style={{ fontSize: 10, color: t.textMuted }}>{tier.perks || (tier.discount > 0 ? `${tier.discount}% discount` : "No perks")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
