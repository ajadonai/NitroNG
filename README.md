# The Nitro NG

Your growth, simplified. The social media growth platform built for Nigerian creators and businesses.

**Website**: [nitro.ng](https://nitro.ng)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon) + Prisma 6
- **Auth**: Custom JWT (bcrypt + jose + httpOnly cookies)
- **Payments**: Flutterwave, NOWPayments (crypto), Manual bank transfer
- **SMM Providers**: MoreThanPanel, JustAnotherPanel, DaoSMM
- **Email**: Brevo (transactional)
- **Monitoring**: Sentry
- **UI**: React 19, Tailwind CSS
- **Fonts**: Outfit, Cormorant Garamond, JetBrains Mono
- **Hosting**: Vercel

## Getting Started

Requires Node.js 22.12 or newer and PostgreSQL.

```bash
npm ci
```

### Database Setup

1. Start an isolated local PostgreSQL database, or create a disposable
   non-production database at [neon.tech](https://neon.tech)
2. Copy `.env.example` to `.env` and fill in your credentials
3. Initialise a disposable local development database:

```bash
npx prisma db push
```

`db push` is for disposable development databases only. Production, staging, and
shared databases use the checked-in migration history; see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```text
app/            Next.js pages and API routes
components/     React components (dashboard, admin, landing, shared)
lib/            Server utilities (auth, email, payments, SMM providers)
prisma/         Database schema and migrations
public/         Static assets (logos, wordmarks, blog images)
docs/           Internal documentation
```

## Domains

- **Production**: nitro.ng
- **Staging**: nitrosmm.vercel.app

## Deployment safety

- `npm run migrations:check` validates the checked-in migration list and every
  immutable SHA-256 SQL checksum.
- `npm run env:validate:production` validates a complete production environment.
- `npm run db:status` fails when migrations are pending, failed, or divergent.
- Vercel runs `npm run deploy:check`; production builds check environment and
  migration status before compiling and never apply migrations implicitly.
