export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';
import { log } from '@/lib/logger';
import { getBalance, getServices, isProviderConfigured } from '@/lib/smm';

const CRYPTO_PAYMENT_REVIEW_TYPE = 'crypto_payment_review';

class CryptoReviewRaceError extends Error {}

function parseCryptoReviewMetadata(issue) {
  try {
    const metadata = JSON.parse(issue.metadata);
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null;

    const required = [
      'transactionId',
      'reference',
      'userId',
      'reason',
      'reviewFingerprint',
    ];
    if (required.some(key => typeof metadata[key] !== 'string' || !metadata[key].trim())) {
      return null;
    }

    return Object.fromEntries(required.map(key => [key, metadata[key].trim()]));
  } catch {
    return null;
  }
}

function cryptoReviewConflict(reason) {
  return { error: reason, status: 409 };
}

async function closeCryptoPaymentReview({ issueId, action, adminName }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async db => {
        const issue = await db.adminIssue.findUnique({ where: { id: issueId } });
        if (!issue) return { error: 'Issue not found', status: 404 };
        if (issue.type !== CRYPTO_PAYMENT_REVIEW_TYPE) {
          return cryptoReviewConflict('Issue is not a crypto payment review');
        }

        if (issue.status !== 'open') return { success: true, alreadyResolved: true };

        const metadata = parseCryptoReviewMetadata(issue);
        if (!metadata) {
          return cryptoReviewConflict('Crypto payment review metadata is missing or invalid');
        }

        const deposit = await db.transaction.findUnique({
          where: { id: metadata.transactionId },
        });
        if (
          deposit?.type === 'deposit'
          && deposit.method === 'crypto'
          && deposit.reference === metadata.reference
          && deposit.userId === metadata.userId
          && deposit.paymentReviewResolvedAt === null
          && deposit.paymentReviewFingerprint !== metadata.reviewFingerprint
        ) {
          return cryptoReviewConflict(
            'A newer payment observation is available. Reload and review the latest evidence.',
          );
        }
        const validDeposit = deposit
          && deposit.type === 'deposit'
          && deposit.method === 'crypto'
          && deposit.reference === metadata.reference
          && deposit.userId === metadata.userId
          && ['Review', 'Completed', 'Rejected'].includes(deposit.status)
          && deposit.paymentReviewFingerprint === metadata.reviewFingerprint
          && typeof deposit.paymentReviewReason === 'string'
          && deposit.paymentReviewReason.length > 0
          && deposit.paymentReviewAt instanceof Date
          && deposit.paymentReviewResolvedAt === null;
        if (!validDeposit) {
          return cryptoReviewConflict('Linked crypto deposit review is missing or does not match this issue');
        }

        const resolvedAt = new Date();
        const transactionResult = await db.transaction.updateMany({
          where: {
            id: deposit.id,
            type: 'deposit',
            method: 'crypto',
            reference: metadata.reference,
            userId: metadata.userId,
            status: deposit.status,
            paymentReviewFingerprint: metadata.reviewFingerprint,
            paymentReviewReason: deposit.paymentReviewReason,
            paymentReviewAt: deposit.paymentReviewAt,
            paymentReviewResolvedAt: null,
          },
          data: {
            paymentReviewResolvedAt: resolvedAt,
            ...(deposit.status === 'Review' ? { status: 'Rejected' } : {}),
          },
        });
        if (transactionResult.count !== 1) {
          return cryptoReviewConflict('Crypto deposit review changed before it could be closed');
        }

        const targetStatus = action === 'resolve' ? 'resolved' : 'ignored';
        const transactionNeedle = `\"transactionId\":\"${deposit.id}\"`;
        const issueResult = await db.adminIssue.updateMany({
          where: {
            type: CRYPTO_PAYMENT_REVIEW_TYPE,
            status: 'open',
            metadata: { contains: transactionNeedle },
          },
          data: {
            status: targetStatus,
            resolvedAt,
            resolvedBy: adminName,
          },
        });
        if (issueResult.count < 1) {
          throw new CryptoReviewRaceError('Crypto payment review changed while it was being closed');
        }

        return {
          success: true,
          detail: action === 'resolve' ? 'Payment review resolved' : 'Payment review ignored',
          title: issue.title,
        };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      const retryable = error instanceof CryptoReviewRaceError || error?.code === 'P2034';
      if (retryable && attempt === 0) continue;
      throw error;
    }
  }

  throw new CryptoReviewRaceError('Crypto payment review could not be closed');
}

