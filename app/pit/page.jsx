import { redirect } from "next/navigation";
import { getCrewSession, memberToClient, getDashboardData } from "@/lib/crew";
import DashboardPage from "@/components/m/dashboard-page";

export default async function CrewDashboard() {
  const member = await getCrewSession();
  if (!member) redirect("/pit/login");
  const initialData = await getDashboardData(member);
  return <DashboardPage member={memberToClient(member)} initialData={initialData} />;
}
