import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { sendDM, replyInGroup } from '@/lib/crew-bot';

export const maxDuration = 60;

function getWeekStartUTC() {
  const now = new Date();
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  const day = wat.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(wat);
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return new Date(monday.getTime() - 60 * 60 * 1000);
}

async function getMemberSlugs(memberId) {
  const links = await prisma.acquisitionLink.findMany({
    where: { affiliateId: memberId, archivedAt: null },
    select: { slug: true },
  });
  return links.map(l => l.slug);
}

async function getTeamSlugs(chiefId) {
  const members = await prisma.crewMember.findMany({
    where: { OR: [{ id: chiefId }, { leadId: chiefId }], status: 'approved' },
    select: { id: true },
  });
  const ids = members.map(m => m.id);
  const links = await prisma.acquisitionLink.findMany({
    where: { affiliateId: { in: ids }, archivedAt: null },
    select: { slug: true, affiliateId: true },
  });
  return { memberIds: ids, links };
}

async function handleMyStats(member) {
  const slugs = await getMemberSlugs(member.id);
  if (!slugs.length) return '📊 <b>Your Stats</b>\n\nNo active links assigned yet.';

  const week = getWeekStartUTC();
  const [totalSignups, weekSignups, totalOrders, weekOrders] = await Promise.all([
    prisma.user.count({ where: { signupSource: { in: slugs } } }),
    prisma.user.count({ where: { signupSource: { in: slugs }, createdAt: { gte: week } } }),
    prisma.order.count({ where: { user: { signupSource: { in: slugs } }, deletedAt: null, status: { not: 'Cancelled' } } }),
    prisma.order.count({ where: { user: { signupSource: { in: slugs } }, deletedAt: null, status: { not: 'Cancelled' }, createdAt: { gte: week } } }),
  ]);

  return [
    '📊 <b>Your Stats</b>',
    '',
    '<b>This week</b>',
    `  Signups: ${weekSignups}`,
    `  Orders: ${weekOrders}`,
    '',
    '<b>All time</b>',
    `  Signups: ${totalSignups}`,
    `  Orders: ${totalOrders}`,
    `  Tier: ${member.tier.charAt(0).toUpperCase() + member.tier.slice(1)}`,
  ].join('\n');
}

async function handleTeam(member) {
  const chiefId = member.leadId || member.id;
  const chief = chiefId === member.id ? member : await prisma.crewMember.findUnique({ where: { id: chiefId }, select: { name: true } });
  if (!chief) return 'Could not find your team.';

  const { memberIds, links } = await getTeamSlugs(chiefId);
  const slugs = links.map(l => l.slug);
  if (!slugs.length) return `🏠 <b>Team ${chief.name}</b>\n\nNo active links yet.`;

  const week = getWeekStartUTC();
  const [weekSignups, weekOrders] = await Promise.all([
    prisma.user.count({ where: { signupSource: { in: slugs }, createdAt: { gte: week } } }),
    prisma.order.count({ where: { user: { signupSource: { in: slugs } }, deletedAt: null, status: { not: 'Cancelled' }, createdAt: { gte: week } } }),
  ]);

  const members = await prisma.crewMember.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true, role: true },
  });

  const memberLines = members.map(m => {
    const badge = m.role === 'chief' ? ' 👑' : '';
    return `  ${m.name}${badge}`;
  });

  return [
    `🏠 <b>Team ${chief.name}</b>`,
    '',
    '<b>This week</b>',
    `  Signups: ${weekSignups}`,
    `  Orders: ${weekOrders}`,
    '',
    `<b>Members (${members.length})</b>`,
    ...memberLines,
  ].join('\n');
}

