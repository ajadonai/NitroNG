# Deployment and Environment Guide

## Local development

### Requirements

- Node.js 22.12 or newer
- npm
- Git
- An isolated PostgreSQL database or local PostgreSQL container

```bash
git clone https://github.com/ajadonai/NitroNG.git
cd NitroNG
npm ci
```

Copy `.env.example` to `.env` and use separate local databases for development
and integration tests. Never place a Neon production URL in a local development
or test environment.

```env
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nitro_dev
DIRECT_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nitro_dev
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nitro_test
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

For a disposable local database:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

`db push` is a local-development convenience only. Do not use it against shared,
staging, or production databases.

### Local seed safety

The seed deletes and recreates local data. It runs only when all safeguards pass:

- `NODE_ENV` is `development` or `test`.
- The database host is `localhost`, `127.0.0.1`, or `::1`.
- The database name ends in `_local`, `_dev`, or `_test` and exactly matches
  `NITRO_SEED_DATABASE_NAME`.
- `NITRO_ALLOW_DESTRUCTIVE_SEED=DELETE_LOCAL_SEED_DATA` is supplied for that
  command only.
- Both seed passwords are at least 12 characters.

Never configure `NITRO_SEED_*` variables in Vercel.

### Legacy operational script safety

The tracked cleanup, ID-migration, test-user, blog-seed, targeted-order, and
referral-backfill scripts are restricted to local/test databases. They refuse
Vercel, non-loopback hosts, non-PostgreSQL URLs, connection overrides, and
database names that do not end in `_local`, `_dev`, or `_test`. Set
`NITRO_SCRIPT_DATABASE_NAME` to the exact database name in `DATABASE_URL` before
running one. The completed launch-weekend points backfill is retired and has no
executable database path.

Every run defaults to read-only preview mode. After reviewing that preview, an
apply run requires both `NITRO_SCRIPT_MODE=apply` and the exact command-specific
`NITRO_SCRIPT_CONFIRM` phrase printed by the preview, for example
`APPLY_BACKFILL_REFERRAL_ATTRIBUTION_TO_nitro_dev`. A phrase for another script or
database is rejected. Never configure `NITRO_SCRIPT_*` variables in Vercel.

The tracked HTTP load test has no default target and permanently rejects
`nitro.ng`, `thenitro.ng`, and their subdomains. Because its login, rate-limit,
and order-race checks mutate server state, it sends no request unless an operator
sets an exact non-production `NITRO_LOAD_TEST_TARGET`,
`NITRO_LOAD_TEST_MODE=apply`, and the target-bound
`NITRO_LOAD_TEST_CONFIRM=APPLY_LOAD_TEST_TO_<origin>` phrase, plus dedicated test
credentials. The former `seed-production.sql` payload is retained only as
block-commented historical context; it has no executable statements. Retiring
that script does not modify existing production records or homepage statistics.

## Production environment

Configure variables separately for Vercel Production and Preview environments.
Preview builds also run with `NODE_ENV=production`: give them isolated preview
databases, API keys, webhook secrets, and provider credentials. Never expose
Production credentials or production data to pull-request/preview code. The
Production validator reports variable names only and never prints their values.

### Required production and build variables

| Area | Variables |
|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Application origin | `NEXT_PUBLIC_APP_URL` |
| Authentication | `JWT_SECRET`, `JWT_ADMIN_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Payment webhook authentication | `FLUTTERWAVE_WEBHOOK_HASH`, `NOWPAYMENTS_IPN_SECRET` |
| Transactional email | `BREVO_API_KEY` |
| SMM providers | `MTP_API_KEY`, `JAP_API_KEY`, `DAOSMM_API_KEY` |
| Sentry runtime | `NEXT_PUBLIC_SENTRY_DSN` |
| Sentry source maps | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |

