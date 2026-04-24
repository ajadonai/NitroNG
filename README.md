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

```bash
npm install
```

### Database Setup

1. Create a PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy `.env.example` to `.env` and fill in your credentials
3. Push the schema:

```bash
npx prisma db push
```

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
