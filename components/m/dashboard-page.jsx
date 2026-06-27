"use client";
import PortalShell from "./shell";
import { StatCard, TierProgress, LinkPill, StatusBadge } from "./kit";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Inner({ member, initialData }) {
  const { dark, t } = useTheme();
  const { stats, tier, tierConfig, recentCommissions, links } = initialData;
  const primarySlug = links?.[0]?.slug;

  return (
    <div className="flex flex-col gap-5">
      {primarySlug && <LinkPill slug={primarySlug} dark={dark} t={t} />}

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
        <StatCard label="Total Earned" value={fN(stats.totalEarned)} caption={`${stats.conversions} conversion${stats.conversions !== 1 ? "s" : ""}`} dark={dark} t={t} />
        <StatCard label="Pending" value={fN(stats.pending)} caption="Held for 7 days" dark={dark} t={t} />
        <StatCard label="Available" value={fN(stats.availableBalance)} caption="Ready to withdraw" captionUp={stats.availableBalance > 0} dark={dark} t={t} />
        <StatCard label="Link Clicks" value={stats.clicks.toLocaleString()} caption={`${stats.activeReferrals} paid referral${stats.activeReferrals !== 1 ? "s" : ""}`} dark={dark} t={t} />
      </div>

      <TierProgress tier={tier.name} activeCount={stats.activeReferrals} tierConfig={tierConfig} dark={dark} t={t} />

      <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="flex items-center justify-between py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
          <span className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Recent Commissions</span>
          {recentCommissions.length > 0 && (
            <a href="/pit/commissions" className="text-[12px] font-medium no-underline" style={{ color: t.accent }}>View all</a>
          )}
        </div>
        {recentCommissions.length === 0 ? (
          <div className="text-center py-8 text-[13px]" style={{ color: t.muted }}>No commissions yet. Share your link to start earning.</div>
        ) : (
          <div>
            {recentCommissions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-[18px] py-3" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="m text-[13px] font-medium truncate" style={{ color: t.text }}>{c.orderId}</span>
                    {c.type === "team" && (
                      <span className="text-[10px] font-semibold py-[1px] px-[6px] rounded-md" style={{ color: t.accent, background: t.accentLight }}>TEAM</span>
                    )}
                  </div>
                  <div className="text-[11.5px] mt-[2px]" style={{ color: t.muted }}>
                    {c.type === "team" && c.memberName ? `${c.memberName} · ` : ""}{timeAgo(c.createdAt)}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span className="m text-[13.5px] font-semibold" style={{ color: t.green }}>{fN(c.amount)}</span>
                  <StatusBadge status={c.status} dark={dark} t={t} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage({ member, initialData }) {
  return <PortalShell member={member}><Inner member={member} initialData={initialData} /></PortalShell>;
}
