"use client";
import PortalShell from "./shell";
import { EmptyState } from "./kit";
import { useTheme } from "../shared-nav";

function Inner({ member }) {
  const { t } = useTheme();
  return (
    <EmptyState
      title="Dashboard"
      subtitle="Your stats, tier progress, and recent activity will appear here."
      t={t}
    />
  );
}

export default function DashboardPage({ member }) {
  return <PortalShell member={member}><Inner member={member} /></PortalShell>;
}