async function handleTop() {
  const chiefs = await prisma.crewMember.findMany({
    where: { role: 'chief', status: 'approved' },
    select: { id: true, name: true },
  });
  if (!chiefs.length) return '🏆 <b>Leaderboard</b>\n\nNo teams yet.';

  const week = getWeekStartUTC();
  const teams = [];

  for (const chief of chiefs) {
    const { links } = await getTeamSlugs(chief.id);
    const slugs = links.map(l => l.slug);
    if (!slugs.length) { teams.push({ name: chief.name, orders: 0, signups: 0 }); continue; }

    const [orders, signups] = await Promise.all([
      prisma.order.count({ where: { user: { signupSource: { in: slugs } }, deletedAt: null, status: { not: 'Cancelled' }, createdAt: { gte: week } } }),
      prisma.user.count({ where: { signupSource: { in: slugs }, createdAt: { gte: week } } }),
    ]);
    teams.push({ name: chief.name, orders, signups });
  }

  teams.sort((a, b) => b.orders - a.orders);

  const lines = teams.map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} <b>Team ${t.name}</b> — ${t.orders} orders, ${t.signups} signups`;
  });

  return ['🏆 <b>Weekly Leaderboard</b>', '', ...lines].join('\n');
}

async function handleLink(member) {
  const links = await prisma.acquisitionLink.findMany({
    where: { affiliateId: member.id, archivedAt: null, enabled: true },
    select: { slug: true },
  });
  if (!links.length) return '🔗 No active links assigned. Ask your Crew Chief.';

  const lines = links.map(l => `  https://nitro.ng/?via=${l.slug}`);
  return ['🔗 <b>Your Links</b>', '', ...lines].join('\n');
}

export async function POST(req) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.CRON_SECRET) return Response.json({ ok: true });

  try {
    const update = await req.json();
    const msg = update.message;
    if (!msg?.text) return Response.json({ ok: true });

    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);
    const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';
    const text = msg.text.trim();
    const command = text.split(/[\s@]/)[0].toLowerCase();

    // /start — link account (DM only)
    if (command === '/start') {
      if (isGroup) return Response.json({ ok: true });
      const code = text.split(/\s+/)[1];
      if (!code) {
        await sendDM(chatId, [
          '👋 <b>Nitro Crew Bot</b>',
          '',
          'Link your account:',
          '1. Go to <b>nitro.ng/m/settings</b>',
          '2. Click <b>Link Telegram</b>',
          '3. Send the code here: <code>/start YOUR_CODE</code>',
        ].join('\n'));
        return Response.json({ ok: true });
      }

      const member = await prisma.crewMember.findFirst({
        where: { telegramLinkCode: code.toUpperCase(), status: 'approved' },
      });
      if (!member) {
        await sendDM(chatId, 'Invalid or expired code. Generate a new one at nitro.ng/m/settings.');
        return Response.json({ ok: true });
      }

      await prisma.crewMember.update({
        where: { id: member.id },
        data: { telegramUserId: userId, telegramLinkCode: null },
      });
      await sendDM(chatId, `✅ Linked as <b>${member.name}</b>! You'll now receive updates in the crew group.`);
      return Response.json({ ok: true });
    }

    // All other commands require a linked account
    if (!['/mystats', '/team', '/top', '/link'].includes(command)) {
      return Response.json({ ok: true });
    }

    const member = await prisma.crewMember.findFirst({
      where: { telegramUserId: userId, status: 'approved' },
    });
    if (!member) {
      const hint = 'Link your account first at <b>nitro.ng/m/settings</b>';
      if (isGroup) replyInGroup(chatId, msg.message_id, hint);
      else await sendDM(chatId, hint);
      return Response.json({ ok: true });
    }

    let response;
    if (command === '/mystats') response = await handleMyStats(member);
    else if (command === '/team') response = await handleTeam(member);
    else if (command === '/top') response = await handleTop();
    else if (command === '/link') response = await handleLink(member);

    if (isGroup) {
      replyInGroup(chatId, msg.message_id, 'Check your DMs 📩');
      const sent = await sendDM(userId, response);
      if (!sent) replyInGroup(chatId, msg.message_id, 'DM me first: tap my name and press Start.');
    } else {
      await sendDM(chatId, response);
    }
  } catch (err) {
    log.error('Crew Webhook', err.message);
  }

  return Response.json({ ok: true });
}
