import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction, canSeeSensitive, maskEmail } from '@/lib/admin';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';

const DEFAULT_GATEWAYS = [
  { id: 'flutterwave', name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money', enabled: false, priority: 1, fields: { secretKey: '', publicKey: '' } },
  { id: 'alatpay', name: 'ALATPay (Wema)', desc: 'Direct bank debit', enabled: false, priority: 2, fields: { secretKey: '', publicKey: '' } },
  { id: 'monnify', name: 'Monnify', desc: 'Auto-confirmed bank transfer', enabled: false, priority: 3, fields: { apiKey: '', secretKey: '', contractCode: '' } },
  { id: 'korapay', name: 'KoraPay', desc: 'Cards, Bank Transfer', enabled: false, priority: 4, fields: { secretKey: '', publicKey: '' } },
  { id: 'crypto', name: 'Crypto', desc: 'USDT (TRC-20 / ERC-20)', enabled: false, priority: 5, fields: { apiKey: '' } },
  { id: 'manual', name: 'Bank Transfer (Manual)', desc: 'User transfers to your bank, you confirm', enabled: false, priority: 6, fields: { bankName: 'Moniepoint MFB', accountNumber: '4005560551', accountName: 'The Nitro Nigeria Limited' } },
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

    // Mark stale pending gateway payments as Expired (>1 hour old, non-manual)
    // Don't delete — user may have paid but webhook/redirect failed
    try {
      await prisma.transaction.updateMany({
        where: { status: 'Pending', type: 'deposit', method: { notIn: ['manual', 'crypto'] }, createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
        data: { status: 'Expired' },
      });
    } catch {}

    // Build deposit query — exclude unconfirmed manual deposits (user hasn't sent money yet)
    const where = { method: { in: ['manual', 'crypto'] }, type: 'deposit', NOT: { note: { contains: '[awaiting_confirmation]' } } };
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

    const sensitive = canSeeSensitive(admin);
    const formatTx = (tx) => {
      const refMatch = tx.note?.match(/\[user_confirmed:?([^\]]*)\]/);
      const approvedMatch = tx.note?.match(/\[approved_by:([^\]]*)\]/);
      const rejectedMatch = tx.note?.match(/\[rejected_by:([^\]]*)\]/);
      return {
        id: tx.id, amount: tx.amount / 100, reference: tx.reference, method: tx.method,
        status: tx.status, note: tx.note, date: tx.createdAt.toISOString(),
        user: tx.user ? `${tx.user.firstName || tx.user.name || ''} ${tx.user.lastName || ''}`.trim() : 'Unknown',
        email: sensitive ? (tx.user?.email || '') : maskEmail(tx.user?.email),
        confirmed: tx.note?.includes('[user_confirmed'),
        senderRef: refMatch?.[1] || null,
        actionBy: approvedMatch?.[1] || rejectedMatch?.[1] || null,
      };
    };

    return Response.json({
      gateways: masked,
      deposits: deposits.map(formatTx),
      pendingCount: deposits.filter(d => d.status === 'Pending' && !d.note?.includes('[awaiting_confirmation]')).length,
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

    const { action, gatewayId, enabled, priority, fields, name, desc, moves } = await req.json();

    if (action === 'reorder') {
      if (!Array.isArray(moves)) return Response.json({ error: 'Moves required' }, { status: 400 });
      for (const { id, priority: p } of moves) {
        const key = `gateway_${id}`;
        const row = await prisma.setting.findUnique({ where: { key } });
        const data = row ? JSON.parse(row.value) : {};
        data.priority = p;
        await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(data) }, create: { key, value: JSON.stringify(data) } });
      }
      return Response.json({ success: true });
    }

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
      if (!tx || tx.type !== 'deposit' || tx.method !== 'manual' || tx.status !== 'Pending') return Response.json({ error: 'Transaction not found or already processed' }, { status: 404 });

      const finalized = await finalizeDeposit({
        transactionId: txId,
        paidAmountKobo: tx.amount,
        claimableStatuses: ['Pending'],
        approvedBy: admin.name,
      });
      if (!finalized.finalized) return Response.json({ error: 'Transaction already processed' }, { status: 409 });

      try {
        await notifyDepositFinalized(finalized, { channel: 'Manual', approvedBy: admin.name });
      } catch (notifyErr) {
        log.warn('Admin Payments', `Deposit notification failed for ${tx.reference}: ${notifyErr.message}`);
      }

      const approvedUser = finalized.user;
      await logActivity(admin.name, `Approved manual deposit ₦${(tx.amount / 100).toLocaleString()} for ${approvedUser?.name || approvedUser?.email || tx.userId}`, 'payment');
      return Response.json({ success: true });
    }

    if (action === 'reject_manual') {
      if (!canPerformAction(admin, 'payments.reject')) return Response.json({ error: 'Not authorized to reject deposits' }, { status: 403 });
      const txId = gatewayId;
      const tx = await prisma.transaction.findUnique({ where: { id: txId } });
      if (!tx || tx.type !== 'deposit' || tx.method !== 'manual' || tx.status !== 'Pending') return Response.json({ error: 'Transaction not found or already processed' }, { status: 404 });
      await prisma.transaction.update({ where: { id: txId }, data: { status: 'Rejected', note: tx.note.replace(/\[user_confirmed[^\]]*\]|\[awaiting_confirmation\]/, `[rejected_by:${admin.name}]`) } });
      const rejectedUser = await prisma.user.findUnique({ where: { id: tx.userId }, select: { name: true, email: true } });
      await logActivity(admin.name, `Rejected manual deposit ₦${(tx.amount / 100).toLocaleString()} for ${rejectedUser?.name || rejectedUser?.email || tx.userId}`, 'payment');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Payments POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
