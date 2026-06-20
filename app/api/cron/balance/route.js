export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBalance } from '@/lib/smm';
import { sendEmail, emailWrap, emailRow, emailDataBox } from '@/lib/email';

// Checks provider API balances and sends admin alert if below threshold
// Runs every 6 hours via Vercel Cron
// GET /api/cron/balance

const LOW_BALANCE_USD = 10; // Alert when provider balance drops below $10

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {};

  const providers = [
    { id: 'mtp', name: 'MoreThanPanel', hasKey: !!process.env.MTP_API_KEY },
    { id: 'jap', name: 'JustAnotherPanel', hasKey: !!process.env.JAP_API_KEY },
    { id: 'dao', name: 'DaoSMM', hasKey: !!process.env.DAOSMM_API_KEY },
  ];

  const alerts = [];

  for (const provider of providers) {
    if (!provider.hasKey) {
      results[provider.id] = { status: 'skipped', reason: 'No API key' };
      continue;
    }

    try {
      const data = await getBalance(provider.id);
      const balance = parseFloat(data.balance) || 0;
      results[provider.id] = { balance, currency: data.currency || 'USD' };

      if (balance < LOW_BALANCE_USD) {
        alerts.push({ provider: provider.name, balance, threshold: LOW_BALANCE_USD });
      }
    } catch (err) {
      results[provider.id] = { status: 'error', message: err.message };
      log.warn(`Balance check ${provider.name}`, err.message);
    }
  }

  // Save balance snapshot to settings for admin dashboard
  try {
    await prisma.setting.upsert({
      where: { key: 'provider_balances' },
      update: { value: JSON.stringify({ ...results, checkedAt: new Date().toISOString() }) },
      create: { key: 'provider_balances', value: JSON.stringify({ ...results, checkedAt: new Date().toISOString() }) },
    });
  } catch {}

  // If any provider is low, create admin notification
  if (alerts.length > 0) {
    try {
      const alertText = alerts.map(a => `${a.provider}: $${a.balance.toFixed(2)} (below $${a.threshold})`).join(', ');

      // Check if we already sent this alert today (avoid spam)
      const today = new Date().toISOString().slice(0, 10);
      const existing = await prisma.setting.findUnique({ where: { key: 'last_balance_alert' } });
      const lastAlert = existing?.value || '';

      if (!lastAlert.startsWith(today)) {
        // Save alert date
        await prisma.setting.upsert({
          where: { key: 'last_balance_alert' },
          update: { value: `${today}: ${alertText}` },
          create: { key: 'last_balance_alert', value: `${today}: ${alertText}` },
        });

        // Send email alert to admin
        try {
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@nitro.ng';
          const html = await emailWrap({
            label: 'System Alert',
            labelBg: 'rgba(245,158,11,.12)',
            labelColor: '#f59e0b',
            title: 'Low Provider Balance',
            body: `
              <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">The following providers have low balances:</p>
              ${emailDataBox(alerts.map(a => emailRow(a.provider, `$${a.balance.toFixed(2)} (min $${a.threshold})`, '#ef4444')).join(''), '#f59e0b')}
              <p class="em-m" style="font-size:13px;color:#9a948d;margin:0;">Please top up to avoid order failures.</p>`,
          });
          sendEmail(adminEmail, 'Low Provider Balance Alert', html).catch(err => log.warn('Balance alert email', err.message));
        } catch (emailErr) {
          log.warn('Balance alert email', emailErr.message);
        }

        log.warn('Low balance alert', alertText);
      }

      // Create/update single admin issue for low balances
      try {
        const existingIssue = await prisma.adminIssue.findFirst({
          where: { type: 'low_balance', status: 'open' },
        });
        const title = `${alerts.length} provider${alerts.length > 1 ? 's' : ''} below $${LOW_BALANCE_USD} — ${alerts.map(a => `${a.provider} $${a.balance.toFixed(2)}`).join(', ')}`;
        const message = alerts.map(a => `${a.provider}: $${a.balance.toFixed(2)} (threshold $${a.threshold})`).join('\n') + '\nTop up to avoid order failures.';
        const metadata = JSON.stringify({ providers: alerts, threshold: LOW_BALANCE_USD });
        if (existingIssue) {
          await prisma.adminIssue.update({
            where: { id: existingIssue.id },
            data: { title, message, metadata, createdAt: new Date() },
          });
        } else {
          await prisma.adminIssue.create({
            data: { type: 'low_balance', title, message, metadata },
          });
        }
      } catch (issueErr) {
        log.warn('Balance issue create', issueErr.message);
      }
    } catch (err) {
      log.warn('Balance alert save', err.message);
    }
  }

  log.info('Cron balance', JSON.stringify(results));
  return Response.json({ success: true, balances: results, alerts });
}
