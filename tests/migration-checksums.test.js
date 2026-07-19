import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  sha256,
  validateMigrationChecksumManifest,
} from '../scripts/lib/migration-checksums.mjs';

const migrationsRoot = new URL('../prisma/migrations/', import.meta.url);

function actualManifestInput() {
  const migrationDirectories = readdirSync(migrationsRoot)
    .filter((entry) => {
      try {
        return readFileSync(new URL(`${entry}/migration.sql`, migrationsRoot)).length > 0;
      } catch {
        return false;
      }
    })
    .sort();
  const migrationSql = new Map(migrationDirectories.map((directory) => [
    directory,
    readFileSync(new URL(`${directory}/migration.sql`, migrationsRoot)),
  ]));
  const manifest = JSON.parse(readFileSync(new URL('checksums.json', migrationsRoot), 'utf8'));
  return { migrationDirectories, migrationSql, manifest };
}

describe('immutable migration checksum manifest', () => {
  it('matches every migration currently checked into the repository', () => {
    expect(validateMigrationChecksumManifest(actualManifestInput())).toEqual([]);
  });

  it('rejects a migration whose SQL no longer matches its committed digest', () => {
    const migrationDirectories = ['20260719000000_example'];
    const original = Buffer.from('SELECT 1;\n');
    const manifest = {
      algorithm: 'sha256',
      migrations: { '20260719000000_example': sha256(original) },
    };

    expect(validateMigrationChecksumManifest({
      migrationDirectories,
      migrationSql: new Map([['20260719000000_example', Buffer.from('SELECT 2;\n')]]),
      manifest,
    })).toEqual([
      '20260719000000_example/migration.sql does not match its committed sha256 checksum',
    ]);
  });

  it('requires exact key-set equality between directories and the manifest', () => {
    const manifest = {
      algorithm: 'sha256',
      migrations: {
        '20260718000000_stale': sha256('SELECT 1;'),
      },
    };

    expect(validateMigrationChecksumManifest({
      migrationDirectories: ['20260719000000_new'],
      migrationSql: new Map([['20260719000000_new', Buffer.from('SELECT 1;')]]),
      manifest,
    })).toEqual([
      '20260719000000_new is missing from the migration checksum manifest',
      '20260718000000_stale is present in the checksum manifest but has no migration directory',
    ]);
  });

  it('rejects an unsupported algorithm or malformed digest', () => {
    expect(validateMigrationChecksumManifest({
      migrationDirectories: ['0_init'],
      migrationSql: new Map([['0_init', Buffer.from('SELECT 1;')]]),
      manifest: {
        algorithm: 'md5',
        migrations: { '0_init': 'not-a-sha256' },
      },
    })).toEqual([
      'migration checksum manifest algorithm must be sha256',
      '0_init has an invalid sha256 checksum in the manifest',
    ]);
  });
});
