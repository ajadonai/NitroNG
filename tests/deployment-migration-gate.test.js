import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const migrationReadme = readFileSync(new URL('../prisma/migrations/README.md', import.meta.url), 'utf8');

const BASELINE_COMMIT = '7d2bb02f03f495af04e55279bc63df7dcd7944ff';
const BASELINE_SCHEMA_SHA256 = '44ce5a054d9c2db1d47e2647f698a3a27e7f397808843897a295a3a02e870dbb';
const LAST_LEGACY_MIGRATION = '20260712020000_add_order_nitro_points_redeemed';
const FIRST_REMEDIATION_MIGRATION = '20260717010000_add_payment_provider_audit_fields';

describe('clean PostgreSQL deployment gate', () => {
  it('materializes the immutable pre-remediation schema from full git history', () => {
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toContain(`PRE_REMEDIATION_BASELINE_COMMIT: ${BASELINE_COMMIT}`);
    expect(workflow).toContain(`PRE_REMEDIATION_SCHEMA_SHA256: ${BASELINE_SCHEMA_SHA256}`);
    expect(workflow).toMatch(/git show "\$\{PRE_REMEDIATION_BASELINE_COMMIT}:prisma\/schema\.prisma"/);
    expect(workflow).toContain('test "$actual_schema_sha256" = "$PRE_REMEDIATION_SCHEMA_SHA256"');
    expect(workflow).toContain('prisma validate --schema "$baseline_schema"');
    expect(workflow).toContain('prisma db push --schema "$baseline_schema" --skip-generate');
    expect(workflow).toContain('prisma/ci/enable-pg-trgm.sql');
    expect(workflow).toContain('prisma/ci/pre-remediation-fixture.sql');
  });

  it('registers the complete represented legacy range before deploying remediation migrations', () => {
    expect(workflow).toContain('20260705120000_add_signup_ip_index');
    expect(workflow).toContain(LAST_LEGACY_MIGRATION);
    expect(workflow).not.toMatch(new RegExp(`legacy_migrations=\\([\\s\\S]*${FIRST_REMEDIATION_MIGRATION}`));

    const resolvePosition = workflow.indexOf('prisma migrate resolve');
    const deployPosition = workflow.indexOf('npm run db:deploy');
    const statusPosition = workflow.indexOf('npm run db:status');
    const diffPosition = workflow.indexOf('prisma migrate diff --exit-code');
    expect(resolvePosition).toBeGreaterThan(-1);
    expect(deployPosition).toBeGreaterThan(resolvePosition);
    expect(statusPosition).toBeGreaterThan(deployPosition);
    expect(diffPosition).toBeGreaterThan(statusPosition);
  });

  it('executes live-data remediation fixtures and assertions around migration deploy', () => {
    const fixturePosition = workflow.indexOf('prisma/ci/pre-remediation-fixture.sql');
    const deployPosition = workflow.indexOf('npm run db:deploy');
    const assertionPosition = workflow.indexOf('prisma/ci/assert-remediation-results.sql');

    expect(fixturePosition).toBeGreaterThan(-1);
    expect(deployPosition).toBeGreaterThan(fixturePosition);
    expect(assertionPosition).toBeGreaterThan(deployPosition);

    const fixture = readFileSync(
      new URL('../prisma/ci/pre-remediation-fixture.sql', import.meta.url),
      'utf8',
    );
    const assertions = readFileSync(
      new URL('../prisma/ci/assert-remediation-results.sql', import.meta.url),
      'utf8',
    );
    expect(fixture).toContain("'pulse_secret_key'");
    expect(fixture).toContain('[np:123456789]');
    expect(fixture).toContain("'ci-crew-deleted'");
    expect(assertions).toContain('unique legacy crypto data was not backfilled');
    expect(assertions).toContain('deleted crew identity was not anonymized');
    expect(assertions).toContain('privacy constraints are missing or unexpectedly validated');
  });

  it('documents that the old migration chain is incomplete and must not be replayed directly', () => {
    expect(migrationReadme).toContain(BASELINE_COMMIT);
    expect(migrationReadme).toMatch(/does not fully reproduce/i);
    expect(migrationReadme).toMatch(/must not\s+be replayed directly/i);
  });
});
