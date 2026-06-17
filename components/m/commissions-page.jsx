"use client";
import PortalShell from "./shell";
import { EmptyState } from "./kit";
import { useTheme } from "../shared-nav";

function Inner() {
  const { t } = useTheme();
  return (
    <EmptyState
      title="Commissions"
      subtitle="Your commission history and earnings breakdown will appear here."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
      t={t}
    />
  );
}

export default function CommissionsPage({ member }) {
  return <PortalShell member={member}><Inner /></PortalShell>;
}
