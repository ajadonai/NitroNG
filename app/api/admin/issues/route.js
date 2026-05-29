export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';
import { log } from '@/lib/logger';
import { getBalance, getServices, isProviderConfigured } from '@/lib/smm';

export async function GET(req) {
  const { admin, error } = await requireAdmin('issues');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'all';

    const [issues, openCount, balancesRow, priceAlertsRow] = await Promise.all([
      prisma.adminIssue.findMany({
        where: status === 'all' ? {} : { status },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.adminIssue.count({ where: { status: 'open' } }),
      prisma.setting.findUnique({ where: { key: 'provider_balances' } }),
      prisma.setting.findUnique({ where: { key: 'price_alerts' } }),
    ]);

    let balances = null;
    try { balances = balancesRow ? JSON.parse(balancesRow.value) : null; } catch {}
    let priceAlerts = null;
    try { priceAlerts = priceAlertsRow ? JSON.parse(priceAlertsRow.value) : null; } catch {}

    return Response.json({ issues, openCount, balances, priceAlerts });
  } catch (err) {
    log.error('AdminIssues GET', err.message);
    return Response.json({ error: 'Failed to load issues' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('issues', true);
  if (error) return error;

  try {
    const { action, issueId } = await req.json();

    if (action === 'resolve') {
      if (!issueId) return Response.json({ error: 'Issue ID required' }, { status: 400 });

      const issue = await prisma.adminIssue.findUnique({ where: { id: issueId } });
      if (!issue) return Response.json({ error: 'Issue not found' }, { status: 404 });
      if (issue.status === 'resolved') return Response.json({ success: true, alreadyResolved: true });

      let meta = {};
      try { meta = issue.metadata ? JSON.parse(issue.metadata) : {}; } catch {}

      const check = await verifyResolution(issue.type, meta);
      if (!check.resolved) {
        return Response.json({ error: check.reason }, { status: 409 });
      }

      await prisma.adminIssue.update({
        where: { id: issueId },
        data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: admin.name },
      });
      await logActivity(admin.name, `Resolved issue: ${issue.title}`, 'system');
      return Response.json({ success: true, detail: check.detail });
    }

    if (action === 'fire_crons') {
      const secret = process.env.CRON_SECRET;
      if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503 });

      const crons = [
        '/api/cron/orders',
        '/api/cron/payments',
        '/api/cron/promotions',
        '/api/cron/balance',
        '/api/cron/cleanup',
        '/api/cron/fx',
        '/api/cron/prices',
      ];

      const origin = new URL(req.url).origin;

      const results = await Promise.allSettled(
        crons.map(async (path) => {
          const res = await fetch(`${origin}${path}`, {
            headers: { Authorization: `Bearer ${secret}` },
          });
          const data = await res.json().catch(() => ({}));
          return { path, httpStatus: res.status, data };
        })
      );

      const summary = results.map((r, i) => ({
        cron: crons[i],
        ok: r.status === 'fulfilled' && r.value?.httpStatus === 200,
        ...(r.status === 'fulfilled' ? (r.value.httpStatus === 200 ? {} : { error: r.value.data?.error || `HTTP ${r.value.httpStatus}` }) : { error: r.reason?.message }),
      }));

      await logActivity(admin.name, `Fired all crons manually`, 'system');
      return Response.json({ success: true, results: summary });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('AdminIssues POST', err.message);
    return Response.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}

const LOW_BALANCE_USD = 10;

async function verifyResolution(type, meta) {
  const providerMap = { MoreThanPanel: 'mtp', JustAnotherPanel: 'jap', DaoSMM: 'dao' };

  if (type === 'low_balance') {
    const providers = meta.providers || [meta];
    const stillLow = [];
    for (const p of providers) {
      const pid = providerMap[p.provider] || p.provider;
      if (!pid || !isProviderConfigured(pid)) continue;
      try {
        const data = await getBalance(pid);
        const balance = parseFloat(data.balance) || 0;
        const threshold = p.threshold || meta.threshold || LOW_BALANCE_USD;
        if (balance < threshold) stillLow.push(`${p.provider} is $${balance.toFixed(2)}`);
      } catch {}
    }
    if (stillLow.length > 0) {
      return { resolved: false, reason: `Still low: ${stillLow.join(', ')}` };
    }
    return { resolved: true, detail: 'All balances healthy' };
  }

  if (type === 'dead_service') {
    const services = meta.services || [meta];
    const catalogueCache = {};
    const stillDead = [];
    for (const s of services) {
      const pid = s.provider;
      if (!pid || !isProviderConfigured(pid)) continue;
      if (!catalogueCache[pid]) {
        try { catalogueCache[pid] = await getServices(pid); } catch { continue; }
      }
      const cat = catalogueCache[pid];
      if (!Array.isArray(cat)) continue;
      const found = cat.some(c => String(c.service) === String(s.apiId));
      if (!found) stillDead.push(`#${s.apiId} on ${pid.toUpperCase()}`);
    }
    if (stillDead.length > 0) {
      return { resolved: false, reason: `${stillDead.length} still missing: ${stillDead.slice(0, 5).join(', ')}` };
    }
    return { resolved: true, detail: 'All services back in catalogue' };
  }

  if (type === 'price_alert') {
    try {
      const row = await prisma.setting.findUnique({ where: { key: 'price_alerts' } });
      const alerts = row ? JSON.parse(row.value) : null;
      const losers = alerts?.losers || [];
      if (losers.length > 0) {
        return { resolved: false, reason: `${losers.length} service${losers.length > 1 ? 's' : ''} still below cost. Adjust markups and re-run prices cron` };
      }
      return { resolved: true, detail: 'All services priced above cost' };
    } catch (err) {
      return { resolved: false, reason: `Could not check prices: ${err.message}` };
    }
  }

  return { resolved: true };
}
