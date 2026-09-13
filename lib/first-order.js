import prisma from '@/lib/prisma';
import { tgOutreachAlert } from '@/lib/telegram';
import { sendOutreach as ifySendOutreach } from '@/lib/ify/outreach';

/**
 * The first-order moment: the Telegram outreach alert, which credits the agent
 * who brought the customer, and Ify's first-order WhatsApp message.
 *
 * Fired after the order commits from every path that creates orders — the
 * customer's single and bulk routes and the admin's — so a sale closed on
 * WhatsApp and keyed in by staff counts the same as one placed on the site.
 * Until 13 Sep 2026 each customer route carried its own copy and the admin
 * route had none, so an agent's first conversion vanished whenever staff
 * placed the order for them.
 *
 * `justCreated` is how many orders the caller made in this transaction. A
 * bulk first purchase creates N rows at once, and the old `count === 1` check
 * silently missed every customer whose first order was a cart.
 */
export async function checkFirstOrder(userId, serviceName, justCreated = 1) {
  try {
    const count = await prisma.order.count({ where: { userId, deletedAt: null } });
    if (count !== justCreated) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true, createdAt: true } });
    if (!user) return;
    tgOutreachAlert(user, 'firstOrder', { serviceName }).catch(() => {});
    ifySendOutreach({ user: { id: userId, ...user }, trigger: 'firstOrder', extra: { serviceName } }).catch(() => {});
  } catch {}
}
