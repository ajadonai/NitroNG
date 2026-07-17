import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260717010000_add_payment_provider_audit_fields/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const uniqueIndexMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260717010100_add_payment_provider_unique_index/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const reconcileIndexMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260717010200_add_payment_provider_reconcile_index/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const reviewIndexMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260717010300_add_payment_review_index/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

function prismaModel(name) {
  const match = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  expect(match, `Prisma model ${name} should exist`).not.toBeNull();
  return match[1];
}

function sqlSetClause(sql) {
  const match = sql.match(/UPDATE\s+"transactions"\s+AS\s+t\s+SET([\s\S]*?)FROM\s+legacy_crypto/i);
  expect(match, 'legacy migration should contain a bounded UPDATE SET clause').not.toBeNull();
  return match[1];
}

describe('NOWPayments persistence schema', () => {
  const transaction = prismaModel('Transaction');

  it('stores the provider identity, quoted terms, observations, and verification time', () => {
    const expectedFields = [
      ['providerPaymentId', 'String\\?'],
      ['providerPriceAmount', 'Decimal\\?\\s+@db\\.Decimal\\(36,\\s*18\\)'],
      ['providerPriceCurrency', 'String\\?'],
      ['providerPayAmount', 'Decimal\\?\\s+@db\\.Decimal\\(36,\\s*18\\)'],
      ['providerPayCurrency', 'String\\?'],
      ['providerPayAddress', 'String\\?'],
      ['providerPaymentStatus', 'String\\?'],
      ['providerActuallyPaid', 'Decimal\\?\\s+@db\\.Decimal\\(36,\\s*18\\)'],
      ['providerLastVerifiedAt', 'DateTime\\?'],
      ['paymentReconciliationAttemptAt', 'DateTime\\?'],
    ];

    for (const [name, type] of expectedFields) {
      expect(transaction).toMatch(new RegExp(`^\\s*${name}\\s+${type}\\s*$`, 'm'));
    }
  });

  it('stores a durable manual-review lifecycle', () => {
    expect(transaction).toMatch(/^\s*paymentReviewFingerprint\s+String\?\s*$/m);
    expect(transaction).toMatch(/^\s*paymentReviewReason\s+String\?\s*$/m);
    expect(transaction).toMatch(/^\s*paymentReviewAt\s+DateTime\?\s*$/m);
    expect(transaction).toMatch(/^\s*paymentReviewResolvedAt\s+DateTime\?\s*$/m);
  });

  it('prevents a provider payment from being attached twice within one payment method', () => {
    expect(transaction).toMatch(
      /@@unique\(\[method,\s*providerPaymentId\],\s*map:\s*"transactions_method_provider_payment_id_key"\)/,
    );
  });

  it('indexes provider reconciliation and unresolved review scans', () => {
    expect(transaction).toMatch(
      /@@index\(\[method,\s*providerPaymentStatus,\s*paymentReconciliationAttemptAt\],\s*map:\s*"transactions_provider_reconcile_idx"\)/,
    );
    expect(transaction).toMatch(
      /@@index\(\[paymentReviewResolvedAt,\s*paymentReviewAt\],\s*map:\s*"transactions_payment_review_idx"\)/,
    );
  });
});

