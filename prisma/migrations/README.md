# Migration History

The entire `prisma/migrations` directory, including `migration_lock.toml` and
`checksums.json`, is deployment source code and must remain in Git.
`schema.prisma` alone cannot reproduce data migrations, concurrent indexes,
backfills, or constraints.

As of the Phase 8 audit, all 34 migration directories and the CI workflow are
intentionally tracked. No migration in the working tree was rejected or omitted.
Run this whenever a migration is added:

```bash
npm run migrations:check:tracked
```

`checksums.json` pins the SHA-256 digest of every `migration.sql`. Adding a new
migration requires adding its digest and is reviewed as one change. Never update
an existing digest to make a modified applied migration pass: restore the
original SQL and create a new forward migration instead. The manifest check also
requires exact key-set equality, so an omitted or deleted migration fails.

## Legacy baseline

The pre-remediation migration chain does not fully reproduce the database from
an empty PostgreSQL instance. `0_init` duplicates fields added by the next two
migrations, while later migrations assume legacy tables and columns that were
created before the project consistently used checked-in migrations. It must not
be replayed directly or rewritten: those SQL files are already represented in
real migration histories and their checksums are immutable.

For its disposable PostgreSQL service only, CI uses the Prisma schema from
commit `7d2bb02f03f495af04e55279bc63df7dcd7944ff`, the Phase 1–3 consolidation
immediately before the remediation migrations, as an immutable structural
snapshot. CI checks out full Git history, installs the required `pg_trgm`
extension, materializes that schema with `prisma db push`, executes the one
legacy data seed, and resolves the 24 represented migrations from `0_init`
through `20260712020000_add_order_nitro_points_redeemed`. CI also inserts
synthetic historical rows into that disposable database. It then genuinely
applies every `20260717...` remediation migration with `prisma migrate deploy`,
requires clean migration status, verifies the successful applied-history rows
against the immutable checksum manifest, asserts live-data backfills and
SQL-only privacy constraints, and compares the resulting database with the
current Prisma model.

This snapshot procedure is a CI bootstrap, not a production migration command.
Production already contains the legacy schema and recorded history; operators
apply only pending forward migrations there.

## Production rules

- Never run `prisma db push`, `prisma migrate dev`, or `prisma migrate reset`
  against staging or production.
- Never edit or delete an applied migration. Use a new forward migration.
- Review backup/PITR readiness and migration SQL before applying it.
- Apply pending migrations from one approved, serialized operator or job:

  ```bash
  npm run db:deploy
  npm run db:status
  npm run migrations:verify:applied
  ```

- Vercel's production build runs `db:status` and
  `migrations:verify:applied` read-only. Status catches pending, failed, missing,
  or divergent migration history; the checksum verifier also catches names or
  digests that differ from the immutable manifest. Neither command changes the
  database.
- Roll application code back only when the migrated schema remains compatible.
  Otherwise restore through the approved database recovery procedure or ship a
  new forward migration.

The current status of any target database is authoritative only when both
read-only checks run against that target's full environment.
