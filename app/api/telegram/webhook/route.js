import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { applyWelcomeBonus } from '@/lib/welcome-bonus';
import { tgAnswerCallback, tgEditMessage, tgPayment } from '@/lib/telegram';

export async function POST(req) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.CRON_SECRET) return Response.json({ ok: true });

  const update = await req.json();
  const cb = update.callback_query;
  if (!cb?.data || !cb.message) return Response.json({ ok: true });

  const chatId = cb.message.chat?.id || cb.message.sender_chat?.id;
  if (String(chatId) !== process.env.TG_CHAT_ID) return Response.json({ ok: true });

  const ADMIN_TG_IDS = ['8567146346'];
  if (!ADMIN_TG_IDS.includes(String(cb.from?.id))) {
    tgAnswerCallback(cb.id, 'Not authorised');
    return Response.json({ ok: true });
  }

  const [action, txId] = cb.data.split(':');
  if (!txId) return Response.json({ ok: true });

  try {
    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx || tx.method !== 'manual') {
      tgAnswerCallback(cb.id, 'Transaction not found');
      return Response.json({ ok: true });
    }
    if (tx.status !== 'Pending') {
      const label = tx.status === 'Completed' ? '✅ Already approved' : tx.status === 'Rejected' ? '❌ Already rejected' : `⚪ Already ${tx.status.toLowerCase()}`;
      const via = tx.note?.match(/\[(approved|rejected)_by:([^\]]*)\]/);
      const byWho = via ? ` by ${via[2]}` : '';
      tgAnswerCallback(cb.id, `${label}${byWho}`);
      tgEditMessage(cb.message.message_id, cb.message.text + `\n\n${label}${byWho}`);
      return Response.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { id: tx.userId }, select: { name: true, email: true } });
    const name = user?.name || user?.email || 'Unknown';

    if (action === 'approve') {
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      const couponId = couponMatch?.[1];

      await prisma.$transaction(async (db) => {
        const claimed = await db.transaction.updateMany({
          where: { id: txId, status: 'Pending' },
          data: { status: 'Completed', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, '[approved_by:Telegram]') },
        });
        if (claimed.count === 0) throw new Error('already_processed');

        let bonus = 0;
        if (couponId) {
          const alreadyUsed = await db.transaction.findFirst({
            where: { userId: tx.userId, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
          });
          if (!alreadyUsed) {
            const [row] = await db.$queryRaw`SELECT value FROM settings WHERE key = 'coupons' FOR UPDATE`;
            if (row) {
              const coupons = JSON.parse(row.value);
              const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
              if (coupon) {
                const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
                const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
                if (notExpired && notMaxed) {
                  const cappedAmount = coupon.maxDeposit > 0 ? Math.min(tx.amount, coupon.maxDeposit * 100) : tx.amount;
                  bonus = coupon.type === 'percent' ? Math.round(cappedAmount * (coupon.value / 100)) : coupon.value * 100;
                  await db.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) } });
                }
              }
            }
          }
        }

        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount + bonus } } });
        if (bonus > 0) {
          await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Coupon bonus [cid:${couponId}]` } });
        }
        await applyWelcomeBonus(db, tx.userId, tx.amount);
      });

      await prisma.activityLog.create({
        data: { adminName: 'Telegram', action: `Approved manual deposit ₦${(tx.amount / 100).toLocaleString()} for ${name}`, type: 'payment' },
      });

      tgAnswerCallback(cb.id, `Approved ₦${(tx.amount / 100).toLocaleString()}`);
      tgEditMessage(cb.message.message_id, cb.message.text + `\n\n✅ <b>Approved</b> via Telegram`);
      tgPayment(name, tx.amount, 0, 'Manual', 'Telegram');
      log.info('TG Webhook', `Approved manual deposit ${txId} for ${name}`);

    } else if (action === 'reject') {
      await prisma.transaction.update({
        where: { id: txId },
        data: { status: 'Rejected', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, '[rejected_by:Telegram]') },
      });

      await prisma.activityLog.create({
        data: { adminName: 'Telegram', action: `Rejected manual deposit ₦${(tx.amount / 100).toLocaleString()} for ${name}`, type: 'payment' },
      });

      tgAnswerCallback(cb.id, 'Rejected');
      tgEditMessage(cb.message.message_id, cb.message.text + `\n\n❌ <b>Rejected</b> via Telegram`);
      log.info('TG Webhook', `Rejected manual deposit ${txId} for ${name}`);
    }
  } catch (err) {
    log.error('TG Webhook', err.message);
    tgAnswerCallback(cb.id, 'Error — check admin panel');
  }

  return Response.json({ ok: true });
}
