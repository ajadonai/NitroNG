import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const enabledSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_enabled' } });
  if (!enabledSetting || enabledSetting.value !== 'true') {
    return Response.json({ error: 'Video rewards not enabled' }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const watchCount = await prisma.videoWatch.count({
    where: { userId: session.id, createdAt: { gte: today } },
  });

  const capSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_daily_cap' } });
  const dailyCap = capSetting ? parseInt(capSetting.value) : 5;
  if (watchCount >= dailyCap) {
    return Response.json({ error: 'Daily limit reached' }, { status: 400 });
  }

  const rewardSetting = await prisma.setting.findUnique({ where: { key: 'earn_video_reward_per_watch' } });
  const earned = rewardSetting ? parseInt(rewardSetting.value) : 1500;

  await prisma.$transaction([
    prisma.videoWatch.create({
      data: { userId: session.id, earned },
    }),
    prisma.user.update({
      where: { id: session.id },
      data: { balance: { increment: earned } },
    }),
    prisma.transaction.create({
      data: {
        userId: session.id,
        type: 'video_reward',
        amount: earned,
        status: 'Completed',
        note: `Video reward (watch ${watchCount + 1}/${dailyCap})`,
      },
    }),
  ]);

  return Response.json({ ok: true, earned, watchedToday: watchCount + 1, dailyCap });
}