Both database URLs must name a database and set `sslmode=require` or
`sslmode=verify-full`. `DIRECT_URL` must use the provider's direct, unpooled
endpoint; pooler hosts, `pgbouncer=true`, and local hosts are rejected by the
production validator. The decoded database name, username, port, and Prisma
`schema` query parameter (absent means `public`) must match between the two URLs.
Hosts must match as well, except for Neon's expected `-pooler` marker on the
pooled runtime endpoint. This prevents migrations from targeting a different
database or schema than the application serves.

`NEXT_PUBLIC_APP_URL` must be the HTTPS origin only, normally
`https://nitro.ng`. It must not contain a path, query, fragment, credentials, or
localhost. Obsolete aliases such as `NEXT_PUBLIC_BASE_URL` are not required; if
temporarily retained, they must exactly match `NEXT_PUBLIC_APP_URL`.

Validate the full target-production environment before any migration or release:

```bash
npm run env:validate:production
```

All variables in this table are required at build time. The build validator
cannot use database state to determine which SMM providers are active, so the
three SMM provider keys fail closed when absent.

### Runtime settings and provider endpoints

| Capability | Variables |
|---|---|
| Flutterwave gateway fallback | `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY` |
| NOWPayments gateway fallback | `NOWPAYMENTS_API_KEY` |
| Transactional email sender | `SENDER_EMAIL`, `SENDER_NAME` |
| MoreThanPanel endpoint | `MTP_API_URL` |
| JustAnotherPanel endpoint | `JAP_API_URL` |
| DaoSMM endpoint | `DAOSMM_API_URL` |

`INTERNAL_DASHBOARD_SECRET` and `HEARTBEAT_SECRET` are optional
domain-separated keys with the documented JWT fallbacks. `ANALYTICS_READ_TOKEN`
is a separate, independent optional credential. When analytics-read access is
enabled, use a unique token of at least 32 characters and send it only as
`Authorization: Bearer <token>`; never place it in a query string.
Payment API credentials are managed in the database first; the payment fallback
variables above are optional and are validated when present.
Telegram, Meta CAPI, analytics-read, and crew-bot variables are optional only
when those integrations are disabled.

In production, any supplied `MTP_API_URL`, `JAP_API_URL`, or `DAOSMM_API_URL`
must use HTTPS and contain no URL credentials because these endpoints receive
provider keys and order payloads. Development/test may use credential-free HTTP
mock endpoints. Production validation also rejects surrounding whitespace on
configured values so validated secrets cannot differ from their runtime form.

### Webhook endpoints

- Flutterwave: `https://nitro.ng/api/payments/webhook`
- NOWPayments: `https://nitro.ng/api/payments/crypto/webhook`
- Google OAuth callback: `https://nitro.ng/api/auth/google/callback`

Paystack variables and `/api/paystack/webhook` are obsolete and must not be used.

## Migration-first release process

Production migrations are forward-only and are applied separately from Vercel
builds. The Vercel gate checks status but never mutates the database.

### Before applying a migration

Before the first Phase 8 release, rotate both `CRON_SECRET` and any configured
`ANALYTICS_READ_TOKEN`; their former query-string transport may have exposed
them in logs or intermediary metadata. This code change does not rotate external
credentials. After rotation, use Bearer headers only.

1. Confirm every migration file, its immutable SHA-256 manifest entry, and
   `.github/workflows/ci.yml` are tracked:

   ```bash
   npm run migrations:check:tracked
   ```

   Existing migration SQL and checksum entries are immutable. If either differs,
   restore it and create a new forward migration.
2. Review new SQL for locks, destructive statements, backfills, and compatibility
   with both the current and next application versions.
3. Confirm Neon point-in-time recovery or a fresh backup is available.
4. Run the full test suite and a local build.
5. Compare every migration already applied in the target database with the
   immutable manifest before any pending SQL runs:

   ```bash
   npm run migrations:verify:applied:pending
   ```

   This read-only preflight permits manifest entries that are still pending but
   rejects any changed checksum or database-only migration. Its first production
   run is the one-time verification of the newly introduced checksum baseline;
   any mismatch blocks the release and must be investigated, never overwritten.
