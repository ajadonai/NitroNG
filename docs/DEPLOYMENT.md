# Deployment & Environment Guide

---

## Local Development

### Prerequisites

- Node.js v20+
- npm (comes with Node)
- Git
- A local PostgreSQL instance or isolated local PostgreSQL container

### Setup

```bash
git clone https://github.com/ajadonai/NitroNG.git
cd boost
npm install
```

### Environment Variables

Create `.env` in the project root (never commit this):

```env
# Local development database
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nitro_dev
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/nitro_test

# Required only for the destructive local seed
NITRO_SEED_DATABASE_NAME=nitro_dev
NITRO_ALLOW_DESTRUCTIVE_SEED=
NITRO_SEED_USER_PASSWORD=
NITRO_SEED_ADMIN_PASSWORD=

# Auth
JWT_SECRET=your-jwt-secret
JWT_ADMIN_SECRET=your-admin-jwt-secret

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx

# SMM Providers
MTP_API_KEY=your-mtp-key
MTP_API_URL=https://morethanpanel.com/api/v2
JAP_API_KEY=your-jap-key
JAP_API_URL=https://justanotherpanel.com/api/v2
DAOSSMM_API_KEY=your-dao-key
DAOSSMM_API_URL=https://daosmm.com/api/v2

# Email
BREVO_API_KEY=your-brevo-key
BREVO_SENDER_EMAIL=noreply@thenitro.ng
BREVO_SENDER_NAME=Nitro

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

### Database

Development and tests must use separate local databases. Never point either one at
the shared Neon or production database. Create `nitro_dev` for local development
and `nitro_test` for integration tests, then use the matching URL from `.env`.

```bash
npx prisma generate      # Generate Prisma client
npx prisma db push        # Push schema changes (dev only)
NITRO_ALLOW_DESTRUCTIVE_SEED=DELETE_LOCAL_SEED_DATA npm run db:seed
                          # Deletes and recreates data in the approved local database
npx prisma studio         # Browser-based DB explorer
```

The seed command fails unless all of these conditions are true:

- `NODE_ENV` is `development` or `test`.
- `DATABASE_URL` uses `localhost`, `127.0.0.1`, or `::1`.
- The database name ends in `_local`, `_dev`, or `_test` and exactly matches
  `NITRO_SEED_DATABASE_NAME`.
- `NITRO_ALLOW_DESTRUCTIVE_SEED` is set to `DELETE_LOCAL_SEED_DATA`.
- Both seed passwords are supplied and contain at least 12 characters.

Keep `NITRO_ALLOW_DESTRUCTIVE_SEED` blank in `.env`. Supply the confirmation only
on the individual command you intend to run, as shown above, so a later seed
cannot start without a fresh explicit confirmation.

The admin account is `admin@example.test`. Seeded user accounts use their listed
`@example.test` addresses. Use the passwords you supplied in the seed variables;
the command never prints them. Do not configure any `NITRO_SEED_*` variables in
Vercel.

Table names are **lowercase** — always quote in raw SQL: `"tickets"`, `"users"`, `"orders"`.

### Run

```bash
npm run dev
```

Runs at `http://localhost:3000` with hot reload.

---

## Production — Vercel

### Deployment

Pushing to `main` auto-deploys to Vercel.

```bash
# Pre-push checklist:
# 1. Verify brace balance
# 2. Test on localhost
# 3. Check mobile if UI changed

git add -A
git commit -m "description"
git push origin main
```

### Environment Variables (Vercel)

All configured in Vercel dashboard → Project Settings → Environment Variables.

| Variable | Status |
|----------|--------|
| `DATABASE_URL` | ✅ |
| `JWT_SECRET` | ✅ |
| `JWT_ADMIN_SECRET` | ✅ |
| `PAYSTACK_SECRET_KEY` (live) | ✅ |
| `PAYSTACK_PUBLIC_KEY` (live) | ✅ |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ✅ |
| `MTP_API_KEY` | ✅ |
| `MTP_API_URL` | ✅ |
| `JAP_API_KEY` | ✅ |
| `DAOSSMM_API_KEY` | ✅ |
| `BREVO_API_KEY` | ✅ |
| `NEXT_PUBLIC_BASE_URL` | ✅ |
| `NODE_ENV` | ✅ |

**Note:** `NEXT_PUBLIC_*` vars are baked at build time. Changing them requires a redeploy.

### Domains

| Domain | Status |
|--------|--------|
| nitro.ng | Active (primary) |
| thenitro.ng | Active (secondary/redirect) |

### Build Settings

- Framework: Next.js
- Build command: `next build`
- Output: `.next`
- Node.js: 20.x

---

## Database — Neon

- Provider: Neon
- Region: eu-west-2
- SSL: Required (`?sslmode=require`)
- Point-in-time recovery available via Neon dashboard

### Prisma Workflow

```bash
npx prisma generate         # After schema changes
npx prisma db push           # Dev: push directly
npx prisma migrate dev       # When ready for formal migrations
```

### Manual Backup

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## Git Conventions

- `main` = production (auto-deploys)
- Backup branches before major rebuilds: `backup/pre-[feature]-rebuild`
- Always `git pull` before starting work (parallel sessions have caused conflicts)
- Keep changes scoped — don't refactor unrelated files in the same commit

```
feat: add soft locking for multi-admin tickets
fix: mobile nav spacing on services page
refactor: move static styles to globals.css
chore: clean up test seed data
```

---

## Monitoring

- **Vercel:** Function logs + build logs in the dashboard
- **Neon:** Query performance + connection count in Neon dashboard
- **Provider API:** Server-side error logging (dedicated monitoring planned for Phase 2 via Railway)

---

## Common Issues

**Build failed on Vercel** — Check build logs. Usually TypeScript/ESLint errors.

**Database connection refused** — Check Neon dashboard, verify `DATABASE_URL`, check connection limits.

**Paystack webhook not working** — Verify webhook URL (`https://nitro.ng/api/paystack/webhook`), check function logs, confirm secret key matches.

**Provider API errors** — Test directly with curl, verify API key and balance, check if service ID still exists.
