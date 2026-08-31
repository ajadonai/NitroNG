"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Empty, Fact, Facts, TierProgress, ago, initialsOf, pitVars } from "./kit";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";
import { copyText } from "@/lib/clipboard";

// held → still in the seven-day window, approved → cleared, voided → reversed.
const STATUS = {
  approved: { label: "Cleared", kind: "ok" },
  held: { label: "Holding", kind: "warn" },
  voided: { label: "Reversed", kind: "bad" },
  pending: { label: "Pending", kind: "dim" },
};

export default function DashboardPage({ initialData }) {
  const { dark, t } = useTheme();
  const router = useRouter();
  const [copied, setCopied] = useState(null);
  const { stats, role, tier, tierConfig, recentCommissions, links } = initialData;

  const copy = (slug) => {
    copyText(`https://nitro.ng/?via=${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="dsh" style={pitVars(dark, t)}>
      <style>{DSH_CSS}</style>

      <Facts>
        <Fact value={fN(stats.totalEarned)} label="Earned" sub={`all time · ${stats.conversions} ${stats.conversions === 1 ? "commission" : "commissions"}`} />
        <Fact value={fN(stats.pending)} label="Holding" sub="clears seven days after the order" kind="warn" />
        <Fact value={fN(stats.availableBalance)} label="Ready to withdraw" sub="request any time" kind="ok" />
        <Fact value={stats.clicks.toLocaleString()} label="Link clicks" sub={`${stats.activeReferrals} paid ${stats.activeReferrals === 1 ? "referral" : "referrals"}`} />
      </Facts>

      {role !== "chief" && <TierProgress tier={tier.name} activeCount={stats.activeReferrals} tierConfig={tierConfig} />}

      <Card
        title="Recent commissions"
        cnt="the last few · seven-day hold before they clear"
        act={recentCommissions.length > 0 ? <a href="/pit/commissions" onClick={(e) => { e.preventDefault(); router.push("/pit/commissions"); }} className="pt-lnk">All commissions ›</a> : null}
      >
        {recentCommissions.length === 0 ? (
          <Empty>Nothing yet. Share a link and the first one lands here.</Empty>
        ) : (
          <div className="pt-list">
            {recentCommissions.map((c) => {
              const s = STATUS[c.status] || STATUS.pending;
              const who = c.type === "team" && c.memberName ? c.memberName : c.orderId;
              return (
                <div key={c.id} className="pt-r cm">
                  <span className="pt-av sm">{c.type === "team" && c.memberName ? initialsOf(c.memberName) : c.slug.slice(0, 2).toUpperCase()}</span>
                  <span className="pt-tt"><b>{who}</b><i>{c.slug} · order {fN(c.orderCharge)}</i></span>
                  <Chip kind={s.kind}>{s.label}</Chip>
                  <span className={"pt-num m" + (c.status === "voided" ? " bad" : "")}>{fN(c.amount)}</span>
                  <span className="pt-c">{ago(c.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Your links"
        cnt="tap a link to copy it"
        act={role === "chief" ? <a href="/pit/links" onClick={(e) => { e.preventDefault(); router.push("/pit/links"); }} className="pt-lnk">All links ›</a> : null}
      >
        {links.length === 0 ? (
          <Empty>No link yet. Your chief hands you one.</Empty>
        ) : (
          <div className="pt-list">
            {links.map((l) => (
              <div key={l.slug} className="pt-r lk">
                <span className="pt-tt">
                  <b>{l.slug}</b>
                  <button type="button" className="pt-cp m" onClick={() => copy(l.slug)}>
                    {copied === l.slug ? "Copied" : `nitro.ng/?via=${l.slug} ⧉`}
                  </button>
                </span>
                <Chip kind={l.enabled ? "ok" : "dim"}>{l.enabled ? "Live" : "Paused"}</Chip>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const DSH_CSS = `
.dsh{display:flex;flex-direction:column;gap:14px}
@media (min-width:900.99px){
  .dsh .pt-r.cm{grid-template-columns:30px 1fr 110px 90px 80px}
  .dsh .pt-r.lk{grid-template-columns:1fr 70px}
}
`;
