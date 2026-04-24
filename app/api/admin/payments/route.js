import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

const DEFAULT_GATEWAYS = [
  { id: 'flutterwave', name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money', enabled: false, priority: 1, fields: { secretKey: '', publicKey: '' } },
  { id: 'alatpay', name: 'ALATPay (Wema)', desc: 'Direct bank debit', enabled: false, priority: 2, fields: { secretKey: '', publicKey: '' } },
  { id: 'monnify', name: 'Monnify', desc: 'Auto-confirmed bank transfer', enabled: false, priority: 3, fields: { apiKey: '', secretKey: '', contractCode: '' } },
  { id: 'korapay', name: 'KoraPay', desc: 'Cards, Bank Transfer', enabled: false, priority: 4, fields: { secretKey: '', publicKey: '' } },
  { id: 'crypto', name: 'Crypto', desc: 'USDT (TRC-20 / ERC-20)', enabled: false, priority: 5, fields: { apiKey: '' } },
  { id: 'manual', name: 'Bank Transfer (Manual)', desc: 'User transfers to your bank, you confirm', enabled: false, priority: 6, fields: { bankName: '', accountNumber: '', accountName: '' } },
];

async function getGateways() {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: 'gateway_' } },
  });
  const saved = {};
  settings.forEach(s => {
    try { saved[s.key.replace('gateway_', '')] = JSON.parse(s.value); } catch {}
  });

  const defaultIds = DEFAULT_GATEWAYS.map(g => g.id);
  const merged = DEFAULT_GATEWAYS.map(g => ({
    ...g,
    ...(saved[g.id] || {}),
    id: g.id,
    name: g.name,
    desc: g.desc,
    fields: { ...g.fields, ...(saved[g.id]?.fields || {}) },
  }));

  // Add custom gateways not in defaults
  Object.entries(saved).forEach(([id, data]) => {
    if (!defaultIds.includes(id)) {
      merged.push({
        id,
        name: data.name || id,
        desc: data.desc || '',
        enabled: data.enabled || false,
        priority: data.priority || 99,
        fields: data.fields || { secretKey: '', publicKey: '' },
      });
    }
  });

  merged.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  return merged;
}

