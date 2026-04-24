# Deferred Items

Items evaluated during Phase 1, intentionally deferred to a later phase.

| # | Item | Phase | Reason |
|---|------|-------|--------|
| 1 | Wire notification preferences to order/email paths | 2 | Toggles persist correctly but no code reads them before sending notifications. Order completion, webhooks, and Brevo emails need to check `notifOrders` / `notifEmail` before firing. |
| 2 | LCP optimisation on user + admin dashboards | 2 | Both dashboards are fully client-rendered; fixing LCP requires server components or streaming — architecture work, not hardening. |
| 3 | End-to-end payment provider test (Flutterwave, NOWPayments, Manual) | Pre-launch | Orders tested and working. Payment gateway integration blocked on CAC registration — required to apply to Flutterwave and NOWPayments. Test once credentials are live. |