export async function GET(req) {
  const { admin, error } = await requireAdmin('issues');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'all';
    const includeOpenCryptoReviews = status === 'all' || status === 'open';

    const [issues, openCryptoReviews, openCount, balancesRow, priceAlertsRow] = await Promise.all([
      prisma.adminIssue.findMany({
        where: status === 'all' ? {} : { status },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      includeOpenCryptoReviews
        ? prisma.adminIssue.findMany({
          where: {
            type: CRYPTO_PAYMENT_REVIEW_TYPE,
            status: 'open',
          },
          orderBy: { createdAt: 'desc' },
        })
        : Promise.resolve([]),
      prisma.adminIssue.count({ where: { status: 'open' } }),
      prisma.setting.findUnique({ where: { key: 'provider_balances' } }),
      prisma.setting.findUnique({ where: { key: 'price_alerts' } }),
    ]);

    // Financial review items must remain visible even when newer operational
    // issues fill the general 100-row window. Merge by ID so reviews already
    // present in that window are not duplicated.
    const priorityIds = new Set(openCryptoReviews.map(issue => issue.id));
    const visibleIssues = [
      ...openCryptoReviews,
      ...issues.filter(issue => !priorityIds.has(issue.id)),
    ];

    let balances = null;
    try { balances = balancesRow ? JSON.parse(balancesRow.value) : null; } catch {}
    let priceAlerts = null;
    try { priceAlerts = priceAlertsRow ? JSON.parse(priceAlertsRow.value) : null; } catch {}

    return Response.json({
      issues: visibleIssues,
      openCount,
      balances,
      priceAlerts,
      canResolveCryptoReviews: canPerformAction(admin, 'payments.approve'),
    });
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

      if (issue.type === CRYPTO_PAYMENT_REVIEW_TYPE) {
        if (!canPerformAction(admin, 'payments.approve')) {
          return Response.json({ error: 'Not authorized to resolve crypto payment reviews' }, { status: 403 });
        }
        if (issue.status !== 'open') return Response.json({ success: true, alreadyResolved: true });
        const result = await closeCryptoPaymentReview({ issueId, action, adminName: admin.name });
        if (result.error) return Response.json({ error: result.error }, { status: result.status });
        if (result.alreadyResolved) return Response.json({ success: true, alreadyResolved: true });
        await logActivity(admin.name, `Resolved issue: ${result.title}`, 'system');
        return Response.json({ success: true, detail: result.detail });
      }

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

    if (action === 'ignore') {
      if (!issueId) return Response.json({ error: 'Issue ID required' }, { status: 400 });
      const issue = await prisma.adminIssue.findUnique({ where: { id: issueId } });
      if (!issue) return Response.json({ error: 'Issue not found' }, { status: 404 });

      if (issue.type === CRYPTO_PAYMENT_REVIEW_TYPE) {
        if (!canPerformAction(admin, 'payments.approve')) {
          return Response.json({ error: 'Not authorized to resolve crypto payment reviews' }, { status: 403 });
        }
        if (issue.status !== 'open') return Response.json({ success: true, alreadyResolved: true });
        const result = await closeCryptoPaymentReview({ issueId, action, adminName: admin.name });
        if (result.error) return Response.json({ error: result.error }, { status: result.status });
        if (result.alreadyResolved) return Response.json({ success: true, alreadyResolved: true });
        await logActivity(admin.name, `Ignored issue: ${result.title}`, 'system');
        return Response.json({ success: true, detail: result.detail });
      }

      if (issue.status !== 'open') return Response.json({ success: true, alreadyResolved: true });
      await prisma.adminIssue.update({ where: { id: issueId }, data: { status: 'ignored', resolvedAt: new Date(), resolvedBy: admin.name } });
      await logActivity(admin.name, `Ignored issue: ${issue.title}`, 'system');
      return Response.json({ success: true, detail: 'Issue ignored' });
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
      const dbService = await prisma.service.findFirst({ where: { apiId: Number(s.apiId), provider: pid } });
      if (dbService && !dbService.enabled) continue;
      if (!catalogueCache[pid]) {
        try { catalogueCache[pid] = await getServices(pid); } catch { continue; }
      }
      const cat = catalogueCache[pid];
      if (!Array.isArray(cat)) continue;
      const found = cat.some(c => String(c.service) === String(s.apiId));
      if (!found) stillDead.push(`#${s.apiId} on ${pid.toUpperCase()}`);
    }
    if (stillDead.length > 0) {
      return { resolved: false, reason: `${stillDead.length} still missing: ${stillDead.slice(0, 5).join(', ')}. Disable them to resolve.` };
    }
    return { resolved: true, detail: 'All services resolved (back in catalogue or disabled)' };
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

  if (type === 'revived_service') {
    return { resolved: true, detail: 'Acknowledged — re-enable services from the catalogue if needed' };
  }

  return { resolved: true };
}
