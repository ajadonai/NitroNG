# Changelog

## Phase 1 — Pre-Launch Hardening (2026-04-18 → 2026-04-22)

Branch: `phase-1/pre-launch-hardening` | 32 commits | 66 files changed

### Security
- Password reset kills all sessions on all devices (P0)
- Payment init accepts idempotency key with unique index — double-click returns existing session (P1)
- Webhook signature verification mandatory in production — missing secret returns 503 (P1)
- Stale `thenitro.ng` origins removed from CSRF allowlist (P1)

### Tailwind Migration
- Migrated 45 JSX files from inline styles to Tailwind CSS v4 utilities
- Added custom `desktop:` breakpoint (1200px) matching existing media queries
- `globals.css` reduced from 1,891 to 680 lines — retains only theme tokens, resets, keyframes, hover effects, and styles Tailwind can't express
- Migration rule: static layout/typography → `className`; theme-dependent values (`dark` ternaries, `t.*` tokens) → inline `style`

### Layout Shift
- New-order link validation: conditional render → `visibility` toggle
- Add-funds coupon error: conditional render → `visibility` toggle
- Add-funds inputs: fixed focus loss caused by nested component functions re-creating on every render
- CLS < 0.05 verified on audited pages

### Cleanup
- Removed all stale Paystack references (only `lib/name-filter.js` banned-brand list remains)
- Removed stale `thenitro.ng` domain references
- Updated README: UI stack now says "Tailwind CSS", removed secondary domain line
- Removed dead CSS: `blog-header/logo/article`, `admin-root`, `adm-quick-actions/action-btn`
- Removed Quick Actions section from admin overview
- Added empty state SVG icon to admin orders
- Deactivated API section in user settings (visible but non-functional, "Coming soon")

### Notification Persistence
- All 8 test matrix cases pass (reload, close/reopen, theme switch, background/resume, logout/login, cross-device, concurrent toggle, password reset)

### Docs
- `docs/PHASE_1_BRIEF.md` — engineering brief
- `docs/PHASE_1_AUDIT.md` — audit findings and ripgrep proof
- `docs/DEFERRED.md` — items deferred to Phase 2+
- `docs/CHANGELOG.md` — this file
