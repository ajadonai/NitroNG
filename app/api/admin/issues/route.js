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
  if (type === 'low_balance') {
    const providerMap = { MoreThanPanel: 'mtp', JustAnotherPanel: 'jap', DaoSMM: 'dao' };
    const pid = providerMap[meta.provider] || meta.provider;
    if (!pid || !isProviderConfigured(pid)) return { resolved: true, detail: 'Provider not configured — resolving' };
    try {
      const data = await getBalance(pid);
      const balance = parseFloat(data.balance) || 0;
      const threshold = meta.threshold || LOW_BALANCE_USD;
      if (balance < threshold) {
        return { resolved: false, reason: `${meta.provider} balance is still $${balance.toFixed(2)} (below $${threshold})` };
      }
      return { resolved: true, detail: `Balance now $${balance.toFixed(2)}` };
    } catch (err) {
      return { resolved: false, reason: `Could not check balance: ${err.message}` };
    }
  }

  if (type === 'dead_service') {
    const pid = meta.provider;
    const apiId = meta.apiId;
    if (!pid || !apiId || !isProviderConfigured(pid)) return { resolved: true, detail: 'Provider not configured — resolving' };
    try {
      const svcs = await getServices(pid);
      if (!Array.isArray(svcs)) return { resolved: false, reason: `Could not fetch ${pid.toUpperCase()} service list` };
      const found = svcs.some(s => String(s.service) === String(apiId));
      if (!found) {
        return { resolved: false, reason: `Service #${apiId} still missing from ${pid.toUpperCase()} catalogue` };
      }
      return { resolved: true, detail: `Service #${apiId} found in catalogue` };
    } catch (err) {
      return { resolved: false, reason: `Could not check services: ${err.message}` };
    }
  }

  if (type === 'price_alert') {
    try {
      const row = await prisma.setting.findUnique({ where: { key: 'price_alerts' } });
      const alerts = row ? JSON.parse(row.value) : null;
      const losers = alerts?.losers || [];
      if (losers.length > 0) {
        return { resolved: false, reason: `${losers.length} service${losers.length > 1 ? 's' : ''} still selling below cost — run the prices cron after adjusting markups` };
      }
      return { resolved: true, detail: 'All services priced above cost' };
    } catch (err) {
      return { resolved: false, reason: `Could not check prices: ${err.message}` };
    }
  }

  // order_failure and unknown types — resolve immediately
  return { resolved: true };
}
