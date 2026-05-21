# Migration History

## Current state

| Migration | Status | Description |
|-----------|--------|-------------|
| `0_baseline` | Needs resolve | Full schema as of May 2026 — every table, index, and enum |
| `20260413230430_add_tour_fields` | Applied via `migrate dev` | `tourCompleted`, `orderTourCompleted` on users |
| `20260423120000_add_batch_id_to_orders` | Applied via `migrate dev` | `batchId` on orders + composite index |

## One-time production setup

Production already has the schema applied (via `db push` + the two dated migrations).
The `0_baseline` migration must be marked as "already applied" so Prisma doesn't
try to re-run it against a populated database.

Run these commands **once** against the production database:

```bash
# 1. Mark the baseline as already applied (does NOT execute the SQL)
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 0_baseline

# 2. Verify all three migrations show as applied
DATABASE_URL="<prod-url>" npx prisma migrate status
```

If production has NO `_prisma_migrations` table yet (never ran `migrate`), Prisma
will create it automatically when you run `resolve`. All three migrations need to
be resolved:

```bash
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 0_baseline
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 20260413230430_add_tour_fields
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 20260423120000_add_batch_id_to_orders
```

## Going forward

Use `migrate` for all schema changes — never `db push` against production.

```bash
# Development: create + apply migration
npm run db:migrate

# Production: apply pending migrations (safe, no prompts)
npm run db:deploy
```
