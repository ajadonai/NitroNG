import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import CommissionsPage from "@/components/m/commissions-page";

export default async function Commissions() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  return <CommissionsPage member={memberToClient(member)} />;
}
