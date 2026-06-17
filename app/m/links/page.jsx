import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import LinksPage from "@/components/m/links-page";

export default async function Links() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  if (member.role !== "chief") redirect("/m");
  return <LinksPage member={memberToClient(member)} />;
}
