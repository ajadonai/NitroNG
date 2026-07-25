# In-Context Popups Plan

Educational popups designed to reduce support tickets and set user expectations. Preview all designs at `/preview-popups`.

## Status

| # | Popup | Priority | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | Before First Order Submit | Must-have | Deferred | Modal with 4 tips (account safety, gradual delivery, normal drops, refill). Shows once on first order via localStorage. Shelved — needs UX refinement around modal stacking with order summary. |
| 2 | Tier Selection — Info Tooltip | Must-have | Pending | Tooltip explaining Budget/Standard/Premium differences when user taps info icon next to tier chips. |
| 3 | Link Input — Contextual Help | Should-have | Pending | Inline helper below link input showing correct link format (profile vs post). |
| 4 | Order Completed — Info Banner | Must-have | Pending | Banner inside completed order details explaining normal drops + refill. |
| 5 | Order Partial — Info Banner | Must-have | Pending | Banner inside partial order details explaining partial delivery + refund. |
| 6 | Pricing Page — Top Banner | Should-have | Pending | One-time dismissible banner on pricing page about tier selection. |
| 7 | Dashboard — Education Card | Should-have | Pending | How growth services work card, shows on first visit then once every 30 days. |
| 8 | Add Funds — Payment Method Info | Nice-to-have | Pending | Inline payment method breakdown on the add funds page. |

## Implementation Notes

- **#1**: Tracked via `nitro_first_order_done` in localStorage. Only shows before the very first order.
- **#2**: Shows when tapping info icon next to tier chips.
- **#3**: Shows inline when user focuses the link input.
- **#4 & #5**: Show inside expanded order details, dismissible per order.
- **#6**: Shows once on pricing page (dismissible, localStorage).
- **#7**: Shows on first dashboard visit, then once every 30 days.
- **#8**: Always visible inline on the add funds page.
