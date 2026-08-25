# Nitro NG — Product Truth

Durable product facts for design work. Visual decisions do not belong here.

## What it is

A Nigerian social media marketing platform. People buy engagement — followers,
likes, views, comments, members — for Instagram, TikTok, YouTube, X, Facebook,
Telegram, Spotify and around 30 other platforms, priced and paid in naira.

## Platform

Web. Overwhelmingly mobile in practice: the audience is Nigerian and phone-first,
so mobile is the primary design target and desktop the secondary one.

## Users and jobs

Two first-class audiences, designed as separate paths rather than one with an
add-on:

**Creators and businesses (retail).** Individuals and small businesses buying for
their own accounts. The larger group — roughly 755 buyers in a 30-day window.
Their job: make an account look credible, or give a post enough momentum to be
taken seriously. They arrive knowing the outcome they want, not the service name.

**Resellers (wholesale).** Panel owners, agencies and bulk buyers who resell to
their own customers. Small in number, higher value per head, launched Aug 2026.
Their job: source engagement reliably in naira and keep the margin. They arrive
knowing exactly what they want and needing price, IDs and availability fast.

## What makes it different

- **Naira end to end.** Opay, PalmPay, Kuda, bank transfer. No dollar cards, no FX
  to watch, no foreign minimums. This is the core position, not a feature.
- **Curated quality tiers.** Budget, Standard, Premium against the same service,
  so quality is a choice rather than a gamble. Curated services carry Nitro's own
  refill guarantee.
- **Concierge ordering.** Customers who cannot name what they need can send a link
  on WhatsApp and have the order placed for them, at the same price.

## Durable constraints

- **Nitro is the provider.** Upstream suppliers are never named or implied in any
  customer- or reseller-facing surface: not in copy, service names, error messages,
  IDs or catalogue listings. Reseller-facing service IDs are Nitro's own and
  permanent once issued.
- **Curated carries Nitro's guarantee; the wider catalogue carries each service's
  own terms**, shown before ordering. Never blur the two.
- **Wholesale replaces retail incentives.** Reseller pricing does not stack with
  loyalty or promotions.
- **Nigerian-targeted services are a distinct, marked category** (🇳🇬) and priced
  above their generic equivalents.
- Support is WhatsApp. There is no in-app ticket system.

## Voice

Plain language a Nigerian user reads without effort. No technical jargon, no
internal or admin concepts, no em dashes. Say what a thing does, not how it is
built.

## Success

The retention half already works: about 69% of buyers order more than once,
consistently across acquisition sources. The gap is the first order — roughly
four in five signups never buy at all.

So design optimises for **getting a new signup to their first order**, and treats
repeat ordering as something to keep out of the way of rather than to push.

## Accessibility

Not a formal WCAG gate. Correctness is carried by shared primitives
(`components/ui-primitives.jsx`: `Modal`, `Field`, `FOCUS_RING`) so new work
starts right instead of being audited later. Hand-rolled modals and unlabelled
inputs are the failure mode to avoid, not a standard to certify against.

Most of this is mobile usability under another name — touch targets, visible
focus, labels that respond to tapping — which matters more here than compliance.

## Open

- Whether the reseller path gets its own visual treatment or shares the retail one.
- Whether Trustpilot or Google reviews becomes the third-party proof surface.
