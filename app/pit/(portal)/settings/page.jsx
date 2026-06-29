import prisma from "@/lib/prisma";
import { getCrewSession, memberToClient } from "@/lib/crew";
import SettingsPage from "@/components/m/settings-page";

export default async function Settings() {
  const member = await getCrewSession();
  const [groupLinkSetting, proRateSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "crew_telegram_group_link" } }),
    member.role === "chief" ? prisma.setting.findUnique({ where: { key: "affiliate_pro_rate" } }) : null,
  ]);
  member._telegramGroupLink = groupLinkSetting?.value || null;
  if (member.role === "chief") member.commissionRate = parseInt(proRateSetting?.value) || 50;
  return <SettingsPage member={memberToClient(member, true)} />;
}
