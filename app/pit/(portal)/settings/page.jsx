import { getCrewSession, memberToClient } from "@/lib/crew";
import { getAffiliateSettings } from "@/lib/affiliate-settings";
import SettingsPage from "@/components/m/settings-page";

export default async function Settings() {
  const member = await getCrewSession();
  const keys = ['crew_telegram_group_link'];
  if (member.role === 'chief') keys.push('affiliate_pro_rate');
  const s = await getAffiliateSettings(keys);
  member._telegramGroupLink = s.crew_telegram_group_link || null;
  if (member.role === 'chief') member.commissionRate = s.affiliate_pro_rate;
  return <SettingsPage member={memberToClient(member, true)} />;
}
