import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import SettingsPage from "@/components/m/settings-page";

export default async function Settings() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  return <SettingsPage member={memberToClient(member)} />;
}
