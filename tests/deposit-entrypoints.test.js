import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const FINALIZE_IMPORT = /import\s*\{[^}]*\bfinalizeDeposit\b[^}]*\}\s*from\s*['"][^'"]+['"]/s;
const FINALIZE_CALL = /\bfinalizeDeposit\s*\(/;
const RECONCILE_IMPORT = /import\s*\{[^}]*\breconcileFlutterwaveDeposit\b[^}]*\}\s*from\s*['"][^'"]+['"]/s;
const RECONCILE_CALL = /\breconcileFlutterwaveDeposit\s*\(/;
const RECOVERY_IMPORT = /import\s*\{[^}]*\brecoverStalePendingPayments\b[^}]*\}\s*from\s*['"][^'"]+['"]/s;
const RECOVERY_CALL = /\brecoverStalePendingPayments\s*\(/;

const DIRECT_BALANCE_INCREMENT = /\bbalance\s*:\s*\{\s*increment\s*:/;
const DIRECT_WELCOME_BONUS = /\bapplyWelcomeBonus\s*\(/;
const DIRECT_EFFECT_ROW = /\btransaction\s*\.\s*create(?:Many)?\s*\(\s*\{[\s\S]{0,1200}?\btype\s*:\s*['"](?:bonus|referral)['"]/;

function expectSharedFinalizer(source, name) {
  const usesFinalizer = FINALIZE_IMPORT.test(source) && FINALIZE_CALL.test(source);
  const usesFlutterwaveReconciler = RECONCILE_IMPORT.test(source) && RECONCILE_CALL.test(source);
  expect(
    usesFinalizer || usesFlutterwaveReconciler,
    `${name} must delegate to finalizeDeposit or reconcileFlutterwaveDeposit`,
  ).toBe(true);
}

function expectNoDirectFinancialEffects(source, name) {
  expect(DIRECT_BALANCE_INCREMENT.test(source), `${name} must not increment a wallet balance directly`).toBe(false);
  expect(DIRECT_WELCOME_BONUS.test(source), `${name} must not apply a welcome bonus directly`).toBe(false);
  expect(DIRECT_EFFECT_ROW.test(source), `${name} must not create coupon or referral effect rows directly`).toBe(false);
}

const directEntryPoints = [
  ['Flutterwave webhook', 'app/api/payments/webhook/route.js'],
  ['Flutterwave verification', 'app/api/payments/verify/route.js'],
  ['crypto webhook', 'app/api/payments/crypto/webhook/route.js'],
  ['crypto status check', 'app/api/payments/crypto/route.js'],
  ['admin manual approval', 'app/api/admin/payments/route.js'],
  ['Telegram manual approval', 'app/api/telegram/webhook/route.js'],
];

describe('deposit entry points', () => {
  it.each(directEntryPoints)('%s delegates all financial effects to a shared payment service', (name, file) => {
    const source = route(file);

    expectSharedFinalizer(source, name);
    expectNoDirectFinancialEffects(source, name);
  });

  it('cron recovery delegates through the shared recovery helper and finalizer', () => {
    const cronSource = route('app/api/cron/payments/route.js');
    const recoverySource = route('lib/payment-recovery.js');

    const cronFinalizesDirectly = FINALIZE_IMPORT.test(cronSource) && FINALIZE_CALL.test(cronSource);
    const cronUsesRecoveryHelper = RECOVERY_IMPORT.test(cronSource) && RECOVERY_CALL.test(cronSource);

    expect(
      cronFinalizesDirectly || cronUsesRecoveryHelper,
      'payment recovery cron must call finalizeDeposit or recoverStalePendingPayments',
    ).toBe(true);
    if (cronUsesRecoveryHelper) expectSharedFinalizer(recoverySource, 'payment recovery helper');

    expectNoDirectFinancialEffects(cronSource, 'payment recovery cron');
    expectNoDirectFinancialEffects(recoverySource, 'payment recovery helper');
  });
});
