# BoostPanel

Nigeria's #1 SMM Panel — buy Instagram followers, TikTok views, YouTube subscribers and more.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
boostpanel/
├── app/
│   ├── layout.jsx          # Root layout (fonts, metadata)
│   ├── globals.css          # Global reset + font classes
│   ├── page.jsx             # / → Landing
│   ├── not-found.jsx        # 404
│   ├── dashboard/page.jsx   # /dashboard → User panel
│   ├── admin/
│   │   ├── page.jsx         # /admin → Admin panel
│   │   └── login/page.jsx   # /admin/login
│   ├── verify/page.jsx      # /verify
│   ├── maintenance/page.jsx # /maintenance
│   ├── terms/page.jsx       # /terms
│   └── privacy/page.jsx     # /privacy
├── components/
│   ├── landing-page.jsx
│   ├── smm-panel.jsx
│   ├── admin-panel.jsx
│   ├── admin-login.jsx
│   ├── verify.jsx
│   ├── maintenance.jsx
│   ├── terms.jsx
│   ├── privacy.jsx
│   └── 404.jsx
├── next.config.mjs
├── jsconfig.json
└── package.json
```

## Next Up

- Backend: Auth, database, Paystack/Flutterwave integration, MoreThanPanel API
