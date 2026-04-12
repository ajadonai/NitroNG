import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { getServices, getBalance } from '@/lib/mtp';

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  return Response.json({
    status: {
      mtp: !!process.env.MTP_API_KEY,
      jap: !!process.env.JAP_API_KEY,
      dao: !!process.env.DAOSMM_API_KEY,
    },
  });
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('services', true);
  if (error) return error;

  try {
    const { action, provider } = await req.json();

    if (action === 'test') {
      const pid = provider || 'mtp';
      if (pid === 'mtp') {
        const balance = await getBalance();
        return Response.json({ success: true, balance });
      }
      if (pid === 'jap') {
        const key = process.env.JAP_API_KEY;
        if (!key) return Response.json({ error: 'JAP_API_KEY not set' }, { status: 400 });
        const res = await fetch('https://justanotherpanel.com/api/v2', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `key=${key}&action=balance` });
        const data = await res.json();
        if (data.error) return Response.json({ error: data.error }, { status: 400 });
        return Response.json({ success: true, balance: { balance: data.balance || 0, currency: data.currency || 'USD' } });
      }
      if (pid === 'dao') {
        const key = process.env.DAOSMM_API_KEY;
        if (!key) return Response.json({ error: 'DAOSMM_API_KEY not set' }, { status: 400 });
        const res = await fetch('https://daosmm.com/api/v2', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `key=${key}&action=balance` });
        const data = await res.json();
        if (data.error) return Response.json({ error: data.error }, { status: 400 });
        return Response.json({ success: true, balance: { balance: data.balance || 0, currency: data.currency || 'USD' } });
      }
      return Response.json({ error: 'Unknown provider' }, { status: 400 });
    }

    if (action === 'sync') {
      // Fetch all services from MTP
      const mtpServices = await getServices();

      if (!Array.isArray(mtpServices)) {
        return Response.json({ error: 'Invalid response from MTP' }, { status: 400 });
      }

      // Get current settings for default markup
      const markupSetting = await prisma.setting.findUnique({ where: { key: 'defaultMarkup' } });
      const defaultMarkup = Number(markupSetting?.value) || 54;

      // Get all existing services in one query
      const existing = await prisma.service.findMany({ select: { id: true, apiId: true, markup: true } });
      const existingMap = {};
      existing.forEach(s => { existingMap[s.apiId] = s; });

      let created = 0, updated = 0, skipped = 0;
      const toCreate = [];
      const toUpdate = [];

      for (const svc of mtpServices) {
        const apiId = Number(svc.service);
        if (!apiId) { skipped++; continue; }

        const rawCost = Math.round(parseFloat(svc.rate) * 100);
        // Skip services with absurd costs (overflow INT4 limit of ~2.1 billion)
        if (rawCost > 2000000000 || rawCost < 0 || isNaN(rawCost)) { skipped++; continue; }
        const costPer1k = rawCost;
        const category = categorize(svc.category);
        const data = {
          name: svc.name,
          category,
          costPer1k,
          min: Number(svc.min) || 10,
          max: Number(svc.max) || 100000,
          refill: svc.refill === true || svc.refill === 'true',
          avgTime: svc.average_time || '0-2 hrs',
        };

        const ex = existingMap[apiId];
        if (ex) {
          // Only update cost and metadata — never overwrite sell prices
          // Use admin Pricing → Recalculate All to update sell prices via bracket engine
          toUpdate.push(prisma.service.update({
            where: { id: ex.id },
            data,
          }));
          updated++;
        } else {
          // New service — calculate initial sell price via bracket engine
          const { calculateTierPrice } = await import('@/lib/markup');
          const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
          const ms = {};
          markupRows.forEach(s => { ms[s.key] = s.value; });
          const initialSell = calculateTierPrice(costPer1k, 'Standard', ms, false) || Math.round(costPer1k * 2);
          toCreate.push({
            apiId, ...data, sellPer1k: initialSell, markup: defaultMarkup, enabled: false,
          });
          created++;
        }
      }

      // Batch create + update
      const ops = [...toUpdate];
      if (toCreate.length > 0) {
        ops.push(prisma.service.createMany({ data: toCreate, skipDuplicates: true }));
      }

      if (ops.length > 0) {
        // Process in chunks of 50 to avoid transaction limits
        for (let i = 0; i < ops.length; i += 50) {
          await prisma.$transaction(ops.slice(i, i + 50));
        }
      }

      await logActivity(admin.name, `Synced services from MTP: ${created} new, ${updated} updated, ${skipped} skipped`, 'service');

      return Response.json({
        success: true,
        total: mtpServices.length,
        created,
        updated,
        skipped,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Sync', err.message);
    return Response.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

/**
 * Categorize MTP service into platform categories
 */
function categorize(mtpCategory) {
  if (!mtpCategory) return 'Other';
  const c = mtpCategory.toLowerCase();
  if (c.includes('instagram')) return 'Instagram';
  if (c.includes('tiktok') || c.includes('tik tok')) return 'TikTok';
  if (c.includes('youtube')) return 'YouTube';
  if (c.includes('twitter') || c.includes('/x')) return 'Twitter/X';
  if (c.includes('facebook') || c.includes('fb')) return 'Facebook';
  if (c.includes('telegram')) return 'Telegram';
  if (c.includes('spotify')) return 'Spotify';
  if (c.includes('snapchat')) return 'Snapchat';
  if (c.includes('linkedin')) return 'LinkedIn';
  if (c.includes('pinterest')) return 'Pinterest';
  if (c.includes('twitch')) return 'Twitch';
  if (c.includes('discord')) return 'Discord';
  if (c.includes('thread')) return 'Threads';
  return mtpCategory.split(' ')[0] || 'Other';
}
