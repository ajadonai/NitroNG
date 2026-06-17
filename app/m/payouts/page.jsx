import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import PayoutsPage from "@/components/m/payouts-page";

export default async function Payouts() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  return <PayoutsPage member={memberToClient(member)} />;
}
