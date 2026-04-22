import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBalance } from '@/lib/smm';

// Checks provider API balances and sends admin alert if below threshold
// Runs every 6 hours via Vercel Cron
// GET /api/cron/balance

const LOW_BALANCE_USD = 10; // Alert when provider balance drops below $10

export async function GET(req) {
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
          const brevoKey = process.env.BREVO_API_KEY;
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@nitro.ng';
          if (brevoKey) {
            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'Nitro System', email: 'noreply@nitro.ng' },
                to: [{ email: adminEmail }],
                subject: '⚠️ Low Provider Balance Alert',
                htmlContent: `<h2>Provider Balance Alert</h2><p>The following providers have low balances:</p><ul>${alerts.map(a => `<li><strong>${a.provider}</strong>: $${a.balance.toFixed(2)} (threshold: $${a.threshold})</li>`).join('')}</ul><p>Please top up to avoid order failures.</p><p>— Nitro System</p>`,
              }),
            });
          }
        } catch (emailErr) {
          log.warn('Balance alert email', emailErr.message);
        }

        log.warn('Low balance alert', alertText);
      }
    } catch (err) {
      log.warn('Balance alert save', err.message);
    }
  }

  log.info('Cron balance', JSON.stringify(results));
  return Response.json({ success: true, balances: results, alerts });
}
