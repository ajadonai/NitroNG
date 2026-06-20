"use client";
import PortalShell from "./shell";
import { EmptyState } from "./kit";
import { useTheme } from "../shared-nav";

function Inner() {
  const { t } = useTheme();
  return (
    <EmptyState
      title="Team"
      subtitle="Invite crew members and track their performance."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
      t={t}
    />
  );
}

export default function TeamPage({ member }) {
  return <PortalShell member={member}><Inner /></PortalShell>;
}
