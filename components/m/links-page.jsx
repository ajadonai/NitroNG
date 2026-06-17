"use client";
import PortalShell from "./shell";
import { EmptyState } from "./kit";
import { useTheme } from "../shared-nav";

function Inner() {
  const { t } = useTheme();
  return (
    <EmptyState
      title="Tracking Links"
      subtitle="Create and manage your tracking links, assign them to crew members."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
      t={t}
    />
  );
}

export default function LinksPage({ member }) {
  return <PortalShell member={member}><Inner /></PortalShell>;
}
