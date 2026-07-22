import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction, canSeeSensitive, maskEmail, maskPhone } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';
import { getRewardsPayload, getPointsTotals, getPointsHistory } from '@/lib/nitro-rewards';
import { reinstatePendingAccountDeletion } from '@/lib/account-deletion';
import { fetchWithRetry } from '@/lib/fetch';
import { getApplicationUrl } from '@/lib/env';
import { tgManualPending, tgAdminCredit } from '@/lib/telegram';

export async function GET(req) {
  const { admin, error } = await requireAdmin('users');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const perPage = Math.min(Math.max(1, Number(url.searchParams.get('perPage')) || 15), 50);
    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status') || '';
    const sortKey = url.searchParams.get('sort') || 'joined';
    const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const quick = url.searchParams.get('quick') || '';
    const isExport = url.searchParams.get('export') === 'true';
    const includeStats = url.searchParams.get('includeStats') === 'true';

    // --- Where clauses ---
    const searchWhere = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { deletedName: { contains: search, mode: 'insensitive' } },
        { deletedEmail: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    const statusWhere = status === 'active' ? { status: 'Active' }
      : status === 'suspended' ? { status: 'Suspended' }
      : status === 'pending' ? { status: 'PendingDeletion' }
      : status === 'deleted' ? { status: 'Deleted' }
      : {};

    const quickWhere = quick === 'funded' ? { balance: { gt: 0 } }
      : quick === 'buyers' ? { orders: { some: { status: { not: 'Cancelled' }, deletedAt: null } } }
      : {};

    // baseWhere = search + quick (used for tab counts)
    const baseWhere = { AND: [searchWhere, quickWhere].filter(w => Object.keys(w).length > 0) };
    // fullWhere = search + quick + status tab (used for user list + filteredCount)
    const fullWhere = { AND: [searchWhere, quickWhere, statusWhere].filter(w => Object.keys(w).length > 0) };

    // --- Sort ---
    const orderBy = sortKey === 'name' ? { name: sortDir }
      : sortKey === 'balance' ? { balance: sortDir }
      : sortKey === 'orders' ? { orders: { _count: sortDir } }
      : { createdAt: sortDir };

    // --- Dates for stats ---
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- Select fields ---
    const userSelect = {
      id: true, name: true, firstName: true, lastName: true, phone: true,
      email: true, balance: true, status: true,
      emailVerified: true, referralCode: true, createdAt: true,
      deletedAt: true, deletedName: true, deletedEmail: true,
      _count: { select: { orders: { where: { status: { not: 'Cancelled' }, deletedAt: null } } } },
    };

    // Search/list requests stay lean. Global stats are loaded only when requested.
    const [filteredCount, tabCountsRaw, users] = await Promise.all([
      prisma.user.count({ where: fullWhere }),
      prisma.user.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
      prisma.user.findMany({
        where: fullWhere,
        orderBy,
        select: userSelect,
        ...(isExport ? { take: 10000 } : { skip: (page - 1) * perPage, take: perPage }),
      }),
    ]);

    let stats;
    if (includeStats) {
      const [totalUsers, activeUsers, balanceAgg, totalOrders, newThisWeek, ordersThisMonth, fundedWallets] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'Active' } }),
        prisma.user.aggregate({ _sum: { balance: true } }),
        prisma.order.count({ where: { status: { not: 'Cancelled' }, deletedAt: null } }),
        prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
        prisma.order.count({ where: { createdAt: { gte: startOfMonth }, status: { not: 'Cancelled' }, deletedAt: null } }),
        prisma.user.count({ where: { balance: { gt: 0 } } }),
      ]);
      stats = {
        totalUsers,
        activeUsers,
        totalBalance: (balanceAgg._sum.balance || 0) / 100,
        totalOrders,
        newThisWeek,
        ordersThisMonth,
        fundedWallets,
      };
    }

    // --- Build tab counts map ---
    const tabCounts = { all: 0, active: 0, suspended: 0, pending: 0, deleted: 0 };
    for (const row of tabCountsRaw) {
      const c = row._count._all;
      tabCounts.all += c;
      if (row.status === 'Active') tabCounts.active = c;
      else if (row.status === 'Suspended') tabCounts.suspended = c;
      else if (row.status === 'PendingDeletion') tabCounts.pending = c;
      else if (row.status === 'Deleted') tabCounts.deleted = c;
    }

    const totalPages = Math.ceil(filteredCount / perPage);

    const sensitive = canSeeSensitive(admin);

    return Response.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: sensitive ? u.phone : maskPhone(u.phone),
        email: sensitive ? u.email : maskEmail(u.email),
        balance: u.balance / 100,
        verified: u.emailVerified,
        orders: u._count.orders,
        status: u.status,
        refCode: u.referralCode,
        joined: u.createdAt.toISOString(),
        deletedAt: u.deletedAt?.toISOString() || null,
        deletedName: u.deletedName || null,
        deletedEmail: sensitive ? (u.deletedEmail || null) : maskEmail(u.deletedEmail),
        canReinstate: u.status === 'PendingDeletion' && Boolean(u.deletedAt && u.deletedAt > now),
      })),
      filteredCount,
      totalPages,
      page,
      tabCounts,
      ...(stats ? { stats } : {}),
    });
  } catch (err) {
    log.error('Admin Users', err.message);
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId, amount, subtype } = body;

    if (!userId) return Response.json({ error: 'User ID required' }, { status: 400 });

    // Rewards is read-only
    if (action === 'rewards') {
      const { admin, error } = await requireAdmin('users');
      if (error) return error;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
      const [payload, totals, history] = await Promise.all([
        getRewardsPayload(userId),
        getPointsTotals(userId),
        getPointsHistory(userId, 20),
      ]);
      return Response.json({ rewards: { ...payload, totals, history } });
    }

    // Transactions is read-only — doesn't need write permission
    if (action === 'transactions') {
      const { admin, error } = await requireAdmin('users');
      if (error) return error;
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, amount: true, status: true, method: true, reference: true, note: true, createdAt: true },
      });
      return Response.json({ transactions });
    }

    // All other actions require write permission
    const { admin, error } = await requireAdmin('users', true);
    if (error) return error;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Permanent deletion is irreversible. Historical rewards and transactions remain
    // readable for audit, but no admin mutation may recreate or enrich the account.
    if (user.status === 'Deleted') {
      return Response.json({ error: 'Permanently deleted accounts cannot be changed' }, { status: 409 });
    }
    if (user.status === 'PendingDeletion' && action !== 'reinstate') {
      return Response.json({ error: 'Accounts awaiting deletion can only be restored' }, { status: 409 });
    }

    if (action === 'edit') {
      if (!canPerformAction(admin, 'users.edit')) return Response.json({ error: 'Not authorized to edit users' }, { status: 403 });
      const updates = {};
      if (body.name !== undefined && body.name.trim()) updates.name = body.name.trim();
      if (body.email !== undefined && body.email.trim()) {
        const existing = await prisma.user.findFirst({ where: { email: body.email.trim(), id: { not: userId } } });
        if (existing) return Response.json({ error: 'Email already in use' }, { status: 409 });
        updates.email = body.email.trim();
      }
      if (body.phone !== undefined) updates.phone = body.phone.trim() || null;
      if (!Object.keys(updates).length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
      await prisma.user.update({ where: { id: userId }, data: updates });
      const changes = Object.entries(updates).map(([k, v]) => `${k}: ${v || '(cleared)'}`).join(', ');
      await logActivity(admin.name, `Edited ${user.name}: ${changes}`, 'user');
      return Response.json({ success: true, message: `Updated ${Object.keys(updates).join(', ')}`, updates });
    }

    if (action === 'credit') {
      if (!canPerformAction(admin, 'users.adjustBalance')) return Response.json({ error: 'Not authorized to adjust balances' }, { status: 403 });
      const amountKobo = Math.round(Number(amount) * 100);
      if (!amountKobo || amountKobo <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });
      const isGift = subtype === 'gift';
      const txType = isGift ? 'admin_gift' : 'admin_credit';
      const label = isGift ? 'Gifted' : 'Credited';

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amountKobo } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: txType,
            amount: amountKobo,
            method: 'admin',
            status: 'Completed',
            note: `${label} by Nitro Team`,
          },
        }),
      ]);

      await logActivity(admin.name, `${label} ₦${Number(amount).toLocaleString()} to ${user.name}`, 'user');
      tgAdminCredit(admin.name, user.name, user.email, amountKobo, isGift ? 'gift' : 'credit');

      if (user.email && user.notifEmail !== false) {
        const reason = isGift ? 'You received a gift!' : 'Balance credited';
        const html = walletCreditEmail(user.name, Number(amount), reason);
        sendEmail(user.email, `₦${Number(amount).toLocaleString()} credited to your Nitro wallet`, html).catch(() => {});
      }

      return Response.json({ success: true, message: `₦${Number(amount).toLocaleString()} credited to ${user.name}` });
    }

    if (action === 'suspend') {
      if (!canPerformAction(admin, 'users.ban')) return Response.json({ error: 'Not authorized to suspend users' }, { status: 403 });
      if (user.status !== 'Active') return Response.json({ error: 'Only active users can be suspended' }, { status: 409 });
      await prisma.user.update({ where: { id: userId }, data: { status: 'Suspended' } });
      await logActivity(admin.name, `Suspended user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} suspended` });
    }

    if (action === 'activate') {
      if (user.status !== 'Suspended') return Response.json({ error: 'Only suspended users can be activated' }, { status: 409 });
      await prisma.user.update({ where: { id: userId }, data: { status: 'Active' } });
      await logActivity(admin.name, `Activated user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} activated` });
    }

    if (action === 'reinstate') {
      if (user.status !== 'PendingDeletion') {
        return Response.json({ error: 'Only accounts awaiting deletion can be restored' }, { status: 409 });
      }
      if (!user.deletedAt || user.deletedAt <= new Date()) {
        return Response.json({ error: 'The account deletion deadline has passed' }, { status: 409 });
      }
      const result = await reinstatePendingAccountDeletion(prisma, userId);
      if (!result?.reinstated) {
        return Response.json({ error: 'This account can no longer be restored' }, { status: 409 });
      }
      await logActivity(admin.name, `Reinstated user ${result.user.name} (${result.user.email})`, 'user');
      return Response.json({ success: true, message: `${result.user.name} reinstated` });
    }

    if (action === 'generate_payment_link') {
      const amountNum = Number(amount);
      if (!amountNum || amountNum < 1000)
        return Response.json({ error: 'Minimum deposit is ₦1,000' }, { status: 400 });
      if (amountNum > 10_000_000)
        return Response.json({ error: 'Maximum deposit is ₦10,000,000' }, { status: 400 });

      const fwSetting = await prisma.setting.findUnique({ where: { key: 'gateway_flutterwave' } });
      let secretKey = '';
      if (fwSetting) {
        try { const d = JSON.parse(fwSetting.value); if (d.fields?.secretKey) secretKey = d.fields.secretKey; } catch {}
      }
      if (!secretKey) secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
      if (!secretKey)
        return Response.json({ error: 'Flutterwave is not configured' }, { status: 503 });

      const amountKobo = Math.round(amountNum * 100);
      const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const origin = getApplicationUrl();

      await prisma.transaction.create({
        data: {
          userId,
          type: 'deposit',
          amount: amountKobo,
          method: 'flutterwave',
          status: 'Pending',
          reference,
          note: `Admin-initiated deposit ₦${amountNum.toLocaleString()} [initiated_by:${admin.name}]`,
        },
      });

      const res = await fetchWithRetry('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: reference,
          amount: amountNum,
          currency: 'NGN',
          payment_options: 'banktransfer',
          redirect_url: `${origin}/dashboard?verify=${reference}`,
          customer: { email: user.email, name: user.name },
          customizations: { title: 'Nitro Deposit', logo: `${origin}/icon-192.png` },
          meta: { userId, adminInitiated: true },
        }),
      });
      const data = await res.json();
      if (data.status !== 'success') {
        log.error('Admin Flutterwave Init', data.message);
        await prisma.transaction.update({ where: { reference }, data: { status: 'Failed' } });
        return Response.json({ error: data.message || 'Payment link generation failed' }, { status: 400 });
      }

      await prisma.transaction.update({ where: { reference }, data: { gatewayUrl: data.data.link } });
      await logActivity(admin.name, `Generated ₦${amountNum.toLocaleString()} payment link for ${user.name}`, 'user');

      return Response.json({ success: true, paymentUrl: data.data.link, reference });
    }

    if (action === 'manual_topup') {
      const amountNum = Number(amount);

      if (!body.confirm) {
        const manualSetting = await prisma.setting.findUnique({ where: { key: 'gateway_manual' } });
        if (!manualSetting) return Response.json({ error: 'Bank transfer not configured' }, { status: 503 });
        let config;
        try { config = JSON.parse(manualSetting.value); } catch { return Response.json({ error: 'Bank transfer not configured' }, { status: 503 }); }
        if (!config.enabled) return Response.json({ error: 'Bank transfer is not available' }, { status: 503 });
        const { bankName, accountNumber, accountName } = config.fields || {};
        if (!bankName || !accountNumber || !accountName) return Response.json({ error: 'Bank details not configured' }, { status: 503 });
        return Response.json({ bankName, accountNumber, accountName, canCreditDirectly: canPerformAction(admin, 'users.adjustBalance') });
      }

      if (!amountNum || amountNum < 1) return Response.json({ error: 'Invalid amount' }, { status: 400 });
      const senderName = (body.senderName || '').replace(/<[^>]*>/g, '').replace(/[^\w\s\-\/\.#]/g, '').trim().slice(0, 100);
      if (!senderName || senderName.length < 3) return Response.json({ error: 'Enter the sender name (min 3 characters)' }, { status: 400 });

      const amountKobo = Math.round(amountNum * 100);

      if (canPerformAction(admin, 'users.adjustBalance')) {
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { balance: { increment: amountKobo } } }),
          prisma.transaction.create({
            data: { userId, type: 'admin_credit', amount: amountKobo, method: 'admin', status: 'Completed',
              note: `Credited by ${admin.name} (transfer from ${senderName})` },
          }),
        ]);
        await logActivity(admin.name, `Credited ₦${amountNum.toLocaleString()} to ${user.name} (sender: ${senderName})`, 'user');
        tgAdminCredit(admin.name, user.name, user.email, amountKobo, 'credit');
        if (user.email && user.notifEmail !== false) {
          const html = walletCreditEmail(user.name, amountNum, 'Balance credited');
          sendEmail(user.email, `₦${amountNum.toLocaleString()} credited to your Nitro wallet`, html).catch(() => {});
        }
        return Response.json({ success: true, credited: true, message: `₦${amountNum.toLocaleString()} credited to ${user.name}` });
      }

      const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const tx = await prisma.transaction.create({
        data: { userId, type: 'deposit', amount: amountKobo, method: 'manual', status: 'Pending', reference,
          note: `Manual bank transfer ₦${amountNum.toLocaleString()} [user_confirmed:${senderName}] [admin_initiated:${admin.name}]` },
      });
      await logActivity(admin.name, `Submitted ₦${amountNum.toLocaleString()} manual deposit for ${user.name} (sender: ${senderName})`, 'user');
      tgManualPending(tx.id, user.name, user.email, amountKobo, senderName);
      return Response.json({ success: true, pending: true, message: 'Deposit submitted for approval' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Users POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
