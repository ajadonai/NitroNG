import { redirect } from "next/navigation";
import { getCrewSession, getDashboardData } from "@/lib/crew";
import DashboardPage from "@/components/m/dashboard-page";

export default async function CrewDashboard() {
  const member = await getCrewSession();
  if (!member) redirect("/pit/login");
  const initialData = await getDashboardData(member);
  return <DashboardPage initialData={initialData} />;
}
