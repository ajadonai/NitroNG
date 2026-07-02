import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import PortalShell from "@/components/m/shell";

export default async function PortalLayout({ children }) {
  const member = await getCrewSession();
  if (!member) redirect("/pit/login");
  return <PortalShell member={memberToClient(member)}>{children}</PortalShell>;
}
