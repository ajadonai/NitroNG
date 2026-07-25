import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { reportCliOperationalFailure } from '../scripts/lib/operational-monitoring.mjs';

describe('CLI operational failure markers', () => {
  it('emits a stable GitHub annotation without accepting free-form secrets', () => {
    const logger = { error: vi.fn() };
    expect(reportCliOperationalFailure({
      signal: 'migration_command_failed',
      reason: 'db_deploy',
      data: { errorCount: 2, databaseUrl: 'postgresql://secret' },
      env: { GITHUB_ACTIONS: 'true' },
      logger,
    })).toBe(true);

    const output = logger.error.mock.calls.flat().join('\n');
    expect(output).toContain('migration_command_failed');
    expect(output).toContain('db_deploy');
    expect(output).toContain('errorCount');
    expect(output).toContain('::error title=Migration gate failure::');
    expect(output).not.toContain('postgresql://secret');
  });

  it('rejects unbounded signal and reason values', () => {
    const logger = { error: vi.fn() };
    expect(reportCliOperationalFailure({ signal: '../unsafe', logger })).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();

    reportCliOperationalFailure({
      signal: 'migration_command_failed',
      reason: 'postgresql://user:password@host/db',
      logger,
      env: {},
    });
    expect(logger.error.mock.calls.flat().join('\n')).toContain('invalid_reason');
    expect(logger.error.mock.calls.flat().join('\n')).not.toContain('password');
  });

  it('wires migration validation and deploy-command failures to stable markers', () => {
    const manifestCheck = readFileSync(
      new URL('../scripts/check-migrations.mjs', import.meta.url),
      'utf8',
    );
    const checksumCheck = readFileSync(
      new URL('../scripts/verify-applied-migration-checksums.mjs', import.meta.url),
      'utf8',
    );
    const deployGate = readFileSync(
      new URL('../scripts/deployment-gate.mjs', import.meta.url),
      'utf8',
    );

    expect(manifestCheck).toContain("signal: 'migration_manifest_failed'");
    expect(checksumCheck).toContain("signal: 'migration_checksum_failed'");
    expect(deployGate).toContain("signal: 'migration_command_failed'");
  });
});
