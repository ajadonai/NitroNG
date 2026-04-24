'use client';
import { useState, useEffect } from "react";

const TABS = [
  { id: "spenders", label: "Top Spenders", shortLabel: "Spenders" },
  { id: "referrers", label: "Top Referrers", shortLabel: "Referrers" },
  { id: "active", label: "Most Active", shortLabel: "Active" },
];

const POD = {
  1: { bg: "#352e0c", bgL: "#fdf3c7", border: "#5c4a10", borderL: "#d4a820", medal: "1", valDk: "#ffd700", valLt: "#92650a" },
  2: { bg: "#1e2430", bgL: "#e8ecf2", border: "#3a4050", borderL: "#8898b0", medal: "2", valDk: "#c0c0c0", valLt: "#4b5563" },
  3: { bg: "#2e1e0e", bgL: "#fdecd8", border: "#5c3a1a", borderL: "#c48040", medal: "3", valDk: "#cd7f32", valLt: "#8b4513" },
};

const UserIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

function ShieldBadge({ color = "#6B7280", size = 20, tier = "Starter" }) {
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
    <div className="flex-1 rounded-[14px] max-md:rounded-[10px] py-4 px-3.5 max-md:py-2.5 max-md:px-1.5 text-center border-[1.5px] overflow-hidden min-w-0" style={{
      background: dark ? p.bg : p.bgL,
      borderColor: dark ? p.border : p.borderL,
      order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
      ...(isFirst ? { boxShadow: dark ? `0 8px 32px rgba(255,215,0,.15), 0 0 0 1px rgba(255,215,0,.1)` : `0 8px 32px rgba(212,168,32,.15), 0 0 0 1px rgba(212,168,32,.08)` } : {}),
    }}>
      <div className="mb-1.5" style={{ fontSize: isFirst ? 30 : 24 }}>{p.medal}</div>
      <div className="rounded-full flex items-center justify-center font-bold mx-auto mb-2" style={{
        width: isFirst ? 48 : 40, height: isFirst ? 48 : 40,
        background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)",
        color: dark ? "#c47d8e" : "#a3586b",
        ...(entry.isYou ? { border: "2px solid #c47d8e" } : {}),
      }}><UserIcon size={isFirst ? 20 : 16} /></div>
      <div className="font-semibold mb-0.5 max-md:text-[11px] max-md:whitespace-nowrap max-md:overflow-hidden max-md:text-ellipsis" style={{ fontSize: isFirst ? 15 : 13 }}>
        {entry.name}{entry.isYou ? " (You)" : ""}
      </div>
      {entry.badge && <div className="flex items-center justify-center gap-1 mb-1"><ShieldBadge color={entry.badgeColor || "#6B7280"} size={14} tier={entry.badge} /><span className="text-[11px]" style={{ color: entry.badgeColor || (dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.4)") }}>{entry.badge}</span></div>}
      <div className="font-bold max-md:text-xs max-md:whitespace-nowrap" style={{ color: dark ? p.valDk : p.valLt, fontSize: isFirst ? 16 : 14 }}>{val}</div>
    </div>
  );
}

function ListRow({ entry, dark, t, tab, isLast }) {
  const val = getVal(entry, tab);
  return (
    <div className="flex items-center gap-3 max-md:gap-2.5 py-3 px-4 max-md:py-2.5 max-md:px-3 transition-colors duration-150" style={{ borderBottom: isLast ? "none" : `1px solid ${t.cardBorder}`, background: entry.isYou ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent" }}>
      <div className="w-7 text-center text-sm max-md:text-[13px] font-bold shrink-0" style={{ color: t.textMuted }}>{entry.rank}</div>
      <div className="w-[34px] h-[34px] max-md:w-[30px] max-md:h-[30px] rounded-full flex items-center justify-center font-semibold text-[13px] max-md:text-[11px] shrink-0" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.45)" }}><UserIcon size={14} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm max-md:text-[13px] font-medium" style={{ color: t.text }}>{entry.name}{entry.isYou ? " (You)" : ""}</div>
        {entry.badge && <div className="flex items-center gap-1 mt-0.5"><ShieldBadge color={entry.badgeColor || "#6B7280"} size={12} tier={entry.badge} /><span className="text-[11px]" style={{ color: t.textMuted }}>{entry.badge}</span></div>}
      </div>
      <div className="ml-auto text-right">
        <div className="text-sm max-md:text-[13px] font-bold shrink-0" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{val}</div>
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

  const pillCls = "py-[6px] px-4 max-md:px-3 rounded-[20px] text-[13px] max-md:text-[12px] font-medium cursor-pointer border font-[inherit] transition-all duration-200";
  const pill = (on) => ({ borderColor: on ? (dark ? "#c47d8e" : "#a3586b") : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)"), color: on ? (dark ? "#c47d8e" : "#a3586b") : (dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.45)"), background: on ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)") : "transparent" });
  const ddStyle = { padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", appearance: "none", cursor: "pointer", fontFamily: "inherit", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" };

  return (
    <>
      {/* Header */}
      <div className="pb-3.5">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dark ? "#c47d8e" : "#a3586b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .7 }}>
            <path d="M8 21V12H2v9h6z"/><path d="M22 21V8h-6v13h6z"/><path d="M15 21V4H9v17h6z"/>
          </svg>
          <div>
            <div className="text-[22px] max-md:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Leaderboard</div>
            <div className="text-[15px] max-md:text-[13px]" style={{ color: t.textMuted }}>Top Nitro users · {periodLabel}</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Announcement */}
      {rewardAnnouncement && (
        <div className="rounded-[10px] py-3 px-4 mb-4 border text-sm font-medium leading-normal flex items-center gap-3" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", borderColor: dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.19)", color: t.text }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dark ? "#c47d8e" : "#a3586b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
          <span>{rewardAnnouncement}</span>
        </div>
      )}

      {/* Tab pills + period dropdown */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className={pillCls} style={pill(tab === tb.id)}>
            <span className="max-md:hidden">{tb.label}</span>
            <span className="md:hidden">{tb.shortLabel}</span>
          </button>
        ))}
        <div className="flex-1" />
        <select value={period} onChange={e => setPeriod(e.target.value)} style={ddStyle}>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Mobile/tablet: merged loyalty + your rank card */}
      {data?.tiers?.length > 0 && (
        <details className="lb-tiers-mobile mb-4 rounded-xl border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)" }}>
          <summary className="py-3 px-4 cursor-pointer text-[13px] font-semibold flex items-center justify-between" style={{ color: t.text, listStyle: "none" }}>
            <div className="flex items-center gap-2">
              {yourBadge && <ShieldBadge color={yourBadge.color} size={18} tier={yourBadge.name} />}
              <span>Loyalty Tiers</span>
            </div>
            <div className="flex items-center gap-1.5">
              {yourBadge && <span className="text-xs font-semibold" style={{ color: yourBadge.color }}>{yourBadge.name}</span>}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lb-chevron"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </summary>
          <div className="px-4 pb-3.5">
            {yourBadge && yourRank && (
              <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-3" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)" }}>
                <div className="text-xl font-bold" style={{ color: dark ? "#c47d8e" : "#a3586b" }}>#{yourRank}</div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: t.text }}>Your Rank</div>
                  <div className="text-[11px]" style={{ color: t.textMuted }}>
                    {yourBadge.nextTier ? `Keep ordering to reach ${yourBadge.nextTier.name}` : "Max tier reached"}
                  </div>
                </div>
              </div>
            )}
            {data.tiers.map((tier, i) => {
              const isCurrent = yourBadge?.name === tier.name;
              return (
                <div key={i} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: i < data.tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` : "none" }}>
                  <ShieldBadge color={tier.color} size={16} tier={tier.name} />
                  <div className="flex-1">
                    <div className="text-[13px]" style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? tier.color : t.text }}>{tier.name}{isCurrent ? " (You)" : ""}</div>
                    <div className="text-[11px]" style={{ color: t.textMuted }}>{tier.perks || (tier.discount > 0 ? `${tier.discount}% discount` : "No perks")}</div>
                  </div>
                  {tier.discount > 0 && <div className="text-[11px] font-semibold shrink-0" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{tier.discount}% off</div>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Category hint */}
      <div className="text-xs italic mb-3" style={{ color: t.textMuted }}>
        {tab === "spenders" && "Ranked by total amount spent, not number of orders placed."}
        {tab === "referrers" && "Ranked by number of successful referrals who signed up and verified their account."}
        {tab === "active" && "Ranked by total number of orders placed within the selected period."}
      </div>

      {/* Loading */}
      {loading ? (
        <div>
          <div className="flex gap-3 mb-5">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} flex-1 h-[140px] rounded-[14px]`} />)}</div>
          {[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-12 rounded-lg mb-1.5`} />)}
        </div>
      ) : list.length === 0 ? (
        /* Empty state */
        <div className="py-[60px] px-5 text-center">
          {tab === "spenders" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 block"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg>}
          {tab === "referrers" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 block"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
          {tab === "active" && <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 block"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          <div className="text-[15px] font-semibold mb-1.5" style={{ color: t.text }}>
            {tab === "spenders" && "No top spenders yet"}
            {tab === "referrers" && "No referrals yet"}
            {tab === "active" && "No activity yet"}
          </div>
          <div className="text-[13px] max-w-[280px] mx-auto" style={{ color: t.textMuted }}>
            {tab === "spenders" && "Place orders to climb the leaderboard and unlock loyalty perks."}
            {tab === "referrers" && "Share your referral code with friends to appear here."}
            {tab === "active" && "Start ordering to see your name on the board."}
          </div>
        </div>
      ) : <>

        {/* Your rank — desktop only */}
        {yourRank && (
          <div className="lb-you-desktop rounded-xl py-3.5 px-5 max-md:py-3 max-md:px-3.5 flex items-center gap-4 mb-5 border" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderColor: dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.16)" }}>
            <div className="text-[26px] max-md:text-xl font-bold" style={{ color: dark ? "#c47d8e" : "#a3586b" }}>#{yourRank}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: t.text }}>Your Rank {yourBadge && <><ShieldBadge color={yourBadge.color} size={14} tier={yourBadge.name} /><span style={{ color: yourBadge.color }}>{yourBadge.name}</span></>}</div>
              <div className="text-xs" style={{ color: t.textMuted }}>
                {tab === "spenders" && `${list.find(e => e.isYou)?.orders || 0} orders`}
                {tab === "referrers" && `${list.find(e => e.isYou)?.referrals || 0} referrals`}
                {tab === "active" && `${list.find(e => e.isYou)?.orders || 0} orders`}
              </div>
            </div>
            {yourBadge?.nextTier && (
              <div className="text-[11px] text-right max-md:hidden" style={{ color: t.textMuted }}>
                Next: <span className="font-semibold" style={{ color: yourBadge.nextTier.color || t.textSoft }}>{yourBadge.nextTier.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Podium */}
        {podium.length >= 3 && (
          <div className="flex gap-3 max-md:gap-1.5 mb-5 items-end">
            {podium.map((entry, i) => (
              <PodiumCard key={i} entry={entry} rank={i + 1} dark={dark} tab={tab} />
            ))}
          </div>
        )}

        {/* List (rank 4+) */}
        {rest.length > 0 && (
          <div className="rounded-xl overflow-hidden border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)" }}>
            <div className="flex items-center py-2 px-4 max-md:px-3 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: dark ? "rgba(196,125,142,.7)" : "rgba(163,88,107,.5)", background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)" }}>
              <span className="w-7 text-center shrink-0">#</span>
              <span className="w-[34px] max-md:w-[30px] shrink-0" />
              <span className="flex-1">User</span>
              <span className="ml-auto">{tab === "referrers" ? "Refs" : "Orders"}</span>
            </div>
            {rest.map((entry, i) => (
              <ListRow key={i} entry={entry} dark={dark} t={t} tab={tab} isLast={i === rest.length - 1} />
            ))}
          </div>
        )}

        {/* Fallback when <3 on podium */}
        {podium.length < 3 && (
          <div className="rounded-xl overflow-hidden border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)" }}>
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
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-[14px] p-4 border" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)" }}>
      <div className="text-xs font-semibold uppercase tracking-[1.5px] mb-3 py-2 px-3 rounded-lg flex items-center gap-2" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V12H2v9h6z"/><path d="M22 21V8h-6v13h6z"/><path d="M15 21V4H9v17h6z"/></svg>
        <span>Top Spenders · {month}</span>
      </div>
      {top3.map((entry, i) => (
        <div key={i} className="flex items-center gap-2.5 py-1.5">
          <div className="text-base w-6 text-center">{medals[i]}</div>
          <div className="text-sm font-medium flex-1" style={{ color: t.text }}>{entry.name}{entry.isYou ? " (You)" : ""}</div>
          <div className="text-[13px] font-semibold shrink-0" style={{ color: dark ? "#6ee7b7" : "#059669" }}>
            {entry.orders} order{entry.orders !== 1 ? "s" : ""}
          </div>
        </div>
      ))}
      {onViewAll && <button onClick={onViewAll} className="block text-center mt-3 text-[13px] font-medium cursor-pointer py-1.5 rounded-lg bg-transparent border-none font-[inherit] w-full transition-all duration-200 hover:-translate-y-px" style={{ color: dark ? "#c47d8e" : "#a3586b" }}>View full leaderboard →</button>}
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
    <div className="rounded-[14px] p-4 mb-4 border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.9)", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-3 py-2 px-3 rounded-lg flex items-center gap-2" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>
        <svg width="12" height="12" viewBox="0 0 40 44" fill="none"><path d="M20 2L38 10V22C38 32 30 40 20 44C10 40 2 32 2 22V10L20 2Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.5"/></svg>
        <span>Loyalty Tiers</span>
      </div>
      {yourBadge && (
        <div className="py-2.5 px-3 rounded-lg mb-3 text-[13px]" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", color: t.text }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldBadge color={yourBadge.color} size={16} tier={yourBadge.name} />
            <span>You are <strong style={{ color: yourBadge.color }}>{yourBadge.name}</strong></span>
            {yourBadge.discount > 0 && <span className="text-xs" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{yourBadge.discount}% off</span>}
          </div>
          {yourBadge.nextTier && (
            <div className="text-[11px]" style={{ color: t.textMuted }}>
              Keep ordering to reach {yourBadge.nextTier.name}
            </div>
          )}
        </div>
      )}
      {tiers.map((tier, i) => {
        const isCurrent = yourBadge?.name === tier.name;
        return (
          <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` : "none", opacity: isCurrent ? 1 : 0.85 }}>
            <ShieldBadge color={tier.color} size={14} tier={tier.name} />
            <div className="flex-1">
              <div className="text-xs" style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? tier.color : t.text }}>{tier.name}</div>
              <div className="text-[10px]" style={{ color: t.textMuted }}>{tier.perks || (tier.discount > 0 ? `${tier.discount}% discount` : "No perks")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
