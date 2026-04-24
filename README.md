# Nitro

Nigeria's premium SMM panel — buy Instagram followers, TikTok views, YouTube subscribers and more.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon) + Prisma 6
- **Auth**: Custom JWT (bcrypt + jose + httpOnly cookies)
- **Payments**: Flutterwave, NOWPayments (crypto), Manual bank transfer
- **SMM Providers**: MoreThanPanel (primary), JAP + DaoSMM (pending)
- **UI**: React 19, Tailwind CSS
- **Fonts**: Outfit, Cormorant Garamond, JetBrains Mono

## Getting Started

```bash
npm install
```

### Database Setup

1. Create a free PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy `.env.example` to `.env` and add your connection string
3. Push the schema:

```bash
npx prisma db push
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Domains

- **Primary**: nitro.ng
- **Staging**: nitrosmm.vercel.app
