# scripts/

Everything here is run by hand or by CI. Nothing in this folder runs on a
schedule — the scheduled work lives in `app/api/cron/*`.

This file exists because the folder had drifted into a place where nobody could
tell a live tool from a finished one. Ten spent one-offs were deleted on 14 Sep
2026: the SEO, index and wholesale blog seeds and the task seed, whose rows are
in the database and live; a promises seed whose model no longer exists; the
reseller-ID backfill and the reseller map that superseded it, both run; and
three one-off generators from July that produced a document once.

Four more were deleted in the same pass and **put back**, which is the useful
lesson. `cleanup-seed-data.js`, `seed-testuser.js`, `seed-blog.cjs` and
`seed-production.sql` look like spent one-offs and are not: somebody had already
decided to keep them and make them safe, and wrote `tests/operational-script-safety.test.js`
around them to prove it. A script with a test guarding it is a script somebody
owns.

**If you add a script here, add a line here too.** An undocumented script becomes
dead weight within a month, which is exactly how the last ten happened.

## Run by CI or npm

These are wired into `package.json` or the deploy. Breaking one breaks a build.

| Script | What it does |
| --- | --- |
| `check-migrations.mjs` | Fails the build when a Prisma migration is missing or out of order. |
| `verify-applied-migration-checksums.mjs` | Fails the build when an applied migration's checksum has changed under us. |
| `validate-production-env.mjs` | Fails the build when a required production environment variable is absent. |
| `deployment-gate.mjs` | The pre-deploy gate. Runs the checks above together. |
| `i18n-baseline.mjs` | The untranslated-English ratchet. `--write` records the current debt; no flag reports the change since. Read by `tests/i18n-drift-guard.test.js`. |
| `i18n-report.mjs` | Translation coverage per dictionary. `--missing <code>` emits a JSON skeleton, `--orphans` lists translations whose English has since changed. |
| `i18n-detect.mjs` | Scans the repo for user-facing English that is not wrapped. Imported by the drift guard, so it is a library as much as a script. |
| `i18n-wrap.mjs` | Wraps detected strings in `tr()`. `--dry` first, always. |

## Support and operations, run by hand

Reach for these when a person needs something done. **They talk to the
production database** — the same one the dev server uses — so read before you
run.

| Script | What it does |
| --- | --- |
| `investigate-user.mjs` | Everything about one account in one place: orders, transactions, balance, flags. The first thing to run when a customer reports something. |
| `reset-user-password.mjs` | Sets a customer's password by hand. Use only when the reset email genuinely cannot reach them. |
| `integrity-check.js` / `.sql` | Data integrity sweep: balances against ledger, orphaned rows, impossible states. |

## Catalogue and pricing, run when the catalogue moves

| Script | What it does |
| --- | --- |
| `pull-providers.mjs` | Pulls the current service list from the upstream providers. |
| `dump-catalogue.mjs` | Exports the catalogue as it stands, for diffing or for a spreadsheet. |
| `audit-all-tiers.mjs` | Checks every curated tier still prices above cost across the markup brackets. Run after any change to the markup settings. |
| `quality-audit.mjs` | Flags services whose delivery record has drifted from what their tier promises. |

## Refills

Three scripts from before the admin Refills queue shipped (29 Aug 2026). Kept
because they answer questions the admin page does not, but check the page first.

| Script | What it does |
| --- | --- |
| `refill-audit.mjs` | Which completed orders are inside their refill window and eligible. |
| `refill-db-audit.mjs` | The same question asked straight of the database, as a cross-check. |
| `refill-alternatives.mjs` | For a service with no refill cover, what comparable service has it. |

## Guarded mutating scripts

These write to the database, so they route through `runGuardedPrismaScript` and
refuse to mutate before a dry-run fence. `tests/operational-script-safety.test.js`
fails the build if any of them stops doing that, or opens its own
`PrismaClient`. Add a script to that test's list when you add one here.

| Script | What it does |
| --- | --- |
| `seed-blog.cjs` | Seeds blog content. |
| `seed-testuser.js` | Creates a test account. |
| `cleanup-seed-data.js` | Removes what the seeds created. |
| `seed-production.sql` | Retired. Kept as comments only, for audit context; a test asserts it contains no executable SQL. |

## Load testing

| Script | What it does |
| --- | --- |
| `load-test.js` | Throws concurrent traffic at the app. Point it at a preview deploy, never at production. |