6. Use one approved operator/job so two production migration runs cannot race.

### Apply and verify

From an approved environment containing the production database variables:

```bash
npm run env:validate:production
npm run db:deploy
npm run db:status
npm run migrations:verify:applied
```

The final command is read-only. It compares every successful, non-rolled-back
row in Prisma's migration history with `prisma/migrations/checksums.json` in
both directions and fails on a missing name, extra name, duplicate successful
row, or checksum difference. It never prints database URLs or digest values.

Do not place database URLs directly on the command line or in shell history.
Do not use `db push`, `migrate dev`, or `migrate reset` in production.

If a migration fails, stop the release. Do not edit an applied migration or mark
a failed migration successful without verifying the database state. Restore from
the approved recovery point or ship a reviewed forward fix, then rerun status.

## CI and Vercel gates

The tracked GitHub workflow named **Deployment gate** runs on pull requests and
pushes to `main`. It:

1. installs exactly `package-lock.json` with Node 22.12;
2. verifies the tracked migration manifest and Prisma schema;
3. materializes the immutable pre-remediation schema snapshot from commit
   `7d2bb02f03f495af04e55279bc63df7dcd7944ff` in clean PostgreSQL and registers
   the 24 legacy migrations represented by it, then inserts synthetic historical
   data shapes into that disposable database;
4. genuinely applies all `20260717...` remediation migrations, requires clean
   status, verifies the applied-history checksums and live-data transformation
   assertions, and compares the result with the current Prisma model;
5. runs all tests; and
6. requires a successful production compile.

The historical pre-remediation migration chain is incomplete and must not be
replayed directly into an empty database. The snapshot exists only to give CI a
faithful structural starting point without changing any already-applied SQL or
checksum. It is not a production bootstrap command.

In Vercel, `vercel.json` runs `npm run deploy:check`. Preview/local builds verify
the migration manifest and compile without being mistaken for production merely
because Next.js sets `NODE_ENV=production` during compilation. CI explicitly sets
`NITRO_VALIDATE_PRODUCTION_ENV=1` so its compile exercises the full environment
validator. For Vercel Production, the gate additionally:

1. validates the full production environment;
2. runs read-only `prisma migrate status`; and
3. verifies successful applied-migration names and checksums with a read-only
   query; and
4. compiles only when all checks pass.

Configure these repository settings manually:

- GitHub branch protection: require **Deployment gate** before merging to `main`.
- Vercel Production Deployment Checks: require the same GitHub check before
  automatic promotion to `nitro.ng`.
- Vercel project Node.js version: 22.x (at least 22.12).

The repository can define the check, but it cannot enable branch protection or
Vercel's dashboard-level promotion rule by itself.

The production `build` script currently pins Next.js to Webpack because the
default local Turbopack build has repeatedly stalled without an error, while the
Webpack path completes the same compile and page generation successfully.

## Final release checklist

- Working tree contains only reviewed changes.
- Migration and workflow manifest check passes.
- Production environment validation passes.
- Backup/PITR readiness is confirmed.
- `db:deploy`, `db:status`, and `migrations:verify:applied` pass from one
  serialized operator.
- GitHub **Deployment gate** passes on the exact commit.
- Vercel production build passes and is promoted only after its required check.
- Payment webhooks, login, one deposit path, and one order path are smoke-tested.

## Rollback

Vercel can roll application code back, but a code rollback does not undo a
database migration. Prefer backward-compatible migrations so both application
versions can run during release. For incompatible database changes, use the
reviewed forward-recovery migration or Neon recovery procedure selected before
the release.

## Production infrastructure

- Hosting: Vercel
- Database: Neon PostgreSQL, `eu-west-2`, SSL required
- Primary domain: `nitro.ng`
- Secondary redirect: `thenitro.ng`
- Monitoring: Sentry, Vercel logs, and Neon database monitoring

PostgreSQL table names are lowercase and must be quoted in raw SQL, for example
`"tickets"`, `"users"`, and `"orders"`.