export async function GET(req) {
  try {
    const { admin, error } = await requireAdmin('payments');
    if (error) return error;

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all'; // all, Pending, Completed, Failed
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const gateways = await getGateways();

    // Build deposit query
    const where = { method: { in: ['manual', 'crypto'] }, type: 'deposit' };
    if (status !== 'all') where.status = status;
    if (from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(from) };
    if (to) where.createdAt = { ...(where.createdAt || {}), lte: new Date(to + 'T23:59:59') };
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const deposits = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
    });

    // Mask secret keys for display
    const masked = gateways.map(g => ({
      ...g,
      fields: Object.fromEntries(
        Object.entries(g.fields).map(([k, v]) => [k, v ? `${'•'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : ''])
      ),
      hasKeys: Object.values(g.fields).some(v => v && v.length > 4),
    }));

    const formatTx = (tx) => {
      const refMatch = tx.note?.match(/\[user_confirmed:?([^\]]*)\]/);
      const approvedMatch = tx.note?.match(/\[approved_by:([^\]]*)\]/);
      const rejectedMatch = tx.note?.match(/\[rejected_by:([^\]]*)\]/);
      return {
        id: tx.id, amount: tx.amount / 100, reference: tx.reference, method: tx.method,
        status: tx.status, note: tx.note, date: tx.createdAt.toISOString(),
        user: tx.user ? `${tx.user.firstName || tx.user.name || ''} ${tx.user.lastName || ''}`.trim() : 'Unknown',
        email: tx.user?.email || '',
        confirmed: tx.note?.includes('[user_confirmed'),
        senderRef: refMatch?.[1] || null,
        actionBy: approvedMatch?.[1] || rejectedMatch?.[1] || null,
      };
    };

    return Response.json({
      gateways: masked,
      deposits: deposits.map(formatTx),
      pendingCount: deposits.filter(d => d.status === 'Pending').length,
      canApprove: canPerformAction(admin, 'payments.approve'),
      canConfigure: canPerformAction(admin, 'payments.configure'),
    });
  } catch (err) {
    log.error('Admin Payments GET', err.message);
    return Response.json({ error: 'Failed to load payments' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { admin, error } = await requireAdmin('payments', true);
    if (error) return error;
    if (!canPerformAction(admin, 'payments.configure')) {
      return Response.json({ error: 'Only owner/superadmin can configure payments' }, { status: 403 });
    }

    const { action, gatewayId, enabled, priority, fields, name, desc } = await req.json();

    if (!gatewayId) return Response.json({ error: 'Gateway ID required' }, { status: 400 });

    // Load current config
    const existing = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
    const current = existing ? JSON.parse(existing.value) : {};

    if (action === 'toggle') {
      const newEnabled = typeof enabled === 'boolean' ? enabled : !current.enabled;
      const updated = { ...current, enabled: newEnabled };
      await prisma.setting.upsert({
        where: { key: `gateway_${gatewayId}` },
        update: { value: JSON.stringify(updated) },
        create: { key: `gateway_${gatewayId}`, value: JSON.stringify(updated) },
      });
      await logActivity(admin.name, `${newEnabled ? 'Enabled' : 'Disabled'} ${gatewayId} gateway`, 'payment');
      return Response.json({ success: true, enabled: newEnabled });
    }

    if (action === 'configure') {
      if (!fields || typeof fields !== 'object') return Response.json({ error: 'Fields required' }, { status: 400 });
      // Merge new fields with existing (only update non-empty)
      const currentFields = current.fields || {};
      const mergedFields = { ...currentFields };
      for (const [k, v] of Object.entries(fields)) {
        if (v && v.trim()) mergedFields[k] = v.trim();
      }
      const updated = { ...current, fields: mergedFields };
      await prisma.setting.upsert({
        where: { key: `gateway_${gatewayId}` },
        update: { value: JSON.stringify(updated) },
        create: { key: `gateway_${gatewayId}`, value: JSON.stringify(updated) },
      });
      await logActivity(admin.name, `Configured ${gatewayId} gateway keys`, 'payment');
      return Response.json({ success: true });
    }

    if (action === 'add') {
      const newData = { enabled: false, priority: 99, name: name || gatewayId, desc: desc || '', fields: { secretKey: '', publicKey: '' } };
      await prisma.setting.upsert({
        where: { key: `gateway_${gatewayId}` },
        update: { value: JSON.stringify({ ...current, ...newData, fields: { ...newData.fields, ...(current.fields || {}) } }) },
        create: { key: `gateway_${gatewayId}`, value: JSON.stringify(newData) },
      });
      await logActivity(admin.name, `Added ${name || gatewayId} gateway`, 'payment');
      return Response.json({ success: true });
    }

    if (action === 'priority') {
      if (typeof priority !== 'number') return Response.json({ error: 'Priority required' }, { status: 400 });
      const updated = { ...current, priority };
      await prisma.setting.upsert({
        where: { key: `gateway_${gatewayId}` },
        update: { value: JSON.stringify(updated) },
        create: { key: `gateway_${gatewayId}`, value: JSON.stringify(updated) },
      });
      return Response.json({ success: true });
    }

    if (action === 'approve_manual') {
      if (!canPerformAction(admin, 'payments.approve')) return Response.json({ error: 'Not authorized to approve deposits' }, { status: 403 });
      const txId = gatewayId; // gatewayId carries the transaction ID for approve/reject actions
      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      if (!tx || tx.method !== 'manual' || tx.status !== 'Pending') return Response.json({ error: 'Transaction not found or already processed' }, { status: 404 });

      // Atomic claim + credit — conditional update inside transaction prevents double-credit
      const approved = await prisma.$transaction(async (db) => {
        const claimed = await db.transaction.updateMany({
          where: { id: txId, status: 'Pending' },
          data: { status: 'Completed', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, `[approved_by:${admin.name}]`) },
        });
        if (claimed.count === 0) return false;
        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } } });
        return true;
      });
      if (!approved) return Response.json({ error: 'Transaction already processed' }, { status: 409 });

      // Check for coupon bonus
      if (tx.note?.includes('[coupon:')) {
        try {
          const couponMatch = tx.note.match(/\[coupon:([^\]]+)\]/);
          if (couponMatch) {
            const cSetting = await prisma.setting.findUnique({ where: { key: 'coupons' } });
            if (cSetting) {
              const coupons = JSON.parse(cSetting.value);
              const coupon = coupons.find(c => c.id === couponMatch[1]);
              if (coupon) {
                const bonus = coupon.type === 'percent' ? Math.round(tx.amount * coupon.value / 100) : coupon.value * 100;
                if (bonus > 0) {
                  await prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: bonus } } });
                  await prisma.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, method: 'coupon', status: 'Completed', reference: `COUPON-${tx.reference}`, note: `Coupon bonus on manual deposit` } });
                }
              }
            }
          }
        } catch {}
      }

      // Deferred referral bonus — same logic as payments/verify
      try {
        const user = await prisma.user.findUnique({ where: { id: tx.userId }, select: { referredBy: true, name: true, signupIp: true } });
        if (user?.referredBy) {
          const markerNote = `[ref-marker:${tx.userId}]`;
          const alreadyPaid = await prisma.transaction.findFirst({ where: { userId: tx.userId, type: 'referral', note: { contains: markerNote } } });
          if (!alreadyPaid) {
            const refSettings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'] } } });
            const rs = {};
            refSettings.forEach(s => { rs[s.key] = s.value; });
            const refEnabled = rs.ref_enabled === 'true' || rs.ref_enabled === undefined;
            const refMinDeposit = Number(rs.ref_min_deposit) || 0;
            if (refEnabled && refMinDeposit > 0 && tx.amount >= refMinDeposit) {
              const referrer = await prisma.user.findUnique({ where: { referralCode: user.referredBy } });
              const sameIp = referrer?.signupIp && user.signupIp
                && referrer.signupIp !== 'unknown' && referrer.signupIp === user.signupIp;
              if (sameIp) log.warn('Referral', `Self-referral suspected: ${tx.userId} → ${referrer.id} (same IP ${user.signupIp})`);
              if (referrer && !sameIp) {
                const referrerBonus = Number(rs.ref_referrer_bonus) || 50000;
                const inviteeBonus = Number(rs.ref_invitee_bonus) || 50000;
                try {
                  await prisma.$transaction(async (db) => {
                    const exists = await db.transaction.findFirst({ where: { userId: tx.userId, type: 'referral', note: { contains: markerNote } } });
                    if (exists) return;
                    await db.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
                    await db.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} deposited` } });
                    if (inviteeBonus > 0) {
                      await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: inviteeBonus } } });
                    }
                    await db.transaction.create({ data: { userId: tx.userId, type: 'referral', amount: inviteeBonus, note: `Referral welcome bonus ${markerNote}` } });
                  });
                  log.info('Referral', `Deferred bonus paid on manual deposit approval for ${tx.userId}`);
                } catch (txErr) { log.warn('Referral race', txErr.message); }
              }
            }
          }
        }
      } catch (err) { log.error('Deferred referral (manual)', err.message); }

      await logActivity(admin.name, `Approved manual deposit ₦${(tx.amount / 100).toLocaleString()} for user ${tx.userId}`, 'payment');
      return Response.json({ success: true });
    }

    if (action === 'reject_manual') {
      if (!canPerformAction(admin, 'payments.reject')) return Response.json({ error: 'Not authorized to reject deposits' }, { status: 403 });
      const txId = gatewayId;
      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      if (!tx || tx.method !== 'manual' || tx.status !== 'Pending') return Response.json({ error: 'Transaction not found or already processed' }, { status: 404 });
      await prisma.transaction.update({ where: { id: txId }, data: { status: 'Failed', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, `[rejected_by:${admin.name}]`) } });
      await logActivity(admin.name, `Rejected manual deposit ₦${(tx.amount / 100).toLocaleString()} for user ${tx.userId}`, 'payment');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Payments POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
