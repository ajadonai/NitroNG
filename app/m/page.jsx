import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import DashboardPage from "@/components/m/dashboard-page";

export default async function CrewDashboard() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  return <DashboardPage member={memberToClient(member)} />;
}
