import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { watBounds } from '@/lib/format';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { todayStart: today } = watBounds();

  const watchCount = await prisma.videoWatch.count({
    where: { userId: session.id, createdAt: { gte: today } },
  });

  const capSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_daily_cap' } });
  const enabledSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_enabled' } });
  const rewardSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_reward_per_watch' } });

  const dailyCap = capSetting ? parseInt(capSetting.value) : 5;
  const enabled = enabledSetting ? enabledSetting.value === 'true' : false;
  const rewardPerWatch = rewardSetting ? parseInt(rewardSetting.value) : 1500;

  return Response.json({
    enabled,
    watchedToday: watchCount,
    dailyCap,
    remaining: Math.max(0, dailyCap - watchCount),
    rewardPerWatch,
  });
}
