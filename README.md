# BoostPanel

Nigeria's #1 SMM Panel — buy Instagram followers, TikTok views, YouTube subscribers and more.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon) + Prisma 6
- **Auth**: Custom JWT (bcrypt + jose + httpOnly cookies)
- **UI**: React 19, inline styles + component-scoped CSS
- **Fonts**: Cormorant Garamond, Outfit, JetBrains Mono

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero, features, pricing, FAQ, auth modals |
| `/dashboard` | User Panel | New order, orders, add funds, referrals, services, support, settings |
| `/admin` | Admin Panel | Overview, orders, users, services, API, payments, tickets, alerts, maintenance |
| `/admin/login` | Admin Login | Admin authentication gate |
| `/verify` | Verify | Email verification (6-digit code) |
| `/maintenance` | Maintenance | Maintenance mode page |
| `/terms` | Terms | Terms of Service |
| `/privacy` | Privacy | Privacy Policy |
| `/*` | 404 | Not found page |

## Getting Started

```bash
npm install
```

### Database Setup

1. Create a free PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy `.env.example` to `.env` and add your connection string
3. Push the schema and seed:

```bash
npx prisma db push
npx prisma db seed
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| User | chidi@gmail.com | password123 |
| Admin | admin@boostpanel.ng | admin123 |

## Project Structure

```
boostpanel/
├── app/
│   ├── layout.jsx              # Root layout (fonts, metadata)
│   ├── globals.css              # Global reset + font classes
│   ├── page.jsx                 # / → Landing
│   ├── not-found.jsx            # 404
│   ├── dashboard/page.jsx       # /dashboard → User panel (protected)
│   ├── admin/
│   │   ├── page.jsx             # /admin → Admin panel (protected)
│   │   └── login/page.jsx       # /admin/login
│   ├── verify/page.jsx          # /verify
│   ├── maintenance/page.jsx     # /maintenance
│   ├── terms/page.jsx           # /terms
│   ├── privacy/page.jsx         # /privacy
│   └── api/auth/                # Auth API routes
│       ├── signup/route.js
│       ├── login/route.js
│       ├── logout/route.js
│       ├── verify/route.js
│       ├── me/route.js
│       ├── forgot-password/route.js
│       ├── reset-password/route.js
│       └── admin/
│           ├── login/route.js
│           ├── logout/route.js
│           └── me/route.js
├── components/                  # Page components (9 files)
├── lib/
│   ├── prisma.js                # Prisma client singleton
│   ├── auth.js                  # JWT sign/verify + cookie helpers
│   └── utils.js                 # ID generators, response helpers
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.js                  # Mock data seed
├── middleware.js                 # Route protection (JWT check)
├── .env.example                 # Environment template
├── next.config.mjs
├── jsconfig.json
└── package.json
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/signup | User registration |
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| POST | /api/auth/verify | Verify email (6-digit code) |
| PUT | /api/auth/verify | Resend verification code |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset password with token |
| POST | /api/auth/admin/login | Admin login |
| POST | /api/auth/admin/logout | Admin logout |
| GET | /api/auth/admin/me | Get current admin |

## Next Up

- Connect UI components to real API (replace mock data)
- Paystack/Flutterwave payment integration
- MoreThanPanel SMM API integration
- Email sending (verification, password reset)
