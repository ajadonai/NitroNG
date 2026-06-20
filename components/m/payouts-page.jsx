"use client";
import PortalShell from "./shell";
import { EmptyState } from "./kit";
import { useTheme } from "../shared-nav";

function Inner() {
  const { t } = useTheme();
  return (
    <EmptyState
      title="Payouts"
      subtitle="Request payouts and track your payout history here."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
      t={t}
    />
  );
}

export default function PayoutsPage({ member }) {
  return <PortalShell member={member}><Inner /></PortalShell>;
}
