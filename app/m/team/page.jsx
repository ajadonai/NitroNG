import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import TeamPage from "@/components/m/team-page";

export default async function Team() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  if (member.role !== "chief") redirect("/m");
  return <TeamPage member={memberToClient(member)} />;
}
