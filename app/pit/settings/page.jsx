import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCrewSession, memberToClient } from "@/lib/crew";
import SettingsPage from "@/components/m/settings-page";

export default async function Settings() {
  const member = await getCrewSession();
  if (!member) redirect("/pit/login");
  const groupLinkSetting = await prisma.setting.findUnique({ where: { key: "crew_telegram_group_link" } });
  member._telegramGroupLink = groupLinkSetting?.value || null;
  return <SettingsPage member={memberToClient(member, true)} />;
}
