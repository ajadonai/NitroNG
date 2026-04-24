# API & Provider Integration Reference

---

## Providers

| Provider | Role | Endpoint | Speciality |
|----------|------|----------|-----------|
| **MTP** (MoreThanPanel) | Primary | `https://morethanpanel.com/api/v2` | Full-spectrum, 4,405 services |
| **JAP** (JustAnotherPanel) | Gap-filler | `https://justanotherpanel.com/api/v2` | Audiomack, Boomplay, Apple Music, WhatsApp, web traffic, reviews |
| **DaoSMM** | Nigerian specialist | `https://daosmm.com/api/v2` | Hyper-local Nigerian targeting |

MTP is wired and operational. JAP and DaoSMM API keys obtained. Multi-provider auto-routing deferred to Phase 3.

---

## API Format

All providers use the standard SMM panel API format:

```
POST {API_URL}
Content-Type: application/x-www-form-urlencoded

key={API_KEY}&action={ACTION}&...params
```

Responses are JSON.

---

## Actions

### List Services

```
key={API_KEY}&action=services
```

```json
[
  {
    "service": 1,
    "name": "Instagram Followers [Real - 30 Days Refill]",
    "type": "Default",
    "category": "Instagram - Followers",
    "rate": "0.50",
    "min": "100",
    "max": "100000",
    "refill": true,
    "cancel": true
  }
]
```

Fields: `service` (provider ID, mapped to ServiceTier), `rate` (cost per 1K in USD for MTP), `min`/`max` (quantity limits), `refill`/`cancel` (capabilities).

### Check Balance

```
key={API_KEY}&action=balance
```

```json
{ "balance": "150.25", "currency": "USD" }
```

### Place Order

```
key={API_KEY}&action=add&service={SERVICE_ID}&link={TARGET_URL}&quantity={QTY}
```

```json
{ "order": 123456 }
```

Some services use `username` instead of `link` (e.g., follower services).

### Check Status (Single)

```
key={API_KEY}&action=status&order={ORDER_ID}
```

```json
{
  "charge": "0.50",
  "start_count": "1500",
  "status": "Completed",
  "remains": "0",
  "currency": "USD"
}
```

### Check Status (Batch)

```
key={API_KEY}&action=status&orders=123,456,789
```

Returns a JSON object keyed by order ID. Use for efficient polling.

### Cancel Order

```
key={API_KEY}&action=cancel&order={ORDER_ID}
```

Only works if `cancel: true` and delivery hasn't started.

### Request Refill

```
key={API_KEY}&action=refill&order={ORDER_ID}
```

Only works if `refill: true`. Re-delivers if count dropped.

---

## Status Mapping

| Provider Status | Nitro Status | Action |
|----------------|-------------|--------|
| Pending | Pending | Auto-processes |
| Processing | Processing | No action |
| In progress | In Progress | Monitor |
| Completed | Completed | None |
| Partial | Partial | Auto-refund undelivered portion |
| Canceled | Cancelled | Full refund |

---

## Order Pipeline

```
User selects service + tier + quantity + link
  → Nitro validates (balance, quantity, link format)
  → Deducts wallet
  → Creates internal Order (Pending)
  → POST to provider API (action=add)
  → Stores provider order ID (Processing)
  → Status polling begins
  → Updates status based on provider response
```

### Partial Delivery

1. `remains` field shows undelivered count
2. Refund = `(remains / total) × user_charge`
3. Credit to wallet, update to Partial, notify user

### Cancellation

Full refund to wallet, update to Cancelled, notify user.

---

## Service Mapping

Each ServiceTier maps to a provider service ID:

```
ServiceGroup: "Instagram Followers"
  ├── Budget → MTP service 5012
  ├── Standard → MTP service 5045
  └── Premium → MTP service 5078
```

### Verify a Mapping

```bash
curl -X POST https://morethanpanel.com/api/v2 \
  -d "key=API_KEY&action=services" | jq '.[] | select(.service == 5012)'
```

If the ID doesn't exist, the mapping is stale — disable the tier and find the replacement.

---

## Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| Not enough funds on balance | Provider account low | Top up provider |
| Incorrect service ID | Service removed/renumbered | Update tier mapping |
| Link is wrong | URL format mismatch | Validate before submission |
| Not enough quantity | Below provider minimum | Enforce Nitro minimums |
| Max quantity exceeded | Above provider maximum | Enforce Nitro maximums |

---

## Rate Limits

- **MTP:** No documented limit. Stay under 10 req/sec.
- **JAP:** TBD — test on integration.
- **DaoSMM:** TBD — test on integration.

---

## Multi-Provider Routing (Phase 3)

Planned design:
1. Each tier maps to multiple providers with priority order
2. Try highest-priority first
3. Failover to next on error/downtime
4. Optional best-price routing with reliability scores