describe('NOWPayments provider-audit migration', () => {
  it('adds every nullable provider and review field with exact monetary precision', () => {
    const expectedColumns = [
      ['providerPaymentId', 'TEXT'],
      ['providerPriceAmount', 'DECIMAL\\(36,18\\)'],
      ['providerPriceCurrency', 'TEXT'],
      ['providerPayAmount', 'DECIMAL\\(36,18\\)'],
      ['providerPayCurrency', 'TEXT'],
      ['providerPayAddress', 'TEXT'],
      ['providerPaymentStatus', 'TEXT'],
      ['providerActuallyPaid', 'DECIMAL\\(36,18\\)'],
      ['providerLastVerifiedAt', 'TIMESTAMP\\(3\\)'],
      ['paymentReconciliationAttemptAt', 'TIMESTAMP\\(3\\)'],
      ['paymentReviewFingerprint', 'TEXT'],
      ['paymentReviewReason', 'TEXT'],
      ['paymentReviewAt', 'TIMESTAMP\\(3\\)'],
      ['paymentReviewResolvedAt', 'TIMESTAMP\\(3\\)'],
    ];

    for (const [name, sqlType] of expectedColumns) {
      expect(migration).toMatch(new RegExp(`ADD COLUMN "${name}" ${sqlType}(?:,|;)`));
    }

    expect(migration).not.toMatch(/ADD COLUMN[^;,]+\bNOT NULL\b/i);
  });

  it('backfills only legacy crypto deposits with a numeric NOWPayments id', () => {
    expect(migration).toMatch(/WHERE\s+"type"\s*=\s*'deposit'/i);
    expect(migration).toMatch(/AND\s+"method"\s*=\s*'crypto'/i);
    expect(migration).toContain(`AND "note" ~ '\\[np:[0-9]+\\]'`);
    expect(migration).toContain(`substring("note" FROM '\\[np:([0-9]+)\\]')`);
    expect(migration).toMatch(/WHERE\s+t\."id"\s*=\s*legacy_crypto\."id"/i);
    expect(migration).toMatch(/AND\s+legacy_crypto\.provider_payment_id\s+IS NOT NULL/i);
  });

  it('leaves duplicate legacy provider IDs unbound so the unique index cannot abort', () => {
    expect(migration).toMatch(/GROUP BY\s+provider_payment_id/i);
    expect(migration).toMatch(/HAVING\s+COUNT\(\*\)\s*=\s*1/i);
    expect(migration).toMatch(
      /unambiguous\.provider_payment_id\s*=\s*parsed\.provider_payment_id/i,
    );
  });

  it('treats the legacy dollar value as the USD price and never invents a crypto pay amount', () => {
    const setClause = sqlSetClause(migration);

    expect(migration).toContain(
      `substring("note" FROM '\\(\\$([0-9]+[.]?[0-9]*) USDT\\)') AS provider_price_amount`,
    );
    expect(setClause).toMatch(/"providerPriceAmount"\s*=\s*CASE[\s\S]*?::DECIMAL\(36,18\)/i);
    expect(setClause).toMatch(/\^\[0-9\]\{1,18\}[\s\S]*?\[0-9\]\{1,18\}/i);
    expect(setClause).toMatch(/"providerPriceCurrency"\s*=\s*'usd'/i);
    expect(setClause).toMatch(/"providerPayCurrency"\s*=\s*'usdttrc20'/i);
    expect(setClause).not.toMatch(/"providerPayAmount"\s*=/i);
    expect(setClause).not.toMatch(/"providerActuallyPaid"\s*=/i);
  });

  it('preserves every legacy transaction and leaves uncertain facts nullable', () => {
    expect(migration).not.toMatch(/\b(?:DELETE|TRUNCATE|DROP)\b/i);
    expect(migration).not.toMatch(/"(?:amount|balance|status|reference|userId)"\s*=/i);
    expect(migration).not.toMatch(/"providerPayAmount"\s*=/i);
    expect(migration).not.toMatch(/"providerActuallyPaid"\s*=/i);
  });

  it('builds schema-mapped indexes concurrently in separate migrations', () => {
    expect(migration).not.toMatch(/CREATE\s+(?:UNIQUE\s+)?INDEX/i);
    expect(uniqueIndexMigration).toMatch(
      /CREATE UNIQUE INDEX CONCURRENTLY "transactions_method_provider_payment_id_key"\s+ON "transactions"\("method", "providerPaymentId"\)/,
    );
    expect(reconcileIndexMigration).toMatch(
      /CREATE INDEX CONCURRENTLY "transactions_provider_reconcile_idx"\s+ON "transactions"\("method", "providerPaymentStatus", "paymentReconciliationAttemptAt"\)/,
    );
    expect(reviewIndexMigration).toMatch(
      /CREATE INDEX CONCURRENTLY "transactions_payment_review_idx"\s+ON "transactions"\("paymentReviewResolvedAt", "paymentReviewAt"\)/,
    );
    for (const sql of [uniqueIndexMigration, reconcileIndexMigration, reviewIndexMigration]) {
      expect((sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX/gi) || [])).toHaveLength(1);
    }
  });
});
