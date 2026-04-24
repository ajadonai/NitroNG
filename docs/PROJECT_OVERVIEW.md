# Nitro

> Nigeria's premium social media marketing panel. Built from scratch.

**Domain:** nitro.ng | thenitro.ng  
**Repo:** github.com/ajadonai/NitroNG  
**Founder:** Ojima

---

## What is Nitro?

Nitro is a full-featured SMM (Social Media Marketing) panel targeting Nigerian creators, businesses, and marketers. Users purchase social media engagement — followers, likes, views, comments, subscribers — across 35+ platforms including Instagram, TikTok, YouTube, Twitter/X, Facebook, Spotify, Telegram, and Nigerian-specific platforms like Audiomack and Boomplay.

Not a reseller template or white-label clone. Custom-built with premium positioning, polished UI, multi-provider routing architecture, tiered pricing, and Nigerian-market-specific features.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (React 19) |
| Database | PostgreSQL on Neon (eu-west-2) |
| ORM | Prisma 6 |
| Auth | Custom JWT — user (7-day), admin (3-day), superadmin (90-day). SHA-256 token hashing. 1 web + 1 mobile per account. |
| Payments | Paystack (live). Flutterwave + ALATPay pending verification. |
| Email | Brevo (transactional) |
| SMM Providers | MTP (primary, 4,405 services), JAP (gap-filler), DaoSMM (Nigerian specialist) |
| Deployment | Vercel (frontend). Railway planned for workers/queues. |
| Version Control | GitHub |

---

## Architecture

Nitro is a unified Next.js application. All components share state, styles, and behaviour through centralised systems:

- **Theme** — localStorage key `nitro-theme` (`night`/`day`). Auto-switches at 7am/6pm if no manual preference.
- **Auth** — Custom JWT with middleware route protection. Separate token flows for users and admins.
- **Navigation** — Shared across all authenticated pages. Admin panel has own nav but uses same theme/auth.
- **Database** — PostgreSQL on Neon. All table names lowercase. Prisma ORM.
- **Provider layer** — Orders flow: User → Nitro validates + deducts wallet → Provider API → Status polling → Order updated.

---

## Design System

**Typography:** Outfit (UI), Cormorant Garamond (serif accents), JetBrains Mono (mono)

**Colours:**
- Accent: `#c47d8e` (soft rose)
- Dark BG: `#080b14` | Light BG: `#f4f1ed`
- Pricing section: `#1a1520` (always dark)
- Tiers: Budget = amber, Standard = blue, Premium = purple
- Nigerian services: green tint + 🇳🇬 flag

**Breakpoints:** Mobile 0–767px, Tablet 768–1199px, Desktop 1200px+

**Rules:**
- All static styles in `globals.css` — no inline sizing/layout in JSX
- Only theme-dependent colours stay inline
- Currency is always ₦ (Naira)
- No layout shift — all dynamic UI elements have pre-reserved space

---

## Service Catalogue

- 185 service groups across 29 platforms
- 278 total tiers (Budget/Standard/Premium mix)
- 38 Nigerian-specific groups, 60 Nigerian tiers
- Pricing: markup brackets from 3.5× (low cost) to 1.35× (high cost) with 50% margin floor
- Min orders: Followers 100, Likes 50, Views 500, Comments 10, Engagement 50, Subscribers 100

See [SERVICES.md](./SERVICES.md) for full catalogue structure and pricing details.

---

## Features — Complete

- **Auth** — JWT with email verification, password reset, device sessions, role-based access
- **Payments** — Paystack wallet funding, wallet-based ordering
- **Orders** — Full lifecycle with provider API integration and status polling
- **Admin Panel** — Stats, user/order/service management, blog CMS, coupons, referrals
- **Support** — WhatsApp-style ticketing with Nitro Bot + live agent handoff, multi-admin soft locking
- **Pricing** — Tiered markup with configurable brackets
- **Security** — SHA-256 hashing, device limits, session management, role-based routes
- **UI** — Responsive (mobile/tablet/desktop), night/day theme, polished landing page
- **Blog** — Full CMS at `/blog` route
- **Referrals** — Unique links, bonus on first purchase, admin tracking
- **Coupons** — Discount codes with expiry, usage limits, restrictions

---

## Pre-Launch Status

| Task | Status |
|------|--------|
| Seed service catalogue | ✅ Done |
| End-to-end order test | ⏳ Pending |
| Clean up test users | ⏳ Pending |
| Vercel env vars | ✅ Done |
| Notification prefs persist | ⏳ Pending |

---

## Roadmap

**Phase 2:** Multi-provider routing, Flutterwave/ALATPay, mobile bottom nav  
**Phase 3:** Ticket assignment, TypeScript migration, CI/CD, automated tests  
**Future:** Budget sub-brand, WhatsApp chatbot ordering, white-label child panels, recurring billing

---

## Documentation

| Document | Location | Format |
|----------|----------|--------|
| Project Overview | [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | Markdown |
| Deployment Guide | [DEPLOYMENT.md](./DEPLOYMENT.md) | Markdown |
| API & Providers | [API_PROVIDERS.md](./API_PROVIDERS.md) | Markdown |
| Service Catalogue | [SERVICES.md](./SERVICES.md) | Markdown |
| Security Architecture | [SECURITY.md](./SECURITY.md) | Markdown |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) | Markdown |
| Admin Onboarding | `/docs/Admin_Onboarding_Guide.docx` | DOCX |
| User Onboarding | `/docs/User_Onboarding_Guide.pdf` | PDF |
| Terms of Service | `/docs/Terms_of_Service.pdf` | PDF |
| Privacy Policy | `/docs/Privacy_Policy.pdf` | PDF |
| Incident Playbook | `/docs/Incident_Playbook.docx` | DOCX |
| Brand Guidelines | `/docs/Brand_Guidelines.pdf` | PDF |

---

## Development Conventions

- **UI workflow:** Mockup → review → approval → build → deploy. No exceptions.
- **Git:** Verify brace balance → `git add -A` → `git commit` → `git push origin main`
- **CSS:** Static styles in globals.css. Only theme colours inline.
- **Reverts:** Exact reverts only — no bundled changes.
- **Tables:** Lowercase, quoted in raw SQL (`"tickets"`, `"users"`)

---

## Contacts

| Item | Value |
|------|-------|
| Primary domain | nitro.ng |
| Admin email | admin@thenitro.ng |
| Public email | TheNitroNG@gmail.com |
| Instagram | @Nitro.ng, @TheNitroNg |
| X (Twitter) | @TheNitroNG |
| GitHub | github.com/ajadonai/NitroNG |
