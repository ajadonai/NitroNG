# Migration History

## Current state

| Migration | Status | Description |
|-----------|--------|-------------|
| `0_init` | Applied in prod | Full schema baseline |
| `20260413230430_add_tour_fields` | Applied in prod | `tourCompleted`, `orderTourCompleted` on users |
| `20260423120000_add_batch_id_to_orders` | Applied in prod | `batchId` on orders + composite index |

## One-time production setup (DONE)

Production already has `0_init` recorded. The two dated migrations need to be
marked as applied so Prisma knows they're already in the schema:

```bash
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 20260413230430_add_tour_fields
DATABASE_URL="<prod-url>" npx prisma migrate resolve --applied 20260423120000_add_batch_id_to_orders
DATABASE_URL="<prod-url>" npx prisma migrate status
```

## Going forward

Use `migrate` for all schema changes — never `db push` against production.

```bash
# Development: create + apply migration
npm run db:migrate

# Production: apply pending migrations (safe, no prompts)
npm run db:deploy
```
